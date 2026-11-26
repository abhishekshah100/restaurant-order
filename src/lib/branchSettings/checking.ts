import type {
  AtTableMethodKey,
  DeliveryZone,
  OpeningSchedule,
  Session,
  TaxIdKey,
} from '@/types/branch';
import { WEEKDAYS } from '@/types/branch';
import type {
  BranchDetails,
  DeliverySettings,
  ServicesSettings,
  PaymentChoices,
  PaymentQr,
  PaymentSettings,
  PickupSettings,
  TaxSettings,
} from '@/types/branchSettings';
import { PAYMENT_CHANNELS } from '@/types/branchSettings';
import { isMasterValue, isTimeZone } from '@/config/masters';
import { ORDER_MODES } from '../fulfilment';
import { isCloseTime, isTime, sessionMinutes } from '../branchHours';
import { cleanPhone, dialCodeOf } from './reading';
import { LIMITS, SLOT_MINUTES, type SettingsError } from './shared';

/* ---------- Checking ---------- */

export const trimmed = (v: string) => v.trim();
const isWhole = (v: number, min: number, max: number) =>
  Number.isInteger(v) && v >= min && v <= max;
/** A price in major units: 0 or more, at most two decimals. */
const isMoney = (v: unknown): v is number =>
  typeof v === 'number' &&
  Number.isFinite(v) &&
  v >= 0 &&
  v <= LIMITS.money &&
  Math.abs(Math.round(v * 100) - v * 100) < 1e-6;

function textErrors(
  value: string,
  max: number,
  required: SettingsError | null,
  long: SettingsError,
): SettingsError[] {
  const v = trimmed(value);
  if (required && !v) return [required];
  return v.length > max ? [long] : [];
}

/**
 * Problems with a branch's details: the phone must start with its country's code ("+977");
 * `otherShortNames` (the other branches') mustn't include its short name; the country, time
 * zone, locale and currency must be ones the app knows.
 */
export function detailsErrors(
  d: BranchDetails,
  otherShortNames: readonly string[] = [],
): SettingsError[] {
  const phone = cleanPhone(d.phone);
  const dialCode = dialCodeOf(d.country);
  const taken = otherShortNames.some(
    (n) => n.trim().toLowerCase() === d.shortName.trim().toLowerCase(),
  );
  return [
    ...textErrors(d.name, LIMITS.name, 'nameRequired', 'nameLong'),
    ...textErrors(d.shortName, LIMITS.shortName, 'shortNameRequired', 'shortNameLong'),
    ...(taken ? (['shortNameTaken'] as const) : []),
    ...textErrors(d.city, LIMITS.city, 'cityRequired', 'cityLong'),
    ...textErrors(d.address, LIMITS.address, 'addressRequired', 'addressLong'),
    ...(!/^\+\d{8,15}$/.test(phone)
      ? (['phoneInvalid'] as const)
      : !phone.startsWith(dialCode)
        ? (['phoneRegion'] as const)
        : []),
    ...textErrors(d.wifiName, LIMITS.wifiName, null, 'wifiLong'),
    ...(!dialCode ? (['country'] as const) : []),
    ...(!isTimeZone(d.timezone) ? (['timezone'] as const) : []),
    ...(!isMasterValue('locales', d.locale) ? (['locale'] as const) : []),
    ...(!isMasterValue('currencies', d.currency) ? (['currency'] as const) : []),
    ...(d.orderPrefix !== undefined && !/^[A-Z]{1,5}$/.test(d.orderPrefix)
      ? (['orderPrefix'] as const)
      : []),
    ...(d.orderStart !== undefined && !isWhole(d.orderStart, 1, LIMITS.orderStart)
      ? (['orderStart'] as const)
      : []),
  ];
}

/** An order's code as the branch's settings make it: ("BLR", 1) → "BLR-001". */
export const orderCodeOf = (prefix: string, number: number): string =>
  `${prefix}-${String(number).padStart(3, '0')}`;

/** At least one way to order; delivery only with a zone to deliver to. */
export function servicesErrors(s: ServicesSettings, deliveryZones: number): SettingsError[] {
  return [
    ...(!ORDER_MODES.some((m) => s[m]) ? (['noService'] as const) : []),
    ...(s.delivery && deliveryZones === 0 ? (['deliveryNeedsZones'] as const) : []),
  ];
}

/**
 * What's wrong with some days of sessions (a week, or a special date's day repeated): times,
 * overlaps (a session past midnight runs into the next day's first), how many a day, names, and
 * sessions shorter than last orders.
 */
