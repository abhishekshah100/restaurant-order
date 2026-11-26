import type {
  BillingCycle,
  ClientDetail,
  ClientSummary,
  PackagePlan,
  FeatureGroup,
  FeatureInfo,
  PlanLimit,
  PlanLimits,
  UpdateClientRequest,
} from '@/api/contracts';

/*
 * The platform console's helpers (restaurant-backend › ADR-051; its key is the developer setup's,
 * kept by lib/devSetup): the owner's name for the history, a client's editable copy and what saving it sends, and what a
 * downgrade means for the client.
 */

const NAME_STORAGE = 'olive.platformName';

function read(storage: () => Storage, name: string): string | null {
  try {
    return storage().getItem(name);
  } catch {
    return null;
  }
}

function write(storage: () => Storage, name: string, value: string | null): void {
  try {
    if (value) storage().setItem(name, value);
    else storage().removeItem(name);
  } catch {
    // Blocked storage: kept until the page is reloaded.
  }
}

/** The name the owner gave, kept on this device for the next visit. */
export const savedPlatformName = () => read(() => window.localStorage, NAME_STORAGE);
export const savePlatformName = (name: string | null) =>
  write(() => window.localStorage, NAME_STORAGE, name);

/** How the console groups the feature catalog (FeatureInfo › group), in this order. */
export const FEATURE_GROUP_IDS: FeatureGroup[] = ['essentials', 'advanced', 'services'];

/** The limits, in the console's order, and how far − / + move each. */
export const LIMITS: { id: PlanLimit; step: number }[] = [
  { id: 'staff', step: 1 },
  { id: 'branches', step: 1 },
  { id: 'floors', step: 1 },
  { id: 'tables', step: 5 },
  { id: 'dishes', step: 50 },
  { id: 'reportDays', step: 30 },
];

/** What a client's usage is called for a limit (report history has none). */
export const usageOf = (usage: ClientSummary['usage'], limit: PlanLimit): number | null =>
  limit === 'reportDays' ? null : usage[limit];

/** Features each once (keys of the catalog; shown in its order by `byCatalog`). */
export const inOrder = (features: readonly string[]) => [...new Set(features)];

/** Features in the catalog's order (those it doesn't have left out). */
export const byCatalog = (features: readonly string[], catalog: readonly FeatureInfo[]) =>
  catalog.filter((f) => features.includes(f.key));

/**
 * A package's price for a client (as the server works it out): the cycle's price, plus each
 * branch after the first where the package charges for them (half-yearly: in proportion, to the
 * nearest 100). Null: on request.
 */
export function listPriceOf(pkg: PackagePlan, cycle: BillingCycle, branches: number) {
  const { yearly, halfYearly, extraBranch } = pkg.prices;
  const base = cycle === 'yearly' ? yearly : halfYearly;
  if (base === null) return null;
  const extra = extraBranch ?? 0;
  const perBranch =
    cycle === 'yearly' || !yearly
      ? extra
      : Math.round((extra * (halfYearly ?? 0)) / yearly / 100) * 100;
  return base + perBranch * Math.max(branches - 1, 0);
}

/* ---------- Money and dates ---------- */

/** "Rs 9,000" (whole rupees, Nepali/Indian grouping). */
export const rupees = (amount: number) => `Rs ${amount.toLocaleString('en-IN')}`;

const pad = (n: number) => String(n).padStart(2, '0');

/** An ISO time as a date field shows it, on this device's calendar ('' for none). */
export function dateField(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A date field's day as the end of that day on this device (the plan runs through it). */
export function endOfDay(field: string): string | null {
  if (!field) return null;
  const [y, m, d] = field.split('-').map(Number);
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1, 23, 59, 59).toISOString();
}

/** A date field's day as its start on this device (a term starts that morning). */
export function startOfDay(field: string): string | null {
  if (!field) return null;
  const [y, m, d] = field.split('-').map(Number);
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1).toISOString();
}

/** `days` after the field's day, or after today when it's empty or already past. */
export function addDays(field: string, days: number, today: Date): string {
  const base = field ? new Date(`${field}T12:00:00`) : today;
  const from = base < today ? today : base;
  const next = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
  return `${String(next.getFullYear())}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
}

/** A term of one cycle from the field's day: a year, or six months (the day before). */
export function termEnd(start: string, cycle: BillingCycle): string {
  if (!start) return '';
  const [y, m, d] = start.split('-').map(Number);
  const end = new Date(y ?? 0, (m ?? 1) - 1 + (cycle === 'yearly' ? 12 : 6), (d ?? 1) - 1);
  return `${String(end.getFullYear())}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
}

/**
 * Where a payment recorded on `paidOn` (a date field) takes the paid term, as the server works it
 * out: one cycle on from its end while it still runs, else from the day paid.
 */
export function nextTermEnd(paidUntil: string | null, paidOn: string, cycle: BillingCycle): string {
  const paid = new Date(`${paidOn}T12:00:00`);
  const end = paidUntil ? new Date(paidUntil) : null;
  const from = end && end > paid ? end : paid;
  const to = new Date(from);
  const day = to.getDate();
  to.setDate(1);
  to.setMonth(to.getMonth() + (cycle === 'yearly' ? 12 : 6));
  to.setDate(Math.min(day, new Date(to.getFullYear(), to.getMonth() + 1, 0).getDate()));
  return to.toISOString();
}

