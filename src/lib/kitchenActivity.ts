import type { Branch } from '@/types/branch';
import type { OrderStatus } from '@/types/order';
import { average, ticketMinutes, type KitchenTicket } from './kitchenBoard';

/*
 * The kitchen's activity today, pure: what happened to each ticket and when (received, started,
 * ready, served, cancelled, with who when staff marked it), the day's numbers, tickets by hour
 * and the dishes cooked most. Built from the same tickets as the board (lib/kitchenBoard).
 */

export type KitchenEventKind = 'received' | 'started' | 'ready' | 'served' | 'cancelled';

export const KITCHEN_EVENT_KINDS: readonly KitchenEventKind[] = [
  'received',
  'started',
  'ready',
  'served',
  'cancelled',
];

const EVENT_KIND: Partial<Record<OrderStatus, KitchenEventKind>> = {
  received: 'received',
  preparing: 'started',
  ready: 'ready',
  outForDelivery: 'ready',
  served: 'served',
  pickedUp: 'served',
  delivered: 'served',
  cancelled: 'cancelled',
};

/** One thing that happened to a ticket. */
export interface KitchenEvent {
  /** Unique in the feed: "A105:2:ready". */
  key: string;
  kind: KitchenEventKind;
  /** ISO. */
  at: string;
  /** The time as the server wrote it ("7:42 PM"). */
  time: string;
  /** The staff member who marked it, when the kitchen did. */
  by?: string;
  /** The server's note on it ("Taken by Abhishek", "Item unavailable"). */
  note?: string;
  ticket: KitchenTicket;
}

/**
 * Every event on the tickets, newest first. An event says when it happened (`at`); the drawn
 * history doesn't, so its events count from the round's order time, in step order.
 */
export function kitchenEvents(tickets: readonly KitchenTicket[]): KitchenEvent[] {
  const events = tickets.flatMap((ticket) =>
    ticket.timeline.flatMap((event, index): KitchenEvent[] => {
      const kind = EVENT_KIND[event.status];
      if (!kind) return [];
      const mark =
        kind === 'started'
          ? ticket.kitchen?.started
          : kind === 'ready'
            ? ticket.kitchen?.ready
            : undefined;
      const at =
        mark?.at ?? event.at ?? new Date(Date.parse(ticket.placedAt) + index).toISOString();
      return [
        {
          key: `${ticket.key}:${kind}`,
          kind,
          at,
          time: event.time,
          ...(mark ? { by: mark.by } : {}),
          ...(event.note ? { note: event.note } : {}),
          ticket,
        },
      ];
    }),
  );
  return events.sort((a, b) => b.at.localeCompare(a.at));
}

/** Events of a kind (all of them for 'all'), matching the search. */
export function filterEvents(
  events: readonly KitchenEvent[],
  kind: KitchenEventKind | 'all',
  query: string,
): KitchenEvent[] {
  const q = query.trim().toLowerCase();
  return events.filter(({ kind: k, ticket, by }) => {
    if (kind !== 'all' && k !== kind) return false;
    if (!q) return true;
    return (
      ticket.orderId.toLowerCase().includes(q) ||
      ticket.customerName.toLowerCase().includes(q) ||
      (ticket.table !== undefined && String(ticket.table) === q) ||
      (by?.toLowerCase().includes(q) ?? false) ||
      ticket.items.some((item) => item.name.toLowerCase().includes(q))
    );
  });
}

/** Events of each kind, within the search. */
export function eventCounts(
  events: readonly KitchenEvent[],
  query: string,
): Record<KitchenEventKind | 'all', number> {
  const counts = { all: filterEvents(events, 'all', query).length } as Record<
    KitchenEventKind | 'all',
    number
  >;
  for (const kind of KITCHEN_EVENT_KINDS) counts[kind] = filterEvents(events, kind, query).length;
  return counts;
}

/* ---------- The day's numbers ---------- */

export interface ActivitySummary {
  /** Tickets today, not cancelled. */
  tickets: number;
  /** Of those, the ones the kitchen has finished (ready, served or collected). */
  finished: number;
  /** Items on the finished tickets, counted by quantity. */
  itemsCooked: number;
  /** Minutes from order to ready, on average. */
  averageMinutes: number | null;
  /** The slowest ticket's minutes. */
  longestMinutes: number | null;
  /** Share of finished tickets ready by their due time (0–100), when any are finished. */
  onTimePercent: number | null;
  cancelled: number;
}