function sessionsErrors(days: readonly (readonly Session[])[], lastOrders: number, wraps: boolean) {
  const errors = new Set<SettingsError>();
  if (days.some((sessions) => sessions.length > LIMITS.sessionsPerDay))
    errors.add('tooManySessions');
  const all = days.flat();
  if (all.some((x) => (x.label?.trim().length ?? 0) > LIMITS.sessionLabel)) {
    errors.add('sessionLabel');
  }
  if (!all.every((x) => isTime(x.opens) && isCloseTime(x.closes))) {
    errors.add('sessionTime');
    return errors;
  }
  // Each day's sessions in order, in minutes after its midnight (past midnight beyond 1440).
  const week = days.map((sessions) =>
    sessions.map((x) => sessionMinutes(x)).sort((a, b) => a.opens - b.opens),
  );
  const overlaps = week.some((sessions, i) => {
    const next = wraps || i + 1 < week.length ? week[(i + 1) % week.length][0] : undefined;
    return sessions.some((x, j) => {
      const after = sessions[j + 1];
      return after ? x.closes > after.opens : next !== undefined && x.closes - 1440 > next.opens;
    });
  });
  if (overlaps) errors.add('sessionOverlap');
  if (week.flat().some((x) => lastOrders >= x.closes - x.opens)) errors.add('lastOrders');
  return errors;
}

/** "2026-11-08", a real calendar day. */
function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1, d));
  return at.getUTCFullYear() === y && at.getUTCMonth() === m - 1 && at.getUTCDate() === d;
}

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

export function hoursErrors(s: OpeningSchedule): SettingsError[] {
  const errors = new Set<SettingsError>();
  if (WEEKDAYS.every((d) => s.days[d].length === 0)) errors.add('noOpenDay');
  if (!isWhole(s.lastOrdersMinutes, 0, LIMITS.lastOrdersMinutes)) errors.add('lastOrders');
  const lead = s.lastOrdersMinutes;
  // The opening hours, and takeaway's and delivery's own weeks (which may be closed all week).
  for (const week of [s.days, s.takeaway, s.delivery]) {
    if (week)
      sessionsErrors(
        WEEKDAYS.map((d) => week[d]),
        lead,
        true,
      ).forEach((e) => errors.add(e));
  }
  if (s.specialDays.length > LIMITS.specialDays) errors.add('tooManySpecialDays');
  if (s.specialDays.some((d) => (d.label?.trim().length ?? 0) > LIMITS.specialLabel)) {
    errors.add('specialLabel');
  }
  const dated = s.specialDays.every(
    (d) =>
      isDate(d.from) &&
      isDate(d.to) &&
      d.from <= d.to &&
      daysBetween(d.from, d.to) < LIMITS.specialSpan,
  );
  if (!dated) errors.add('specialDates');
  else {
    const sorted = [...s.specialDays].sort((a, b) => a.from.localeCompare(b.from));
    if (sorted.some((d, i) => i > 0 && d.from <= sorted[i - 1].to)) errors.add('specialOverlap');
  }
  for (const d of s.specialDays) {
    // A range repeats its day: a session past midnight runs into the next day's first.
    const span = isDate(d.from) && isDate(d.to) && d.from < d.to;
    sessionsErrors([d.sessions], lead, span).forEach((e) => errors.add(e));
  }
  return [...errors];
}

/** `current`: the branch's tax lines now (staff change their rates, not which there are). */
/**
 * A country's tax registration number: GSTIN in India (state code, PAN, entity number, Z, check
 * character: "29ABCDE1234F1Z5"), PAN in Nepal (nine digits, the VAT number too); elsewhere 5–20
 * letters, digits and dashes. The server checks the same.
 */
const TAX_IDS: Record<string, { key: TaxIdKey; pattern: RegExp }> = {
  IN: { key: 'gstin', pattern: /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/ },
  NP: { key: 'pan', pattern: /^\d{9}$/ },
};
export const taxIdOf = (country: string) =>
  TAX_IDS[country] ?? { key: 'taxId' as const, pattern: /^[A-Z0-9-]{5,20}$/ };

/** A registration number as stored: capitals, no spaces. */
export const cleanTaxId = (value: string) => value.replace(/\s+/g, '').toUpperCase();

export function taxErrors(t: TaxSettings, current: TaxSettings, country = ''): SettingsError[] {
  const errors: SettingsError[] = [];
  if (t.taxId && !taxIdOf(country).pattern.test(cleanTaxId(t.taxId))) errors.push('taxId');
  // What tax invoices print (the server's own fields: the mock has none).
  if (t.legalName && t.legalName.trim().length > 120) errors.push('legalName');
  if (t.sacCode && !/^\d{4,8}$/.test(t.sacCode.replace(/\s+/g, ''))) errors.push('sacCode');
  if (t.fssai && !/^\d{14}$/.test(t.fssai.replace(/\s+/g, ''))) errors.push('fssai');
  if (t.invoicePrefix && !/^[A-Z]{1,5}$/.test(t.invoicePrefix.trim().toUpperCase())) {
    errors.push('invoicePrefix');
  }
  const sameLines =
    t.lines.length === current.lines.length &&
    t.lines.every((l, i) => l.id === current.lines[i].id);
  if (!sameLines) errors.push('taxLines');
  if (t.lines.some((l) => !isWhole(l.rateBp, 0, LIMITS.taxBp))) errors.push('taxRate');
  if (t.serviceChargeBp !== null && !isWhole(t.serviceChargeBp, 1, LIMITS.serviceBp)) {
    errors.push('serviceRate');
  }
  return errors;
}

