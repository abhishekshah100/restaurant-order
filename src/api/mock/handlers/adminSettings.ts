import {
  applySettings,
  deliveryErrors,
  detailsErrors,
  hoursErrors,
  paymentChoicesFor,
  servicesErrors,
  servicesOf,
  paymentErrors,
  pickupErrors,
  settingsOf,
  taxErrors,
  taxOf,
  uniqueId,
  withDetails,
} from '@/lib/branchSettings';
import { createClock } from '@/lib/clock';
import { amountDue } from '@/lib/lifecycle';
import { isFinished, isToday } from '@/lib/orders';
import type { Branch, DeliveryZone, OpeningSchedule, Weekday } from '@/types/branch';
import { WEEKDAYS } from '@/types/branch';
import type {
  BranchDetails,
  BranchSettings,
  BranchSettingsChoices,
  DeliverySettings,
  PaymentChannelSettings,
  PaymentSettings,
  PickupSettings,
  ServicesSettings,
  TaxSettings,
} from '@/types/branchSettings';
import { PAYMENT_CHANNELS } from '@/types/branchSettings';
import type { BranchSettingsResponse } from '../../contracts';
import { fail, isObject, objectBody, ok, type Handler, type MockContext } from '../context';
import { adminBranch, managedBranches, signedInAccount, toAdminBranch } from './adminSessions';
import { allOrders, branchOrders } from './orders';

/*
 * A branch's settings (GET and PATCH /admin/branches/:branchId/settings) and the branches
 * themselves (POST /admin/branches, DELETE /admin/branches/:branchId). What staff save is kept
 * in db.branchSetup; GET /branches reads it, so guests, prices and the server's checks follow.
 */

const bad = (): never => fail(400, 'invalid_request');

/* ---------- Reading what staff send (shape only; the rules are lib/branchSettings') ---------- */

const str = (v: unknown): string => (typeof v === 'string' ? v : bad());
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : bad());
const bool = (v: unknown): boolean => (typeof v === 'boolean' ? v : bad());
const obj = (v: unknown): Record<string, unknown> => (isObject(v) ? v : bad());
const arr = (v: unknown, max = 50): unknown[] => (Array.isArray(v) && v.length <= max ? v : bad());

function detailsBody(v: unknown): BranchDetails {
  const d = obj(v);
  return {
    name: str(d.name),
    shortName: str(d.shortName),
    city: str(d.city),
    address: str(d.address),
    phone: str(d.phone),
    wifiName: str(d.wifiName),
    tableLocation: str(d.tableLocation),
    country: str(d.country) as BranchDetails['country'],
    timezone: str(d.timezone),
    locale: str(d.locale),
    currency: str(d.currency),
  };
}

function hoursBody(v: unknown): OpeningSchedule {
  const h = obj(v);
  const days = obj(h.days);
  return {
    days: Object.fromEntries(
      WEEKDAYS.map((day): [Weekday, OpeningSchedule['days'][Weekday]] => {
        const d = obj(days[day]);
        return [day, { open: bool(d.open), opens: str(d.opens), closes: str(d.closes) }];
      }),
    ) as OpeningSchedule['days'],
    lastOrdersMinutes: num(h.lastOrdersMinutes),
    windows: arr(h.windows, 20).map((w) => {
      const x = obj(w);
      return { label: str(x.label), from: str(x.from), to: str(x.to) };
    }),
  };
}

function taxBody(v: unknown, current: TaxSettings): TaxSettings {
  const t = obj(v);
  return {
    serviceChargeBp: t.serviceChargeBp === null ? null : num(t.serviceChargeBp),
    lines: arr(t.lines, 10).map((l, i) => {
      const x = obj(l);
      const base = x.base === 'items' || x.base === 'itemsPlusService' ? x.base : bad();
      // Names and parts are the region's: kept as they are.
      const line = current.lines[i] ?? bad();
      return { ...line, id: str(x.id), rateBp: num(x.rateBp), base };
    }),
    discountBeforeTax: bool(t.discountBeforeTax),
    roundTotal: bool(t.roundTotal),
  };
}

function channelBody(v: unknown): PaymentChannelSettings {
  const c = obj(v);
  return {
    methods: arr(c.methods, 20).map(str) as PaymentChannelSettings['methods'],
    recommended:
      c.recommended === null ? null : (str(c.recommended) as PaymentChannelSettings['recommended']),
  };
}

