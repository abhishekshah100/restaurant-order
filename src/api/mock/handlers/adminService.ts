import { createClock } from '@/lib/clock';
import { amountDue } from '@/lib/lifecycle';
import { isFinished, isToday } from '@/lib/orders';
import { fromSaved, isSavedSession } from '@/lib/session';
import { STORAGE_KEYS, readJSON } from '@/lib/storage';
import type {
  AdminBranchService,
  AdminOrderSummary,
  AdminReadyRound,
  AdminServiceCounts,
  AdminTableState,
  AdminTableStatus,
} from '@/types/admin';
import type { Branch } from '@/types/branch';
import type { Order, OrderItem, OrderRound } from '@/types/order';
import type { ServiceRequest } from '@/types/service';
import type {
  HistoryOrder,
  OrderHistoryResponse,
  PaymentHistoryResponse,
  RequestHistoryResponse,
  ResolveRequestResponse,
} from '../../contracts';
import { ledgerOf } from '@/lib/adminPayments';
import { shiftDay } from '@/lib/dayRange';
import {
  acknowledgeDemo,
  demoDoneRequests,
  demoOrders,
  demoRequests,
  isDemoFloorOn,
  isDemoId,
  resolveDemo,
  serveDemo,
} from '../demoFloor';
import { fail, isObject, ok, type Handler, type MockContext } from '../context';
import { liveOrder, readyAt } from '../kitchen';
import { adminBranch, signedInAccount } from './adminSessions';
import { allOrders, branchOrders, placedOrders } from './orders';
import { isPending, isRecent } from './serviceRequests';

/*
 * The floor staff's endpoints: what needs doing at a branch now (GET
 * /admin/branches/:branchId/service), and marking a request dealt with or an order served.
 */

/* ---------- Deriving the floor's state (pure) ---------- */

const quantity = (items: readonly OrderItem[]) => items.reduce((n, item) => n + item.quantity, 0);

const iso = (ms: number) => new Date(ms).toISOString();

/** A live order's rounds as the kitchen has them; an order without rounds is one round. */
const roundsNow = (
  order: Order,
): Pick<OrderRound, 'number' | 'placedAt' | 'status' | 'items' | 'kitchen'>[] =>
  order.rounds ?? [
    {
      number: 1,
      placedAt: order.placedAt,
      status: order.status,
      items: order.items,
      kitchen: order.kitchen,
    },
  ];

/** The rounds of a live order that are ready and not served yet, oldest first. */
export function readyRounds(order: Order, branch: Branch): AdminReadyRound[] {
  return roundsNow(order)
    .filter((round) => round.status === 'ready')
    .map((round) => ({
      round: round.number,
      itemCount: quantity(round.items),
      readyAt: iso(
        readyAt({ ...order, placedAt: round.placedAt, kitchen: round.kitchen }, branch) ??
          Date.parse(round.placedAt),
      ),
    }))
    .sort((a, b) => a.readyAt.localeCompare(b.readyAt));
}

export function orderSummary(order: Order, branch: Branch): AdminOrderSummary {
  return {
    id: order.id,
    mode: order.mode,
    ...(order.mode === 'dineIn' && order.table !== undefined ? { table: order.table } : {}),
    customerName: order.customerName,
    placedAt: order.placedAt,
    status: order.status,
    itemCount: quantity(order.items),
    total: order.total,
    due: amountDue(order),
    paymentStatus: order.payment.status,
    readyRounds: readyRounds(order, branch),
  };
}

const STATUS_RANK: AdminTableStatus[] = [
  'needsWaiter',
  'wantsBill',
  'ordering',
  'eating',
  'closing',
];

/** Where one table is in its visit, from its orders today and its open requests. */
function tableStatus(orders: readonly AdminOrderSummary[], requests: readonly ServiceRequest[]) {
  const statuses: AdminTableStatus[] = [];
  if (requests.some((r) => r.kind === 'waiter')) statuses.push('needsWaiter');
  if (requests.some((r) => r.kind === 'bill')) statuses.push('wantsBill');
  if (orders.some((o) => !isFinished(o))) statuses.push('ordering');
  if (orders.some((o) => o.due > 0)) statuses.push('eating');
  statuses.push('closing');
  return STATUS_RANK.find((status) => statuses.includes(status)) ?? 'closing';
}

