import { createClock, type Clock } from '@/lib/clock';
import { TRACK_STEPS, isFinished, type TrackStep } from '@/lib/orders';
import type { Branch, OrderMode } from '@/types/branch';
import type { ItemStatus, Order, OrderRound } from '@/types/order';
import { MINUTE_MS } from './rules';

/*
 * The mock kitchen (and pickup counter, and riders): orders placed through the mock server
 * move along by time since they were placed. A real backend reports what actually happened.
 */

/** Dine-in: minutes after placing when each stage starts. */
const DINE_IN_MINUTES = { received: 0, preparing: 2, ready: 18, served: 22 };

/** The kitchen starts on an order this long after it arrives. */
const START_MINUTES = 2;

/** A takeaway guest collects their order this long after it's ready. */
const COLLECT_MINUTES = 10;

/** Epoch ms when each of the order's steps starts, by its mode. */
function stageTimes(order: Order, branch: Branch): Partial<Record<TrackStep, number>> {
  const placedAt = Date.parse(order.placedAt);
  const after = (minutes: number) => placedAt + minutes * MINUTE_MS;
  if (order.mode === 'takeaway' && order.pickup) {
    const readyAt = Date.parse(order.pickup.at);
    const prep = branch.modes.takeaway.prepMinutes * MINUTE_MS;
    return {
      received: placedAt,
      // A later slot is started just in time for it.
      preparing: Math.max(after(START_MINUTES), readyAt - prep),
      ready: readyAt,
      pickedUp: readyAt + COLLECT_MINUTES * MINUTE_MS,
    };
  }
  if (order.mode === 'delivery' && order.delivery) {
    return {
      received: placedAt,
      preparing: after(START_MINUTES),
      outForDelivery: after(branch.modes.delivery.prepMinutes),
      delivered: Date.parse(order.delivery.expectedAt),
    };
  }
  return {
    received: placedAt,
    preparing: after(DINE_IN_MINUTES.preparing),
    ready: after(DINE_IN_MINUTES.ready),
    served: after(DINE_IN_MINUTES.served),
  };
}

/** When the kitchen's part is done: ready (dine-in, takeaway) or handed to the rider. */
const kitchenDone = (mode: OrderMode, at: Partial<Record<TrackStep, number>>): number =>
  (mode === 'delivery' ? at.outForDelivery : at.ready) ?? 0;

/** Items start one after another during preparation and are ready in turn (served at the table). */
function simulatedItemStatus(
  index: number,
  count: number,
  at: Partial<Record<TrackStep, number>>,
  mode: OrderMode,
  now: number,
): ItemStatus {
  const start = at.preparing ?? 0;
  const span = kitchenDone(mode, at) - start;
  if (mode === 'dineIn' && now >= (at.served ?? Infinity)) return 'served';
  if (now >= start + (span * (index + 1)) / count) return 'ready';
  if (now >= start + (span * index) / (2 * count)) return 'preparing';
  return 'queued';
}

/**
 * Where an order has got to at `now`, by its mode — dine-in: received → preparing → ready →
 * served; takeaway: … → ready (at the pickup time) → picked up; delivery: … → out for delivery →
 * delivered (at the expected time) — with item statuses, ETA, timeline (times on the branch's
 * clock) and, once out for delivery, the rider. Deterministic for a given `now`; cancelled
 * orders are returned unchanged.
 */
export function simulateOrder(order: Order, now: Date, clock: Clock, branch: Branch): Order {
  if (order.status === 'cancelled') return order;
  const t = now.getTime();
  const at = stageTimes(order, branch);
  const steps: readonly TrackStep[] = TRACK_STEPS[order.mode];
  const reached = steps.filter((step, i) => i === 0 || t >= (at[step] ?? Infinity));
  const status = reached[reached.length - 1];
  // The time the guest is waiting for: ready (dine-in, takeaway) or at the door (delivery).
  const awaitedAt = (order.mode === 'delivery' ? at.delivered : at.ready) ?? t;
  const waiting = reached.length < (order.mode === 'delivery' ? 4 : 3);
  const { delivery } = order;
  return {
    ...order,
    status,
    timeline: reached.map(
      (step) =>
        order.timeline.find((e) => e.status === step) ?? {
          status: step,
          time: clock.time(new Date(at[step] ?? t)),
        },
    ),
    items: order.items.map((item, i) => ({
      ...item,
      status: simulatedItemStatus(i, order.items.length, at, order.mode, t),
    })),
    etaMinutes: waiting ? Math.max(1, Math.ceil((awaitedAt - t) / MINUTE_MS)) : undefined,
    readyBy: clock.time(new Date(awaitedAt)),
    // The rider is shared with the guest once they've set off.
    ...(delivery
      ? {
          delivery: {
            ...delivery,
            rider: reached.includes('outForDelivery') ? delivery.rider : undefined,
          },
        }
      : {}),
  };
}

/** One round of an order as the kitchen has it at `now` (cancelled rounds stay as they are). */
function liveRound(order: Order, round: OrderRound, now: Date, clock: Clock, branch: Branch) {
  if (round.status === 'cancelled') return { round, order };
  // Each round moves along like an order of its own, from when it was placed.
  const { placedAt, status, items, timeline } = round;
  const current = simulateOrder(
    { ...order, placedAt, status, items, timeline },
    now,
    clock,
    branch,
  );
  const { etaMinutes, readyBy } = current;
  return {
    round: {
      ...round,
      status: current.status,
      items: current.items,
      timeline: current.timeline,
      etaMinutes,
      readyBy,
    },
    order: current,
  };
}

/**
 * An order placed through the server as read at `now`: its live status, `live` while it still
 * moves. Each round moves along on its own; the order shows the latest round still on it
 * (status, timeline, ETA) and the items of every round still on it.
 */
export function liveOrder(order: Order, now: number, branch: Branch): Order {
  const clock = createClock(branch);
  const at = new Date(now);
  if (!order.rounds || order.status === 'cancelled') {
    const current = simulateOrder(order, at, clock, branch);
    return { ...current, live: !isFinished(current) };
  }
  const live = order.rounds.map((round) => liveRound(order, round, at, clock, branch));
  const active = live.filter(({ round }) => round.status !== 'cancelled');
  const latest = active[active.length - 1]?.order ?? order;
  const current: Order = {
    ...latest,
    placedAt: order.placedAt,
    items: active.flatMap(({ round }) => round.items),
    rounds: live.map(({ round }) => round),
  };
  return { ...current, live: !isFinished(current) };
}
