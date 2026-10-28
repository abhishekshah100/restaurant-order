import { createClock } from '@/lib/clock';
import type { MenuCatalog } from '@/lib/menu';
import type { AdminServiceRequest } from '@/types/admin';
import type { Branch } from '@/types/branch';
import type { CategoryId, Dish } from '@/types/menu';
import type { Order, OrderEvent, OrderItem, OrderStatus } from '@/types/order';
import type { WaiterReason } from '@/types/service';

/*
 * MOCK ONLY — sample floor activity, so the staff pages aren't empty while there are no real
 * guests on this device: dine-in orders at several tables (two guests at some), a takeaway
 * ready to hand over, and waiter and bill requests. The floor endpoints add it to the branch's
 * own activity; On my way, Done and Mark served work on it for the rest of the tab's life. A real backend never sees this file. It shows only under `npm run dev` (never in
 * a build or tests); turn it off there too with NEXT_PUBLIC_ADMIN_DEMO=false.
 */

export const isDemoFloorOn = () =>
  process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_ADMIN_DEMO !== 'false';

interface DemoOrder {
  /** Shown on screen, so it looks like a real order number. */
  id: string;
  /** None: a takeaway. */
  table?: number;
  customerName: string;
  status: 'received' | 'preparing' | 'ready' | 'served';
  /** Minutes ago it was placed. */
  placed: number;
  /** Dishes from the branch's menu as [category, position in it, quantity]. */
  dishes: [CategoryId, number, number][];
  kitchenNote?: string;
}

/*
 * A ready dine-in order is placed 18 minutes before it's ready (api/mock/kitchen), so
 * `placed: 26` reads "ready 8 min ago".
 */
const DEMO_ORDERS: DemoOrder[] = [
  {
    id: 'A901',
    table: 5,
    customerName: 'Priya',
    status: 'ready',
    placed: 26,
    dishes: [
      ['starters', 0, 1],
      ['mains', 0, 1],
      ['breads-rice', 0, 2],
    ],
  },
  {
    id: 'A902',
    table: 3,
    customerName: 'Arjun',
    status: 'ready',
    placed: 21,
    dishes: [
      ['mains', 1, 1],
      ['breads-rice', 1, 1],
    ],
  },
  {
    id: 'A903',
    customerName: 'Meera',
    status: 'ready',
    placed: 14,
    dishes: [
      ['meals', 1, 1],
      ['desserts', 2, 1],
    ],
  },
  {
    id: 'A905',
    table: 5,
    customerName: 'Karan',
    status: 'preparing',
    placed: 6,
    dishes: [
      ['pizza', 0, 1],
      ['beverages', 0, 2],
    ],
  },
  {
    id: 'A906',
    table: 4,
    customerName: 'Sana',
    status: 'preparing',
    placed: 10,
    dishes: [
      ['starters', 1, 1],
      ['beverages', 1, 1],
    ],
  },
  {
    id: 'A907',
    table: 2,
    customerName: 'Ananya',
    status: 'served',
    placed: 52,
    dishes: [
      ['mains', 2, 1],
      ['breads-rice', 0, 2],
      ['desserts', 0, 1],
    ],
    kitchenNote: 'Less spicy, please',
  },
  {
    id: 'A908',
    table: 7,
    customerName: 'Neha',
    status: 'served',
    placed: 68,
    dishes: [
      ['starters', 2, 1],
      ['mains', 3, 2],
      ['breads-rice', 1, 3],
    ],
  },
  {
    id: 'A909',
    table: 7,
    customerName: 'Vikram',
    status: 'served',
    placed: 61,
    dishes: [
      ['meals', 0, 1],
      ['beverages', 2, 2],
    ],
  },
  {
    id: 'A910',
    table: 9,
    customerName: 'Rahul',
    status: 'received',
    placed: 1,
    dishes: [
      ['starters', 3, 1],
      ['mains', 4, 1],
    ],
  },
  {
    id: 'A911',
    table: 11,
    customerName: 'Isha',
    status: 'served',
    placed: 44,
    dishes: [
      ['pizza', 1, 1],
      ['desserts', 1, 1],
    ],
  },
  {
    id: 'A912',
    table: 10,
    customerName: 'Dev',
    status: 'preparing',
    placed: 12,
    dishes: [
      ['mains', 5, 1],
      ['breads-rice', 2, 2],
      ['beverages', 3, 1],
    ],
  },
  {
    id: 'A913',
    table: 16,
    customerName: 'Zoya',
    status: 'served',
    placed: 33,
    dishes: [
      ['starters', 4, 2],
      ['beverages', 0, 2],
    ],
  },
];

type DemoRequest = { id: string; table: number; /** Minutes ago. */ requested: number } & (
  | { kind: 'waiter'; reason: WaiterReason; note?: string }
  | { kind: 'bill'; scope: 'mine' | 'table' }
);