/** The tables with activity today: an order not cancelled, or an open request. */
export function tableStates(
  orders: readonly AdminOrderSummary[],
  requests: readonly ServiceRequest[],
): AdminTableState[] {
  const tables = new Set<number>();
  for (const o of orders) if (o.table !== undefined) tables.add(o.table);
  for (const r of requests) tables.add(r.table);
  return [...tables]
    .sort((a, b) => a - b)
    .map((table) => {
      const atTable = orders.filter((o) => o.table === table);
      const asked = requests.filter((r) => r.table === table);
      const times = [...atTable.map((o) => o.placedAt), ...asked.map((r) => r.requestedAt)];
      return {
        table,
        status: tableStatus(atTable, asked),
        orderCount: atTable.length,
        due: atTable.reduce((sum, o) => sum + o.due, 0),
        lastActivityAt: times.sort().at(-1) ?? '',
      };
    });
}

export interface FloorInput {
  /** The branch's orders, live (placed ones moved along by the kitchen) plus the drawn history. */
  orders: readonly Order[];
  /** The branch's open requests. */
  requests: readonly ServiceRequest[];
  /** The branch's requests dealt with in the last 30 minutes. */
  done?: readonly ServiceRequest[];
  branch: Branch;
  now: number;
}

/** GET /admin/branches/:branchId/service's answer, from the branch's orders and open requests. */
export function floorService({
  orders,
  requests,
  done = [],
  branch,
  now,
}: FloorInput): AdminBranchService {
  const clock = createClock(branch);
  const today = orders
    .filter((o) => o.status !== 'cancelled' && isToday(o.placedAt, new Date(now), clock))
    .map((o) => orderSummary(o, branch));
  const open = [...requests].sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  const counts: AdminServiceCounts = {
    waiterCalls: open.filter((r) => r.kind === 'waiter').length,
    billRequests: open.filter((r) => r.kind === 'bill').length,
    readyToServe: today.reduce((n, o) => n + o.readyRounds.length, 0),
    unpaid: today.filter((o) => o.due > 0).length,
  };
  return {
    requests: open,
    doneRequests: [...done].sort((a, b) => (b.resolvedAt ?? '').localeCompare(a.resolvedAt ?? '')),
    orders: today
      .filter((o) => !isFinished(o) || o.due > 0)
      .sort((a, b) => b.placedAt.localeCompare(a.placedAt)),
    tables: tableStates(today, open),
    counts,
    generatedAt: iso(now),
  };
}

/* ---------- Storage lookups ---------- */

/**
 * The branch each guest session is at. Sessions saved on the device before the mock server
 * existed are adopted, as for the guest's own requests (api/mock/context › liveSession).
 */
async function sessionBranches(ctx: MockContext): Promise<Map<string, string>> {
  const byId = new Map(ctx.db.sessions.read().map((s) => [s.id, s.branchId]));
  const saved = readJSON(STORAGE_KEYS.session, isSavedSession);
  if (saved && !byId.has(saved.id)) {
    byId.set(saved.id, fromSaved(saved, await ctx.seed.defaultBranchId()).branchId);
  }
  return byId;
}

/** A request with the branch its session is at. */
async function requestWithBranch(ctx: MockContext, id: string) {
  const request = ctx.db.serviceRequests.read().find((r) => r.id === id);
  if (!request || !isRecent(request, ctx.now())) fail(404, 'not_found');
  return { request, branchId: (await sessionBranches(ctx)).get(request.sessionId) };
}

/* ---------- Handlers ---------- */

/**
 * What the floor endpoints read for a branch: its orders (placed ones moved along by the
 * kitchen, the drawn history and, under `npm run dev`, the demo floor), its open requests and
 * those dealt with in the last 30 minutes.
 */
