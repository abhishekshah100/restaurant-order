import type { KitchenStep } from '@/api/contracts';
import type { Order } from '@/types/order';
import { withKitchenStep, withPlated } from './kitchenBoard';

/**
 * The kitchen's taps waiting to reach the server (Start cooking, Mark ready, a recall, a dish
 * ticked as plated). Every tap goes in here first and the board shows it at once; they're sent
 * in the order they were made, and kept on the device while the connection is down (a reload
 * or a restarted tablet keeps them), for up to two hours. The server takes a step it already
 * has as done, so sending one twice does no harm.
 */

interface OutboxTarget {
  /** Unique: the tap's own id. */
  id: string;
  /** When it was tapped (ms since epoch). */
  at: number;
  branchId: string;
  orderId: string;
  round: number;
  /** Tried and got no answer (offline, timed out): how many times. */
  tries: number;
}

export type OutboxEntry = OutboxTarget &
  (
    | { kind: 'step'; step: KitchenStep; back?: true }
    | { kind: 'plated'; index: number; plated: boolean }
  );

/** A tap as the screen makes it (the queue adds its id, time and tries). */
export type KitchenTap =
  | (Omit<OutboxTarget, 'id' | 'at' | 'tries'> & { kind: 'step'; step: KitchenStep; back?: true })
  | (Omit<OutboxTarget, 'id' | 'at' | 'tries'> & {
      kind: 'plated';
      index: number;
      plated: boolean;
    });

/** A tap older than this isn't sent: the kitchen has long moved on. */
export const OUTBOX_MAX_AGE_MS = 2 * 60 * 60_000;

/** The ticket a tap is for ("A105:2", as the board keys them). */
export const outboxTicketKey = (entry: Pick<OutboxEntry, 'orderId' | 'round'>) =>
  `${entry.orderId}:${entry.round}`;

/**
 * The queue with a tap added. A dish ticked again replaces its tick still waiting (only the
 * last one counts); steps queue up in order (New → Cooking → Ready, or an undo).
 */
export function enqueue(entries: readonly OutboxEntry[], entry: OutboxEntry): OutboxEntry[] {
  if (entry.kind === 'plated') {
    const rest = entries.filter(
      (e) =>
        !(
          e.kind === 'plated' &&
          e.branchId === entry.branchId &&
          e.orderId === entry.orderId &&
          e.round === entry.round &&
          e.index === entry.index
        ),
    );
    return [...rest, entry];
  }
  return [...entries, entry];
}

/** The taps still worth sending, and those too old to. */
export function splitExpired(
  entries: readonly OutboxEntry[],
  now: number,
): { kept: OutboxEntry[]; expired: OutboxEntry[] } {
  const kept: OutboxEntry[] = [];
  const expired: OutboxEntry[] = [];
  for (const entry of entries) (now - entry.at > OUTBOX_MAX_AGE_MS ? expired : kept).push(entry);
  return { kept, expired };
}

/** The orders with one tap made on them (as the server will have it). */
export function applyTap(orders: readonly Order[], entry: OutboxEntry): Order[] {
  return entry.kind === 'step'
    ? withKitchenStep(orders, entry.orderId, entry.round, entry.step)
    : withPlated(orders, entry.orderId, entry.round, entry.index, entry.plated);
}

/** The branch's orders as the kitchen sees them: the server's, with the taps still waiting. */
export function withOutbox(
  orders: readonly Order[],
  entries: readonly OutboxEntry[],
  branchId: string,
): Order[] {
  return entries
    .filter((entry) => entry.branchId === branchId)
    .reduce<Order[]>((acc, entry) => applyTap(acc, entry), [...orders]);
}

const STEPS: readonly KitchenStep[] = ['received', 'preparing', 'ready'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** One stored tap, checked field by field (anything else is dropped). */
function isEntry(value: unknown): value is OutboxEntry {
  if (!isRecord(value)) return false;
  const base =
    typeof value.id === 'string' &&
    typeof value.at === 'number' &&
    typeof value.branchId === 'string' &&
    typeof value.orderId === 'string' &&
    typeof value.round === 'number' &&
    typeof value.tries === 'number';
  if (!base) return false;
  if (value.kind === 'step') {
    return STEPS.some((s) => s === value.step) && (value.back === undefined || value.back === true);
  }
  return (
    value.kind === 'plated' && typeof value.index === 'number' && typeof value.plated === 'boolean'
  );
}

/** What was stored, keeping only well-formed taps. */
export function parseOutbox(value: unknown): OutboxEntry[] {
  return Array.isArray(value) ? value.filter(isEntry) : [];
}
