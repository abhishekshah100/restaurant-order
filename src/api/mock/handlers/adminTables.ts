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
import { fail, ok, type Handler } from '../context';
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

function tableAt(
  { number, seats }: FloorTableLayout,
  open: readonly Order[],
  requests: readonly AdminServiceRequest[],
) {
  const orders = open.filter((o) => o.table === number);
  const asked = requests
    .filter((r) => r.table === number)
    .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  const table: AdminFloorTable = {
    table: number,
    seats,
    status: statusOf(orders, asked),
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
      tables: tables.map((layout) => tableAt(layout, open, input.requests).table),
    })),
    generatedAt: new Date(input.now).toISOString(),
  };
}

/** GET /admin/branches/:branchId/tables/:table's answer; undefined if no area has the table. */
export function tableDetail(input: FloorPlanInput, number: number): AdminTableDetail | undefined {
  const floor = input.layout.floors.find((f) => f.tables.some((t) => t.number === number));
  const layout = floor?.tables.find((t) => t.number === number);
  if (!floor || !layout) return undefined;
  const { table, orders, requests } = tableAt(layout, openDineIn(input), input.requests);
  return {
    ...table,
    floor: { id: floor.id, name: floor.name },
    orders,
    requests,
    generatedAt: new Date(input.now).toISOString(),
  };
}

/* ---------- Handlers ---------- */

/** GET /admin/branches/:branchId/tables */
export const branchFloorPlan: Handler = async (ctx, { params, headers }) => {
  const branch = await adminBranch(ctx, headers, params.branchId);
  const [layout, activity] = await Promise.all([
    ctx.seed.floors(branch.id),
    floorActivity(ctx, branch),
  ]);
  return ok(floorPlan({ layout, ...activity, branch }));
};

/** GET /admin/branches/:branchId/tables/:table */
export const branchTable: Handler = async (ctx, { params, headers }) => {
  const branch = await adminBranch(ctx, headers, params.branchId);
  const number = Number(params.table);
  if (!Number.isInteger(number)) fail(404, 'not_found');
  const [layout, activity] = await Promise.all([
    ctx.seed.floors(branch.id),
    floorActivity(ctx, branch),
  ]);
  const detail = tableDetail({ layout, ...activity, branch }, number);
  if (!detail) fail(404, 'not_found');
  return ok(detail);
};