export async function floorActivity(ctx: MockContext, branch: Branch) {
  const now = ctx.now();
  const [{ placed, history }, branchOf] = await Promise.all([
    branchOrders(ctx, branch),
    sessionBranches(ctx),
  ]);
  const orders = allOrders(placed, history);
  const atBranch = ctx.db.serviceRequests
    .read()
    .filter((r) => isRecent(r, now) && branchOf.get(r.sessionId) === branch.id);
  const requests = atBranch.filter((r) => isPending(r, now));
  const done = atBranch.filter((r) => r.resolvedAt !== undefined);
  if (!isDemoFloorOn()) return { orders, requests, done, now };
  // A demo order a waiter added to is saved as a real one (handlers/adminOrders).
  const demo = demoOrders(branch, await ctx.seed.menu(branch.id), now).filter(
    (d) => !placed.some((o) => o.id === d.id),
  );
  return {
    orders: [...orders, ...demo],
    requests: [...requests, ...demoRequests(demo, now)],
    done: [...done, ...demoDoneRequests(demo, now)],
    now,
  };
}

/** GET /admin/branches/:branchId/service */
export const branchService: Handler = async (ctx, { params, headers }) => {
  const branch = await adminBranch(ctx, headers, params.branchId);
  // The mock has no kitchen messages.
  const activity = await floorActivity(ctx, branch);
  const guests = (requests: typeof activity.requests) =>
    requests.filter((r): r is ServiceRequest => r.kind !== 'kitchen');
  return ok(
    floorService({
      ...activity,
      requests: guests(activity.requests),
      done: guests(activity.done),
      branch,
    }),
  );
};

/**
 * The open request a staff member acts on, with their name: 401 without a session, 403 for
 * another branch's, 404 when it's unknown or lapsed. A demo request (dev only) has no record.
 */
async function staffRequest(ctx: MockContext, headers: Record<string, string>, id: string) {
  const { name } = signedInAccount(ctx, headers);
  if (isDemoFloorOn() && isDemoId(id)) return { name, request: undefined };
  const { request, branchId } = await requestWithBranch(ctx, id);
  await adminBranch(ctx, headers, branchId);
  return { name, request };
}

/** Saves the request (re-reading the table first, so a concurrent write isn't lost). */
function saveRequest(ctx: MockContext, request: ServiceRequest) {
  ctx.db.serviceRequests.write(
    ctx.db.serviceRequests.read().map((r) => (r.id === request.id ? request : r)),
  );
}

/** POST /admin/service-requests/:id/acknowledge */
export const acknowledgeServiceRequest: Handler = async (ctx, { params, headers }) => {
  const { name, request } = await staffRequest(ctx, headers, params.id);
  const at = iso(ctx.now());
  if (!request) {
    acknowledgeDemo(params.id, name, at);
    return ok({});
  }
  if (request.resolvedAt) fail(409, 'request_closed');
  // Whoever said it first is the one on the way.
  const acknowledged: ServiceRequest = request.acknowledgedAt
    ? request
    : { ...request, acknowledgedAt: at, acknowledgedBy: name };
  saveRequest(ctx, acknowledged);
  const response: ResolveRequestResponse = { request: acknowledged };
  return ok(response);
};

/** POST /admin/service-requests/:id/resolve */
export const resolveServiceRequest: Handler = async (ctx, { params, headers }) => {
  const { name, request } = await staffRequest(ctx, headers, params.id);
  const at = iso(ctx.now());
  if (!request) {
    resolveDemo(params.id, name, at);
    return ok({});
  }
  const resolved: ServiceRequest = request.resolvedAt
    ? request
    : { ...request, resolvedAt: at, resolvedBy: name };
  saveRequest(ctx, resolved);
  const response: ResolveRequestResponse = { request: resolved };
  return ok(response);
};

/** The rounds to mark: the one named, or every one ready now. 409 when none can be served yet. */
function roundsToServe(live: Order, round: number | undefined): number[] {
  if (live.status === 'cancelled') fail(409, 'order_closed');
  const rounds = roundsNow(live).filter((r) => r.status !== 'cancelled');
  const named = round === undefined ? rounds : rounds.filter((r) => r.number === round);
  if (named.length === 0) fail(400, 'invalid_request');
  const ready = named.filter((r) => r.status === 'ready').map((r) => r.number);
  const done = named.every((r) => isFinished({ status: r.status, mode: live.mode }));
  if (ready.length === 0 && !done) fail(409, 'not_ready');
  return ready;
}

/** The body's optional round number; 400 if it isn't a whole number. */
function roundOf(body: unknown): number | undefined {
  const round = isObject(body) ? body.round : undefined;
  if (round === undefined) return undefined;
  if (typeof round !== 'number' || !Number.isInteger(round)) fail(400, 'invalid_request');
  return round;
}