/* ---------- A client's editable copy ---------- */

export interface ClientDraft {
  plan: string;
  billingCycle: BillingCycle;
  limits: PlanLimits;
  features: string[];
  /** Date fields ('YYYY-MM-DD', '' for none). */
  trialEndsAt: string;
  startsAt: string;
  endsAt: string;
  graceDays: number;
  /** As typed ('' for the package's price). */
  price: string;
  priceNote: string;
  contact: ClientDetail['contact'];
  notes: string;
}

export const draftOf = (c: ClientDetail): ClientDraft => ({
  plan: c.plan.code,
  billingCycle: c.billingCycle,
  limits: { ...c.limits },
  features: inOrder(c.features),
  trialEndsAt: dateField(c.trialEndsAt),
  startsAt: dateField(c.startsAt),
  endsAt: dateField(c.paidUntil),
  graceDays: c.graceDays,
  price: c.customPrice === null ? '' : String(c.customPrice),
  priceNote: c.priceNote,
  contact: { ...c.contact },
  notes: c.notes,
});

/** A package picked: its limits and features replace the client's. */
export const withPackage = (draft: ClientDraft, pkg: PackagePlan): ClientDraft => ({
  ...draft,
  plan: pkg.code,
  limits: { ...pkg.limits },
  features: inOrder(pkg.features),
});

/** The typed price: a whole number of rupees, null for the package's, NaN when it isn't one. */
export function priceOf(text: string): number | null {
  const t = text.trim().replace(/,/g, '');
  if (!t) return null;
  return /^\d{1,8}$/.test(t) ? Number(t) : Number.NaN;
}

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

/** What Save sends: only what differs from the client as loaded (null: nothing changed). */
export function changesOf(
  client: ClientDetail,
  draft: ClientDraft,
  by: string,
): UpdateClientRequest | null {
  const before = draftOf(client);
  const body: UpdateClientRequest = { by };
  if (draft.plan !== before.plan) body.plan = draft.plan;
  if (draft.billingCycle !== before.billingCycle) body.billingCycle = draft.billingCycle;
  const limits = Object.fromEntries(
    LIMITS.map(({ id }) => id)
      .filter((id) => draft.limits[id] !== before.limits[id] || body.plan !== undefined)
      .map((id) => [id, draft.limits[id]]),
  );
  if (Object.keys(limits).length) body.limits = limits;
  if (!sameList(draft.features, before.features) || body.plan !== undefined) {
    body.features = draft.features;
  }
  if (draft.trialEndsAt !== before.trialEndsAt) body.trialEndsAt = endOfDay(draft.trialEndsAt);
  if (draft.startsAt !== before.startsAt) body.startsAt = startOfDay(draft.startsAt);
  if (draft.endsAt !== before.endsAt) body.endsAt = endOfDay(draft.endsAt);
  if (draft.graceDays !== before.graceDays) body.graceDays = draft.graceDays;
  if (draft.price.trim() !== before.price) body.price = priceOf(draft.price);
  if (draft.priceNote.trim() !== before.priceNote) body.priceNote = draft.priceNote.trim();
  const contact = Object.fromEntries(
    (Object.keys(draft.contact) as (keyof ClientDraft['contact'])[])
      .filter((k) => draft.contact[k].trim() !== before.contact[k])
      .map((k) => [k, draft.contact[k].trim()]),
  );
  if (Object.keys(contact).length) body.contact = contact;
  if (draft.notes.trim() !== before.notes) body.notes = draft.notes.trim();
  return Object.keys(body).length > 1 ? body : null;
}

/** What a client would lose by these changes: limits under what they have, features off. */
export interface Downgrade {
  over: { limit: PlanLimit; used: number; max: number }[];
  featuresOff: string[];
}

export function downgradeOf(client: ClientDetail, draft: ClientDraft): Downgrade | null {
  const over = LIMITS.flatMap(({ id }) => {
    const used = usageOf(client.usage, id);
    const max = draft.limits[id];
    return used !== null && max !== null && used > max ? [{ limit: id, used, max }] : [];
  });
  const featuresOff = inOrder(client.features.filter((f) => !draft.features.includes(f)));
  return over.length || featuresOff.length ? { over, featuresOff } : null;
}

/* ---------- The list ---------- */

export type ClientFilter =
  'all' | 'trial' | 'active' | 'endingSoon' | 'grace' | 'expired' | 'suspended';

/** Days before the end that count as "ending soon". */
export const ENDING_SOON_DAYS = 15;

export function matchesFilter(c: ClientSummary, filter: ClientFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'endingSoon') {
    return (
      (c.status === 'trial' || c.status === 'active') &&
      c.daysLeft !== null &&
      c.daysLeft <= ENDING_SOON_DAYS
    );
  }
  return c.status === filter;
}

export function matchesSearch(c: ClientSummary, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    c.name.toLowerCase().includes(q) ||
    c.plan.name.toLowerCase().includes(q) ||
    c.branches.some((b) => b.name.toLowerCase().includes(q) || b.id.includes(q))
  );
}