function paymentsBody(v: unknown): PaymentSettings {
  const p = obj(v);
  return {
    ...(Object.fromEntries(PAYMENT_CHANNELS.map((ch) => [ch, channelBody(p[ch])])) as Omit<
      PaymentSettings,
      'atTable'
    >),
    atTable: arr(p.atTable, 20).map(str) as PaymentSettings['atTable'],
  };
}

const ZONE_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;

function deliveryBody(v: unknown): DeliverySettings {
  const d = obj(v);
  const taken = new Set<string>();
  const zones = arr(d.zones, 50).map((z): DeliveryZone => {
    const x = obj(z);
    const name = str(x.name);
    // A new zone (or one whose id is taken) gets one made from its name.
    const id =
      typeof x.id === 'string' && ZONE_ID.test(x.id) && !taken.has(x.id)
        ? x.id
        : uniqueId(name, taken, 'zone');
    taken.add(id);
    return {
      id,
      name,
      areas: arr(x.areas, 100).map(str),
      fee: num(x.fee),
      ...(x.freeAbove === undefined || x.freeAbove === null ? {} : { freeAbove: num(x.freeAbove) }),
      minOrder: num(x.minOrder),
      etaMinutes: num(x.etaMinutes),
    };
  });
  return {
    enabled: bool(d.enabled),
    prepMinutes: num(d.prepMinutes),
    ...(d.maxDistanceKm === undefined || d.maxDistanceKm === null
      ? {}
      : { maxDistanceKm: num(d.maxDistanceKm) }),
    feeTaxable: bool(d.feeTaxable),
    zones,
  };
}

function pickupBody(v: unknown): PickupSettings {
  const p = obj(v);
  return {
    enabled: bool(p.enabled),
    prepMinutes: num(p.prepMinutes),
    minOrder: num(p.minOrder),
    asap: bool(p.asap),
    slotMinutes: num(p.slotMinutes),
  };
}

/* ---------- Helpers ---------- */

/** A branch as staff saved it (before today's hours and the status), or 404. */
async function configOf(ctx: MockContext, branchId: string): Promise<Branch> {
  return (await ctx.seed.branchConfigs()).find((b) => b.id === branchId) ?? fail(404, 'not_found');
}

/** What a branch's settings may choose from: its country's payment methods. */
const choicesOf = (branch: Branch): BranchSettingsChoices => ({
  payments: paymentChoicesFor(branch.country),
});

function servicesBody(v: unknown): ServicesSettings {
  const s = obj(v);
  return { dineIn: bool(s.dineIn), takeaway: bool(s.takeaway), delivery: bool(s.delivery) };
}

/** The short names of every other branch, which a branch's mustn't repeat. */
async function otherShortNames(ctx: MockContext, branchId: string | null) {
  return (await ctx.seed.branchConfigs()).filter((b) => b.id !== branchId).map((b) => b.shortName);
}

function saveBranch(ctx: MockContext, branch: Branch) {
  const setup = ctx.db.branchSetup.read();
  ctx.db.branchSetup.write({ ...setup, saved: { ...setup.saved, [branch.id]: branch } });
}

/* ---------- Handlers ---------- */

/** GET /admin/branches/:branchId/settings */
export const branchSettings: Handler = async (ctx, { params, headers }) => {
  const branch = await adminBranch(ctx, headers, params.branchId);
  const config = await configOf(ctx, branch.id);
  const body: BranchSettingsResponse = {
    settings: settingsOf(config),
    choices: choicesOf(config),
  };
  return ok(body);
};