const isFinishedTicket = (t: KitchenTicket) => t.stage === 'ready' || t.stage === 'done';

export function activitySummary(tickets: readonly KitchenTicket[]): ActivitySummary {
  const live = tickets.filter((t) => t.stage !== 'cancelled');
  const finished = live.filter(isFinishedTicket);
  const minutes = finished.map(ticketMinutes).filter((m): m is number => m !== null);
  const timed = finished.filter((t) => t.readyAt);
  const onTime = timed.filter((t) => Date.parse(t.readyAt ?? '') <= Date.parse(t.dueAt));
  return {
    tickets: live.length,
    finished: finished.length,
    itemsCooked: finished.reduce((n, t) => n + t.itemCount, 0),
    averageMinutes: average(minutes),
    longestMinutes: minutes.length > 0 ? Math.max(...minutes) : null,
    onTimePercent: timed.length > 0 ? Math.round((onTime.length / timed.length) * 100) : null,
    cancelled: tickets.length - live.length,
  };
}

/* ---------- Tickets by hour ---------- */

export interface HourCount {
  /** The branch's local hour, 0–23. */
  hour: number;
  tickets: number;
  items: number;
}

/** The hour (0–23) of an ISO time on the branch's clock. */
export function localHour(iso: string, branch: Pick<Branch, 'timezone'>): number {
  const hour = new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric',
    hourCycle: 'h23',
    timeZone: branch.timezone,
  }).format(new Date(iso));
  return Number(hour) % 24;
}

/** "7 PM" for 19, as the branch writes hours (upper-case AM/PM, like its clock). */
export function hourLabel(hour: number, branch: Pick<Branch, 'locale'>): string {
  const parts = new Intl.DateTimeFormat(branch.locale, {
    hour: 'numeric',
    hourCycle: 'h12',
    timeZone: 'UTC',
  }).formatToParts(new Date(Date.UTC(2000, 0, 1, hour)));
  const p = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${p.hour} ${(p.dayPeriod ?? '').toUpperCase()}`.trim();
}

/** Tickets (not cancelled) by the hour they were ordered, every hour from the first to the last. */
export function ticketsByHour(
  tickets: readonly KitchenTicket[],
  branch: Pick<Branch, 'timezone'>,
): HourCount[] {
  const live = tickets.filter((t) => t.stage !== 'cancelled');
  if (live.length === 0) return [];
  const byHour = new Map<number, HourCount>();
  for (const ticket of live) {
    const hour = localHour(ticket.placedAt, branch);
    const count = byHour.get(hour) ?? { hour, tickets: 0, items: 0 };
    count.tickets += 1;
    count.items += ticket.itemCount;
    byHour.set(hour, count);
  }
  const hours = [...byHour.keys()];
  const [first, last] = [Math.min(...hours), Math.max(...hours)];
  return Array.from(
    { length: last - first + 1 },
    (_, i) => byHour.get(first + i) ?? { hour: first + i, tickets: 0, items: 0 },
  );
}

/** The busiest hour (the first of equals); null without tickets. */
export const busiestHour = (hours: readonly HourCount[]): HourCount | null =>
  hours.reduce<HourCount | null>((top, h) => (!top || h.tickets > top.tickets ? h : top), null);

/* ---------- Dishes cooked most ---------- */

export interface DishCount {
  dishSlug: string;
  name: string;
  veg: boolean;
  quantity: number;
}

/** The dishes ordered most today (tickets not cancelled), by quantity, up to `limit`. */
export function topDishes(tickets: readonly KitchenTicket[], limit = 6): DishCount[] {
  const dishes = new Map<string, DishCount>();
  for (const ticket of tickets) {
    if (ticket.stage === 'cancelled') continue;
    for (const item of ticket.items) {
      const dish = dishes.get(item.dishSlug) ?? {
        dishSlug: item.dishSlug,
        name: item.name,
        veg: item.veg,
        quantity: 0,
      };
      dish.quantity += item.quantity;
      dishes.set(item.dishSlug, dish);
    }
  }
  return [...dishes.values()]
    .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name))
    .slice(0, limit);
}