/** POST /admin/orders/:id/served */
export const markOrderServed: Handler = async (ctx, { params, body, headers }) => {
  const round = roundOf(body);
  const order = (await placedOrders(ctx)).find((o) => o.id === params.id);
  if (!order && isDemoFloorOn() && isDemoId(params.id)) {
    serveDemo(params.id);
    return ok({});
  }
  if (!order) {
    // The drawn history doesn't move: it can only be served already.
    const drawn = (await ctx.seed.orders()).history.find((o) => o.id === params.id);
    if (!drawn) fail(404, 'not_found');
    const branch = await adminBranch(ctx, headers, drawn.branchId);
    const current = (await branchOrders(ctx, branch)).history.find((o) => o.id === params.id);
    if (!current) fail(404, 'not_found');
    roundsToServe(current, round);
    return ok(current);
  }

  const branch = await adminBranch(ctx, headers, order.branchId);
  const now = ctx.now();
  const numbers = roundsToServe(liveOrder(order, now, branch), round);
  if (numbers.length > 0) {
    const servedAt = iso(now);
    // Synchronous from here: re-read, so a concurrent write isn't lost.
    ctx.db.orders.write(
      ctx.db.orders.read().map((o) => {
        if (o.id !== order.id) return o;
        if (!o.rounds) return { ...o, servedAt };
        return {
          ...o,
          rounds: o.rounds.map((r) => (numbers.includes(r.number) ? { ...r, servedAt } : r)),
        };
      }),
    );
  }
  const updated = (await placedOrders(ctx)).find((o) => o.id === order.id) ?? order;
  return ok(liveOrder(updated, now, branch));
};

/** A request lapses this long after it was made (as the backend). */
const REQUEST_TTL_MS = 30 * 60_000;

/**
 * GET /admin/branches/:branchId/service-requests/history?from=&to=&kind= — MOCK: every request
 * this device kept (the mock keeps no branch on them), on those days in the branch's time.
 */
export const requestHistory: Handler = async (ctx, { params, headers, query }) => {
  const branch = await adminBranch(ctx, headers, params.branchId);
  const clock = createClock(branch);
  const today = clock.dayKey(new Date(ctx.now()));
  const from = query.from ?? today;
  const to = query.to ?? from;
  const kind = query.kind;
  if (from > to || to > today) fail(400, 'invalid_request');
  const now = ctx.now();
  const requests = ctx.db.serviceRequests
    .read()
    .filter((r) => {
      const day = clock.dayKey(new Date(r.requestedAt));
      return day >= from && day <= to && (!kind || r.kind === kind);
    })
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
    .map((r) => {
      const answeredAt = r.acknowledgedAt ?? r.resolvedAt;
      const requested = Date.parse(r.requestedAt);
      return {
        ...r,
        outcome: r.resolvedAt
          ? ('resolved' as const)
          : now - requested >= REQUEST_TTL_MS
            ? ('lapsed' as const)
            : ('open' as const),
        ...(answeredAt
          ? {
              answeredInMinutes: Math.max(
                0,
                Math.round((Date.parse(answeredAt) - requested) / 60_000),
              ),
            }
          : {}),
      };
    });
  const answered = requests.flatMap((r) =>
    r.answeredInMinutes === undefined ? [] : [r.answeredInMinutes],
  );
  const response: RequestHistoryResponse = {
    from,
    to,
    requests,
    summary: {
      total: requests.length,
      resolved: requests.filter((r) => r.outcome === 'resolved').length,
      lapsed: requests.filter((r) => r.outcome === 'lapsed').length,
      averageAnswerMinutes: answered.length
        ? Math.round(answered.reduce((s, m) => s + m, 0) / answered.length)
        : null,
    },
  };
  return ok(response);
};

/**
 * GET /admin/branches/:branchId/payments/history — MOCK: the same sums and pages, worked out from
 * the mock's orders (each payment on the day it was taken).
 */
