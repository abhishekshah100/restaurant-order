import { createClock } from '@/lib/clock';
import { amountDue } from '@/lib/lifecycle';
import { isFinished, isToday } from '@/lib/orders';
import type {
  AdminFloorPlan,
  AdminFloorTable,
  AdminServiceRequest,
  AdminTableDetail,
  FloorPlanLayout,
  FloorTableLayout,
  FloorTableStatus,
} from '@/types/admin';
import type { Branch } from '@/types/branch';
import type { Order } from '@/types/order';
import { fail, ok, type Handler, type MockContext } from '../context';
import { adminBranch } from './adminSessions';
import { floorActivity } from './adminService';

/*
 * The floor plan: every area of a branch with its tables and what's happening at each (GET
 * /admin/branches/:branchId/tables), and one table's open orders and requests (GET
 * /admin/branches/:branchId/tables/:table).
 */

/* ---------- Deriving the floor plan (pure) ---------- */

export interface FloorPlanInput {
  layout: FloorPlanLayout;
  /** The branch's orders, as for GET /admin/branches/:branchId/service. */
  orders: readonly Order[];
  /** The branch's open requests. */
  requests: readonly AdminServiceRequest[];
  /** When staff last freed each table (ISO), by table number. */
  freedAt?: Readonly<Record<number, string>>;
  branch: Branch;
  now: number;
}

/** Today's dine-in orders still open: not cancelled, and not both served and paid. Newest first. */
function openDineIn({ orders, branch, now }: FloorPlanInput): Order[] {
  const clock = createClock(branch);
  return orders
    .filter(
      (o) =>
        o.mode === 'dineIn' &&
        o.status !== 'cancelled' &&
        isToday(o.placedAt, new Date(now), clock) &&
        !(isFinished(o) && amountDue(o) === 0),
    )
    .sort((a, b) => b.placedAt.localeCompare(a.placedAt));
}

/** What a table needs most: a waiter, the bill, food on the way, or nothing (eating, free). */
function statusOf(orders: readonly Order[], requests: readonly AdminServiceRequest[]) {
  let status: FloorTableStatus = 'available';
  if (orders.length > 0) status = orders.some((o) => !isFinished(o)) ? 'ordering' : 'eating';
  if (requests.some((r) => r.kind === 'bill')) status = 'wantsBill';
  if (requests.some((r) => r.kind === 'waiter')) status = 'needsWaiter';
  return status;
}

/** An order's latest activity: when its last round went to the kitchen. */
const lastPlaced = (order: Order) => order.rounds?.at(-1)?.placedAt ?? order.placedAt;

/**
 * One table now. Freed by staff (`freedAt`), only what came after counts, and the first order
 * or request after it clears the flag. Freed in the data itself (`layout.freed`, the backend's
 * flag with no time), nothing counts.
 */
function tableAt(
  layout: FloorTableLayout,
  open: readonly Order[],
  requests: readonly AdminServiceRequest[],
  freedAt: string | undefined,
) {
  const { number, seats } = layout;
  const since = (at: string) => !layout.freed && (!freedAt || at > freedAt);
  const orders = open.filter((o) => o.table === number && since(lastPlaced(o)));
  const asked = requests
    .filter((r) => r.table === number && since(r.requestedAt))
    .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  const freed =
    layout.freed || (freedAt !== undefined && orders.length === 0 && asked.length === 0);
  const table: AdminFloorTable = {
    table: number,
    seats,
    status: statusOf(orders, asked),
    freed,
    orderCount: orders.length,
    due: orders.reduce((sum, o) => sum + amountDue(o), 0),
    ...(orders.length > 0 ? { seatedAt: orders.at(-1)?.placedAt } : {}),
  };
  return { table, orders, requests: asked };
}

/** GET /admin/branches/:branchId/tables's answer. */
export function floorPlan(input: FloorPlanInput): AdminFloorPlan {
  const open = openDineIn(input);
  return {
    floors: input.layout.floors.map(({ id, name, tables }) => ({
      id,
      name,
      tables: tables.map(
        (layout) => tableAt(layout, open, input.requests, input.freedAt?.[layout.number]).table,
      ),
    })),
    generatedAt: new Date(input.now).toISOString(),
  };
}

/** GET /admin/branches/:branchId/tables/:table's answer; undefined if no area has the table. */
export function tableDetail(input: FloorPlanInput, number: number): AdminTableDetail | undefined {
  const floor = input.layout.floors.find((f) => f.tables.some((t) => t.number === number));
  const layout = floor?.tables.find((t) => t.number === number);
  if (!floor || !layout) return undefined;
  const { table, orders, requests } = tableAt(
    layout,
    openDineIn(input),
    input.requests,
    input.freedAt?.[number],
  );
  return {
    ...table,
    floor: { id: floor.id, name: floor.name },
    orders,
    requests,
    generatedAt: new Date(input.now).toISOString(),
  };
}

/* ---------- Handlers ---------- */

/** When staff last freed each of the branch's tables, by table number. */
function freedTimes(ctx: MockContext, branch: Branch): Record<number, string> {
  const prefix = `${branch.id}:`;
  return Object.fromEntries(
    Object.entries(ctx.db.tablesFreed.read())
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, at]) => [Number(key.slice(prefix.length)), at]),
  );
}

/** Everything the floor plan is worked out from, for a branch. */
async function floorInput(ctx: MockContext, branch: Branch): Promise<FloorPlanInput> {
  const [layout, activity] = await Promise.all([
    ctx.seed.floors(branch.id),
    floorActivity(ctx, branch),
  ]);
  return { layout, ...activity, freedAt: freedTimes(ctx, branch), branch };
}

/** The table number in the path, as one of the branch's tables, or 404. */
function tableNumber(input: FloorPlanInput, raw: string) {
  const number = Number(raw);
  const known = input.layout.floors.some((f) => f.tables.some((t) => t.number === number));
  if (!Number.isInteger(number) || !known) fail(404, 'not_found');
  return number;
}

/** GET /admin/branches/:branchId/tables */
export const branchFloorPlan: Handler = async (ctx, { params, headers }) => {
  const branch = await adminBranch(ctx, headers, params.branchId);
  return ok(floorPlan(await floorInput(ctx, branch)));
};

/** GET /admin/branches/:branchId/tables/:table */
export const branchTable: Handler = async (ctx, { params, headers }) => {
  const branch = await adminBranch(ctx, headers, params.branchId);
  const input = await floorInput(ctx, branch);
  return ok(tableDetail(input, tableNumber(input, params.table)));
};

/** POST /admin/branches/:branchId/tables/:table/free */
export const freeTable: Handler = async (ctx, { params, headers }) => {
  const branch = await adminBranch(ctx, headers, params.branchId);
  const input = await floorInput(ctx, branch);
  const number = tableNumber(input, params.table);
  const at = new Date(ctx.now()).toISOString();
  ctx.db.tablesFreed.write({ ...ctx.db.tablesFreed.read(), [`${branch.id}:${number}`]: at });
  return ok(tableDetail({ ...input, freedAt: { ...input.freedAt, [number]: at } }, number));
};
