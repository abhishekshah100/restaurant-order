import type { AdminBranchService, AdminOrderSummary, AdminServiceRequest } from '@/types/admin';

/*
 * MOCK ONLY — sample floor activity, so the waiter home isn't empty while there are no real
 * guests on this device. GET /admin/branches/:branchId/service adds it to the branch's own
 * activity; Done and Mark served dismiss items for the rest of the tab's life. A real backend
 * never sees this file. It shows only under `npm run dev` (never in a build or tests); turn it
 * off there too with NEXT_PUBLIC_ADMIN_DEMO=false.
 */

export const isDemoFloorOn = () =>
  process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_ADMIN_DEMO !== 'false';

const DEMO_PREFIX = 'demo-';

/** Sample order numbers: shown on screen, so they look like real ones (requests' ids aren't). */
const DEMO_ORDER_IDS = ['A901', 'A902', 'A903', 'A904'];

export const isDemoId = (id: string) => id.startsWith(DEMO_PREFIX) || DEMO_ORDER_IDS.includes(id);

/** Demo items dealt with in this tab: request ids, and `orderId:round` for served rounds. */
const dismissed = new Set<string>();

export function dismissDemo(id: string, round?: number) {
  dismissed.add(round === undefined ? id : `${id}:${round}`);
}

const ago = (now: number, minutes: number) => new Date(now - minutes * 60_000).toISOString();

function demoRequests(now: number): AdminServiceRequest[] {
  const base = { sessionId: `${DEMO_PREFIX}session` };
  return [
    {
      ...base,
      id: `${DEMO_PREFIX}r1`,
      kind: 'waiter',
      reason: 'water',
      table: 4,
      requestedAt: ago(now, 12),
    },
    {
      ...base,
      id: `${DEMO_PREFIX}r2`,
      kind: 'bill',
      scope: 'table',
      balance: 2840,
      table: 7,
      requestedAt: ago(now, 6),
    },
    {
      ...base,
      id: `${DEMO_PREFIX}r3`,
      kind: 'waiter',
      reason: 'other',
      note: 'Birthday candle for dessert, please',
      table: 2,
      requestedAt: ago(now, 3),
    },
    {
      ...base,
      id: `${DEMO_PREFIX}r4`,
      kind: 'waiter',
      reason: 'cutlery',
      table: 9,
      requestedAt: ago(now, 1),
    },
    {
      ...base,
      id: `${DEMO_PREFIX}r5`,
      kind: 'bill',
      scope: 'mine',
      balance: 960,
      table: 11,
      requestedAt: ago(now, 0),
    },
  ];
}

function demoOrders(now: number): AdminOrderSummary[] {
  const order = (
    id: string,
    fields: Pick<AdminOrderSummary, 'mode' | 'customerName' | 'total'> & { table?: number },
    placedMinutes: number,
    rounds: { round: number; itemCount: number; readyMinutes: number }[],
  ): AdminOrderSummary => ({
    id,
    ...fields,
    placedAt: ago(now, placedMinutes),
    status: 'ready',
    itemCount: rounds.reduce((n, r) => n + r.itemCount, 0),
    due: fields.total,
    paymentStatus: 'unpaid',
    readyRounds: rounds.map((r) => ({
      round: r.round,
      itemCount: r.itemCount,
      readyAt: ago(now, r.readyMinutes),
    })),
  });
  return [
    order('A901', { mode: 'dineIn', table: 5, customerName: 'Priya', total: 1450 }, 28, [
      { round: 1, itemCount: 3, readyMinutes: 9 },
    ]),
    order('A902', { mode: 'dineIn', table: 3, customerName: 'Arjun', total: 2210 }, 40, [
      { round: 2, itemCount: 2, readyMinutes: 4 },
    ]),
    order('A903', { mode: 'takeaway', customerName: 'Meera', total: 680 }, 18, [
      { round: 1, itemCount: 2, readyMinutes: 2 },
    ]),
    order('A904', { mode: 'delivery', customerName: 'Rohan', total: 1120 }, 22, [
      { round: 1, itemCount: 4, readyMinutes: 0 },
    ]),
  ];
}

/** The service with the demo activity not yet dismissed added (counts and tables included). */
export function withDemoFloor(
  service: AdminBranchService,
  now: number,
  tableStates: (
    orders: AdminOrderSummary[],
    requests: AdminServiceRequest[],
  ) => AdminBranchService['tables'],
): AdminBranchService {
  const extraRequests = demoRequests(now).filter((r) => !dismissed.has(r.id));
  const extraOrders = demoOrders(now)
    .map((o) => ({
      ...o,
      readyRounds: o.readyRounds.filter((r) => !dismissed.has(`${o.id}:${r.round}`)),
    }))
    .filter((o) => !dismissed.has(o.id) && o.readyRounds.length > 0);

  const requests = [...service.requests, ...extraRequests].sort((a, b) =>
    a.requestedAt.localeCompare(b.requestedAt),
  );
  const orders = [...service.orders, ...extraOrders].sort((a, b) =>
    b.placedAt.localeCompare(a.placedAt),
  );
  return {
    ...service,
    requests,
    orders,
    // Real tables first; demo ones only where the table has no real activity.
    tables: [
      ...service.tables,
      ...tableStates(extraOrders, extraRequests).filter(
        (demo) => !service.tables.some((real) => real.table === demo.table),
      ),
    ].sort((a, b) => a.table - b.table),
    counts: {
      waiterCalls: requests.filter((r) => r.kind === 'waiter').length,
      billRequests: requests.filter((r) => r.kind === 'bill').length,
      readyToServe: orders.reduce((n, o) => n + o.readyRounds.length, 0),
      unpaid: service.counts.unpaid + extraOrders.filter((o) => o.due > 0).length,
    },
  };
}