export const paymentHistory: Handler = async (ctx, { params, headers, query }) => {
  const branch = await adminBranch(ctx, headers, params.branchId);
  const clock = createClock(branch);
  const today = clock.dayKey(new Date(ctx.now()));
  const to = query.to ?? today;
  const from = query.from ?? shiftDay(to, -6);
  if (from > to || to > today) fail(400, 'invalid_request');
  const { placed, history } = await branchOrders(ctx, branch);
  const rows = allOrders(placed, history).flatMap((order) =>
    ledgerOf(order).map((tx, i) => ({ tx, order, seq: i + 1 })),
  );
  const inDays = rows.filter(({ tx }) => {
    const day = clock.dayKey(new Date(tx.at));
    return day >= from && day <= to;
  });
  const sum = (list: typeof inDays, pick: (r: (typeof inDays)[number]) => number) =>
    list.reduce((s, r) => s + pick(r), 0);
  const pays = inDays.filter((r) => r.tx.kind === 'payment');
  const refs = inDays.filter((r) => r.tx.kind === 'refund');
  const methods = new Map<string, PaymentHistoryResponse['summary']['byMethod'][number]>();
  for (const { tx } of inDays) {
    const key = `${tx.method}|${tx.channel}`;
    const m = methods.get(key) ?? {
      method: tx.method,
      channel: tx.channel,
      count: 0,
      amount: 0,
      refunds: 0,
      tips: 0,
    };
    if (tx.kind === 'refund') m.refunds += tx.amount;
    else {
      m.count += 1;
      m.amount += tx.amount;
      m.tips += tx.tip ?? 0;
    }
    methods.set(key, m);
  }
  const cash = [...methods.values()].filter((m) => m.method === 'cash');
  const q = (query.q ?? '').trim().toLowerCase();
  const matching = inDays
    .filter(
      ({ tx, order }) =>
        (!query.kind ||
          query.kind === 'all' ||
          (query.kind === 'refunds') === (tx.kind === 'refund')) &&
        (!query.channel || query.channel === 'all' || tx.channel === query.channel) &&
        (!query.method || tx.method === query.method) &&
        (!q ||
          [order.id, order.customerName, tx.transactionRef ?? '', tx.by ?? '']
            .join(' ')
            .toLowerCase()
            .includes(q) ||
          String(order.table ?? '') === q),
    )
    .sort((a, b) => b.tx.at.localeCompare(a.tx.at));
  const limit = Math.min(Number(query.limit ?? 50) || 50, 1000);
  const start = query.cursor ? Number(query.cursor) : 0;
  const page = matching.slice(start, start + limit);
  const response: PaymentHistoryResponse = {
    from,
    to,
    summary: {
      collected: sum(pays, (r) => r.tx.amount),
      refunds: sum(refs, (r) => r.tx.amount),
      refundsPending: sum(
        refs.filter((r) => r.tx.status === 'started'),
        (r) => r.tx.amount,
      ),
      net: sum(pays, (r) => r.tx.amount) - sum(refs, (r) => r.tx.amount),
      tips: sum(pays, (r) => r.tx.tip ?? 0),
      waived: sum(pays, (r) => r.tx.waived ?? 0),
      payments: pays.length,
      refundCount: refs.length,
      online: sum(
        pays.filter((r) => r.tx.channel === 'online'),
        (r) => r.tx.amount,
      ),
      inPerson: sum(
        pays.filter((r) => r.tx.channel === 'inPerson'),
        (r) => r.tx.amount,
      ),
      cashTaken: cash.reduce((s, m) => s + m.amount + m.tips - m.refunds, 0),
      byMethod: [...methods.values()].sort((a, b) => b.amount - a.amount),
    },
    transactions: page.map(({ tx, order, seq }) => ({
      id: `${order.id}-T${String(seq)}`,
      orderId: order.id,
      mode: order.mode,
      ...(order.table !== undefined ? { table: order.table } : {}),
      customerName: order.customerName,
      kind: tx.kind,
      method: tx.method,
      channel: tx.channel,
      amount: tx.amount,
      ...(tx.tip ? { tip: tx.tip } : {}),
      ...(tx.waived ? { waived: tx.waived } : {}),
      ...(tx.waiveReason ? { waiveReason: tx.waiveReason } : {}),
      ...(tx.by ? { by: tx.by } : {}),
      ...(tx.transactionRef ? { transactionRef: tx.transactionRef } : {}),
      ...(tx.reason ? { reason: tx.reason } : {}),
      ...(tx.status ? { status: tx.status } : {}),
      at: tx.at,
    })),
    matching: matching.length,
    ...(start + limit < matching.length ? { next: String(start + limit) } : {}),
  };
  return ok(response);
};