/** PATCH /admin/branches/:branchId/settings */
export const updateBranchSettings: Handler = async (ctx, { params, body, headers }) => {
  const branch = await adminBranch(ctx, headers, params.branchId);
  const config = await configOf(ctx, branch.id);
  const raw = objectBody(body);
  const keys = Object.keys(raw);
  const known = new Set<string>([
    'details',
    'services',
    'hours',
    'tax',
    'payments',
    'delivery',
    'pickup',
  ]);
  if (keys.length === 0 || keys.some((k) => !known.has(k))) bad();

  // Each section is checked against the branch as the ones before it left it (another
  // country brings other taxes and payment methods).
  let next = config;
  const apply = (patch: Partial<BranchSettings>) => {
    next = applySettings(next, patch, choicesOf(next));
  };
  if (raw.details !== undefined) {
    const details = detailsBody(raw.details);
    if (detailsErrors(details, await otherShortNames(ctx, config.id)).length > 0) bad();
    apply({ details });
  }
  if (raw.hours !== undefined) {
    const hours = hoursBody(raw.hours);
    if (hoursErrors(hours).length > 0) bad();
    apply({ hours });
  }
  if (raw.tax !== undefined) {
    const current = taxOf(next);
    const tax = taxBody(raw.tax, current);
    if (taxErrors(tax, current).length > 0) bad();
    apply({ tax });
  }
  if (raw.payments !== undefined) {
    const payments = paymentsBody(raw.payments);
    if (paymentErrors(payments, choicesOf(next).payments).length > 0) bad();
    apply({ payments });
  }
  if (raw.delivery !== undefined) {
    const delivery = deliveryBody(raw.delivery);
    if (deliveryErrors(delivery).length > 0) bad();
    apply({ delivery });
  }
  if (raw.pickup !== undefined) {
    const pickup = pickupBody(raw.pickup);
    if (pickupErrors(pickup).length > 0) bad();
    apply({ pickup });
  }
  if (raw.services !== undefined) {
    apply({ services: servicesBody(raw.services) });
    if (servicesErrors(servicesOf(next), next.modes.delivery.zones.length).length > 0) bad();
  }

  saveBranch(ctx, next);
  const response: BranchSettingsResponse = { settings: settingsOf(next), choices: choicesOf(next) };
  return ok(response);
};

/** POST /admin/branches */
export const createBranch: Handler = async (ctx, { body, headers }) => {
  const account = signedInAccount(ctx, headers);
  const raw = objectBody(body);
  const details = detailsBody(raw.details);
  const copyFrom = str(raw.copyFrom);
  const configs = await ctx.seed.branchConfigs();
  const source = configs.find((b) => b.id === copyFrom) ?? bad();
  if (!(await managedBranches(ctx, account)).some((b) => b.id === source.id)) {
    fail(403, 'forbidden');
  }
  const errors = detailsErrors(
    details,
    configs.map((b) => b.shortName),
  );
  if (errors.length > 0) bad();

  const setup = ctx.db.branchSetup.read();
  // Never reuse an id, even a removed branch's: its orders and settings stay behind it.
  const taken = new Set([
    ...configs.map((b) => b.id),
    ...setup.added.map((a) => a.id),
    ...setup.removed,
    ...Object.keys(setup.saved),
  ]);
  const id = uniqueId(`${details.city} ${details.shortName}`, taken, 'branch');
  const {
    image: _image,
    reopensOn: _reopensOn,
    reopensTomorrow: _reopensTomorrow,
    ...copy
  } = structuredClone(source);
  const branch = withDetails({ ...copy, id, status: 'open' }, details);
  // The source's menu, promotions and floor plan are read from the branch it was built on.
  const copiedFrom = setup.added.find((a) => a.id === source.id)?.copiedFrom ?? source.id;
  ctx.db.branchSetup.write({
    ...setup,
    saved: { ...setup.saved, [id]: branch },
    added: [...setup.added, { id, copiedFrom }],
  });
  // What staff already changed at the source comes along: its floor plan and menu.
  const layout = ctx.db.floorLayouts.read()[source.id];
  if (layout) ctx.db.floorLayouts.write({ ...ctx.db.floorLayouts.read(), [id]: layout });
  const menu = ctx.db.menuChanges.read()[source.id];
  if (menu) ctx.db.menuChanges.write({ ...ctx.db.menuChanges.read(), [id]: menu });

  const created = (await ctx.seed.branches()).find((b) => b.id === id) ?? branch;
  return ok(toAdminBranch(created), 201);
};

/** Whether a branch has orders today still to finish or pay. */
async function hasOpenOrders(ctx: MockContext, branch: Branch): Promise<boolean> {
  const { placed, history } = await branchOrders(ctx, branch);
  const now = new Date(ctx.now());
  const clock = createClock(branch);
  return allOrders(placed, history).some(
    (o) =>
      o.status !== 'cancelled' &&
      isToday(o.placedAt, now, clock) &&
      !(isFinished(o) && amountDue(o) === 0),
  );
}

/** DELETE /admin/branches/:branchId */
export const removeBranch: Handler = async (ctx, { params, headers }) => {
  const branch = await adminBranch(ctx, headers, params.branchId);
  const account = signedInAccount(ctx, headers);
  if ((await managedBranches(ctx, account)).length <= 1) fail(409, 'last_branch');
  if (await hasOpenOrders(ctx, branch)) fail(409, 'branch_in_use');
  const setup = ctx.db.branchSetup.read();
  ctx.db.branchSetup.write({ ...setup, removed: [...setup.removed, branch.id] });
  return ok(undefined, 204);
};