export function paymentErrors(p: PaymentSettings, choices: PaymentChoices): SettingsError[] {
  const errors = new Set<SettingsError>();
  for (const ch of PAYMENT_CHANNELS) {
    const { methods, recommended } = p[ch];
    const allowed = new Set(choices[ch].map((o) => o.id));
    if (methods.length === 0) errors.add('noMethods');
    if (methods.some((m) => !allowed.has(m)) || new Set(methods).size !== methods.length) {
      errors.add('unknownMethod');
    }
    if (recommended !== null && !methods.includes(recommended)) errors.add('recommended');
  }
  const atTable = new Set(choices.atTable);
  if (p.atTable.length === 0) errors.add('noAtTable');
  if (p.atTable.some((m) => !atTable.has(m)) || new Set(p.atTable).size !== p.atTable.length) {
    errors.add('unknownMethod');
  }
  return [...errors];
}

/**
 * Payment QR codes: each for a way to pay staff that takes one, once, with a short line under it
 * (the picture is the server's to check).
 */
export function paymentQrErrors(
  qrs: readonly PaymentQr[],
  methods: readonly AtTableMethodKey[],
): SettingsError[] {
  const errors = new Set<SettingsError>();
  const seen = new Set<string>();
  for (const qr of qrs) {
    if (!methods.includes(qr.method) || seen.has(qr.method)) errors.add('qrMethod');
    seen.add(qr.method);
    if (qr.note.trim().length > LIMITS.qrNote) errors.add('qrNote');
  }
  return [...errors];
}

/** Areas are told apart in any case and spacing: "HAL 2nd stage" is "Hal 2nd Stage". */
const areaKey = (area: string) => area.trim().replace(/\s+/g, ' ').toLowerCase();

/** Problems with one zone (its name and areas against the other zones'). */
export function zoneErrors(zone: DeliveryZone, others: readonly DeliveryZone[]): SettingsError[] {
  const errors: SettingsError[] = [];
  const name = zone.name.trim();
  if (!name || name.length > LIMITS.zoneName) errors.push('zoneName');
  else if (others.some((z) => z.name.trim().toLowerCase() === name.toLowerCase())) {
    errors.push('zoneNameTaken');
  }
  if (zone.areas.length === 0) errors.push('noAreas');
  else if (
    zone.areas.length > LIMITS.areas ||
    zone.areas.some((a) => !a.trim() || a.trim().length > LIMITS.areaName)
  ) {
    errors.push('areaName');
  } else {
    const keys = zone.areas.map(areaKey);
    const elsewhere = new Set(others.flatMap((z) => z.areas.map(areaKey)));
    if (new Set(keys).size !== keys.length || keys.some((k) => elsewhere.has(k))) {
      errors.push('areaTaken');
    }
  }
  if (!isMoney(zone.fee) || !isMoney(zone.minOrder)) errors.push('money');
  if (zone.freeAbove !== undefined && (!isMoney(zone.freeAbove) || zone.freeAbove <= 0)) {
    errors.push('freeAbove');
  }
  if (!isWhole(zone.etaMinutes, 5, LIMITS.etaMinutes)) errors.push('eta');
  return errors;
}

export function deliveryErrors(d: DeliverySettings): SettingsError[] {
  const errors = new Set<SettingsError>();
  if (d.enabled && d.zones.length === 0) errors.add('noZones');
  if (d.zones.length > LIMITS.zones) errors.add('tooManyZones');
  d.zones.forEach((zone, i) => {
    for (const e of zoneErrors(
      zone,
      d.zones.filter((_, j) => j !== i),
    ))
      errors.add(e);
  });
  if (!isWhole(d.prepMinutes, 0, LIMITS.prepMinutes)) errors.add('prepMinutes');
  if (d.maxDistanceKm !== undefined && !isWhole(d.maxDistanceKm, 1, LIMITS.distanceKm)) {
    errors.add('distance');
  }
  return [...errors];
}

export function pickupErrors(p: PickupSettings): SettingsError[] {
  return [
    ...(!isWhole(p.prepMinutes, 5, LIMITS.prepMinutes) ? (['prepMinutes'] as const) : []),
    ...(!SLOT_MINUTES.some((m) => m === p.slotMinutes) ? (['slotMinutes'] as const) : []),
    ...(!isMoney(p.minOrder) ? (['money'] as const) : []),
  ];
}