/** Handed over (served, picked up, delivered). */
const isCompleted = (o: Order) => o.status !== 'cancelled' && isFinished(o);

/**
 * GET /admin/branches/:branchId/orders/history — MOCK: the same sums and pages, worked out from
 * the mock's orders (each order on the day it was placed).
 */
export const orderHistory: Handler = async (ctx, { params, headers, query }) => {
  const branch = await adminBranch(ctx, headers, params.branchId);
  const clock = createClock(branch);
  const today = clock.dayKey(new Date(ctx.now()));
  const to = query.to ?? today;
  const from = query.from ?? shiftDay(to, -6);
  if (from > to || to > today) fail(400, 'invalid_request');
  const { placed, history } = await branchOrders(ctx, branch);
  const inDays = allOrders(placed, history).filter((o) => {
    const day = clock.dayKey(o.placedAt);
    return day >= from && day <= to;
  });
  const billed = inDays.filter((o) => o.status !== 'cancelled');
  const sales = billed.reduce((s, o) => s + o.total, 0);
  const unpaid = billed.filter((o) => amountDue(o) > 0);
  const modes = new Map<Order['mode'], { mode: Order['mode']; orders: number; sales: number }>();
  for (const o of billed) {
    const m = modes.get(o.mode) ?? { mode: o.mode, orders: 0, sales: 0 };
    m.orders += 1;
    m.sales += o.total;
    modes.set(o.mode, m);
  }
  const q = (query.q ?? '').trim().toLowerCase();
  const matching = inDays
    .filter(
      (o) =>
        (!query.status ||
          query.status === 'all' ||
          (query.status === 'completed' && isCompleted(o)) ||
          (query.status === 'cancelled' && o.status === 'cancelled') ||
          (query.status === 'unpaid' && amountDue(o) > 0)) &&
        (!query.mode || query.mode === 'all' || o.mode === query.mode) &&
        (!q ||
          `${o.id} ${o.customerName}`.toLowerCase().includes(q) ||
          String(o.table ?? '') === q),
    )
    .sort((a, b) => b.placedAt.localeCompare(a.placedAt));
  const limit = Math.min(Number(query.limit ?? 30) || 30, 1000);
  const start = query.cursor ? Number(query.cursor) : 0;
  const row = (o: Order): HistoryOrder => ({
    id: o.id,
    ...(o.token !== undefined ? { token: o.token } : {}),
    mode: o.mode,
    ...(o.table !== undefined ? { table: o.table } : {}),
    customerName: o.customerName,
    status: o.status,
    ...(o.cancelReason ? { cancelReason: o.cancelReason as HistoryOrder['cancelReason'] } : {}),
    ...(o.cancelledBy ? { cancelledBy: o.cancelledBy } : {}),
    items: quantity(o.items),
    total: o.total,
    paymentStatus: o.payment.status,
    due: amountDue(o),
    method: o.payment.method,
    placedAt: o.placedAt,
  });
  const response: OrderHistoryResponse = {
    from,
    to,
    summary: {
      orders: inDays.length,
      completed: inDays.filter(isCompleted).length,
      cancelled: inDays.length - billed.length,
      inProgress: billed.filter((o) => !isFinished(o)).length,
      sales,
      averageBill: billed.length > 0 ? Math.round(sales / billed.length) : 0,
      unpaidOrders: unpaid.length,
      unpaid: unpaid.reduce((s, o) => s + amountDue(o), 0),
      byMode: [...modes.values()].sort((a, b) => b.sales - a.sales),
    },
    orders: matching.slice(start, start + limit).map(row),
    matching: matching.length,
    ...(start + limit < matching.length ? { next: String(start + limit) } : {}),
  };
  return ok(response);
};

/** GET /admin/branches/:branchId/orders/:id — MOCK: one of the branch's orders by its code. */
export const branchOrder: Handler = async (ctx, { params, headers }) => {
  const branch = await adminBranch(ctx, headers, params.branchId);
  const { placed, history } = await branchOrders(ctx, branch);
  const order = allOrders(placed, history).find((o) => o.id === params.id);
  if (!order) fail(404, 'not_found');
  return ok(order);
};