const DEMO_REQUESTS: DemoRequest[] = [
  { id: 'demo-r1', kind: 'waiter', reason: 'water', table: 4, requested: 12 },
  { id: 'demo-r2', kind: 'bill', scope: 'table', table: 7, requested: 6 },
  {
    id: 'demo-r3',
    kind: 'waiter',
    reason: 'other',
    note: 'Birthday candle for dessert, please',
    table: 2,
    requested: 3,
  },
  { id: 'demo-r4', kind: 'waiter', reason: 'cutlery', table: 9, requested: 1 },
  { id: 'demo-r5', kind: 'bill', scope: 'mine', table: 11, requested: 0 },
];

export const isDemoId = (id: string) =>
  DEMO_REQUESTS.some((r) => r.id === id) || DEMO_ORDERS.some((o) => o.id === id);

/** Demo orders served in this tab. */
const served = new Set<string>();

export function serveDemo(id: string) {
  served.add(id);
}

/** Who did what to a demo request, and when (ISO). */
interface StaffMark {
  by: string;
  at: string;
}
const acknowledged = new Map<string, StaffMark>();
const resolved = new Map<string, StaffMark>();

/** A staff member is on their way to a demo request (kept if someone already is). */
export function acknowledgeDemo(id: string, by: string, at: string) {
  if (!acknowledged.has(id)) acknowledged.set(id, { by, at });
}

/** A demo request dealt with (kept if it already was). */
export function resolveDemo(id: string, by: string, at: string) {
  if (!resolved.has(id)) resolved.set(id, { by, at });
}

const ago = (now: number, minutes: number) => new Date(now - minutes * 60_000).toISOString();

/** The steps a demo order goes through, and how many minutes after placing each starts. */
const STEPS = [
  ['received', 0],
  ['preparing', 2],
  ['ready', 18],
  ['served', 22],
] as const;

/** The dish at a position in a category, wrapping round; any dish if the category is empty. */
function dishAt(menu: MenuCatalog, category: CategoryId, index: number): Dish {
  const list = menu.dishesIn(category);
  const from = list.length > 0 ? list : menu.dishes;
  return from[index % from.length];
}

function demoOrder(demo: DemoOrder, branch: Branch, menu: MenuCatalog, now: number): Order {
  const clock = createClock(branch);
  const takeaway = demo.table === undefined;
  const isServed = served.has(demo.id);
  const status: OrderStatus = isServed ? (takeaway ? 'pickedUp' : 'served') : demo.status;
  const items: OrderItem[] = demo.dishes.map(([category, index, quantity]) => {
    const dish = dishAt(menu, category, index);
    const { slug: dishSlug, name, veg, price: unitPrice } = dish;
    return { dishSlug, name, veg, quantity, details: [], unitPrice };
  });
  const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const reached = STEPS.slice(0, STEPS.findIndex(([step]) => step === demo.status) + 1);
  const timeline: OrderEvent[] = reached.map(([step, after]) => {
    const at = ago(now, Math.max(0, demo.placed - after));
    return { status: step, time: clock.dateTime(at), at };
  });
  if (isServed) {
    timeline.push({ status, time: clock.dateTime(new Date(now)), at: new Date(now).toISOString() });
  }

  return {
    id: demo.id,
    branchId: branch.id,
    ...(takeaway
      ? { mode: 'takeaway', pickup: { asap: true, at: ago(now, demo.placed - 13) } }
      : { mode: 'dineIn', table: demo.table }),
    customerName: demo.customerName,
    placedBy: 'other',
    sessionId: `demo-${demo.customerName.toLowerCase()}`,
    placedAt: ago(now, demo.placed),
    status,
    items,
    itemTotal: total,
    total,
    payment: { method: takeaway ? 'pickup' : 'counter', status: 'unpaid' },
    timeline,
    ...(demo.kitchenNote ? { kitchenNote: demo.kitchenNote } : {}),
    ...(isServed ? { servedAt: new Date(now).toISOString() } : {}),
  };
}

/** The demo orders at a branch, priced from its menu. */
export function demoOrders(branch: Branch, menu: MenuCatalog, now: number): Order[] {
  return DEMO_ORDERS.map((demo) => demoOrder(demo, branch, menu, now));
}

/** Every demo request as now: who's on the way, who dealt with it. */
function allDemoRequests(orders: readonly Order[], now: number): AdminServiceRequest[] {
  return DEMO_REQUESTS.map(({ requested, ...request }) => {
    const ack = acknowledged.get(request.id);
    const done = resolved.get(request.id);
    const base = {
      sessionId: 'demo-session',
      requestedAt: ago(now, requested),
      ...(ack ? { acknowledgedAt: ack.at, acknowledgedBy: ack.by } : {}),
      ...(done ? { resolvedAt: done.at, resolvedBy: done.by } : {}),
    };
    if (request.kind === 'waiter') return { ...base, ...request };
    const balance = orders
      .filter((o) => o.table === request.table)
      .reduce((sum, o) => sum + o.total, 0);
    return { ...base, ...request, balance };
  });
}

/** The demo requests not dealt with yet; a bill request's balance is its table's demo orders. */
export const demoRequests = (orders: readonly Order[], now: number) =>
  allDemoRequests(orders, now).filter((r) => !r.resolvedAt);

/** The demo requests dealt with in this tab. */
export const demoDoneRequests = (orders: readonly Order[], now: number) =>
  allDemoRequests(orders, now).filter((r) => r.resolvedAt);
