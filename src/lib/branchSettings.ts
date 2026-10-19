import type { Branch, DeliveryZone, OpeningSchedule, PaymentOption } from '@/types/branch';
import { WEEKDAYS } from '@/types/branch';
import type {
  BranchDetails,
  BranchSettings,
  BranchSettingsChoices,
  DeliverySettings,
  PaymentChannelSettings,
  PaymentChoices,
  PaymentSettings,
  PickupSettings,
  TaxSettings,
} from '@/types/branchSettings';
import { PAYMENT_CHANNELS } from '@/types/branchSettings';
import { isTime, openMinutes, toMinutes } from './branchHours';

/*
 * A branch's settings (Settings › Branch details, Opening hours, Tax & service charge, Payment
 * methods, Delivery zones, Pickup): reading them off the branch, checking a draft (the pages
 * show the first problem; the server refuses the same with 400), and writing them back onto the
 * branch. Pure, so the pages and the mock server share them.
 */

export const LIMITS = {
  name: 60,
  shortName: 30,
  city: 40,
  address: 160,
  wifiName: 40,
  tableLocation: 60,
  windowLabel: 30,
  windows: 6,
  lastOrdersMinutes: 180,
  /** Tax and service rates, in basis points: 50%. */
  taxBp: 5000,
  serviceBp: 3000,
  zones: 20,
  zoneName: 40,
  areas: 30,
  areaName: 40,
  money: 1_000_000,
  etaMinutes: 240,
  prepMinutes: 180,
  distanceKm: 100,
} as const;

/** Minutes between pickup slots staff can choose. */
export const SLOT_MINUTES = [10, 15, 20, 30, 45, 60] as const;

/** Every problem a settings page can have; each has its words (common › adminSettings.errors). */
export type SettingsError =
  | 'nameRequired'
  | 'nameLong'
  | 'shortNameRequired'
  | 'shortNameLong'
  | 'shortNameTaken'
  | 'cityRequired'
  | 'cityLong'
  | 'addressRequired'
  | 'addressLong'
  | 'phoneInvalid'
  | 'phoneRegion'
  | 'wifiLong'
  | 'tableLocationLong'
  | 'noOpenDay'
  | 'dayTime'
  | 'dayOrder'
  | 'lastOrders'
  | 'windowLabel'
  | 'windowLabelTaken'
  | 'windowTime'
  | 'windowOrder'
  | 'tooManyWindows'
  | 'taxRate'
  | 'serviceRate'
  | 'taxLines'
  | 'noMethods'
  | 'unknownMethod'
  | 'recommended'
  | 'noAtTable'
  | 'noZones'
  | 'tooManyZones'
  | 'zoneName'
  | 'zoneNameTaken'
  | 'noAreas'
  | 'areaName'
  | 'areaTaken'
  | 'money'
  | 'freeAbove'
  | 'eta'
  | 'prepMinutes'
  | 'distance'
  | 'slotMinutes';

/* ---------- Reading ---------- */

/** "+91 98263 14093" → "+919826314093". */
export const cleanPhone = (phone: string) => phone.replace(/[\s()-]/g, '');

export function detailsOf(branch: Branch): BranchDetails {
  const { name, shortName, city, address, phone, wifiName, tableLocation } = branch;
  return { name, shortName, city, address, phone, wifiName, tableLocation };
}

export function taxOf({ tax }: Pick<Branch, 'tax'>): TaxSettings {
  return {
    serviceChargeBp: tax.serviceCharge?.rateBp ?? null,
    lines: tax.lines.map((line) => ({
      id: line.id,
      labelKey: line.labelKey,
      rateBp: line.rateBp,
      base: line.base,
      ...(line.splitInto
        ? { parts: line.splitInto.map(({ id, labelKey }) => ({ id, labelKey })) }
        : {}),
    })),
    discountBeforeTax: tax.discountBeforeTax,
    roundTotal: tax.rounding.showRoundOff && tax.rounding.unit > 1,
  };
}

const channel = (options: readonly PaymentOption<string>[]): PaymentChannelSettings => ({
  methods: options.map((o) => o.id),
  recommended: options.find((o) => o.recommended)?.id ?? null,
});

export function paymentsOf(branch: Pick<Branch, 'payments' | 'modes'>): PaymentSettings {
  return {
    checkout: channel(branch.payments.checkout),
    bill: channel(branch.payments.bill),
    takeaway: channel(branch.modes.takeaway.payments),
    delivery: channel(branch.modes.delivery.payments),
    atTable: [...branch.payments.atTable],
  };
}

export function deliveryOf({ modes }: Pick<Branch, 'modes'>): DeliverySettings {
  const { payments: _payments, ...delivery } = modes.delivery;
  return structuredClone(delivery);
}

export function pickupOf({ modes }: Pick<Branch, 'modes'>): PickupSettings {
  const { payments: _payments, ...pickup } = modes.takeaway;
  return { ...pickup };
}

export function settingsOf(branch: Branch): BranchSettings {
  return {
    details: detailsOf(branch),
    hours: structuredClone(branch.schedule),
    tax: taxOf(branch),
    payments: paymentsOf(branch),
    delivery: deliveryOf(branch),
    pickup: pickupOf(branch),
  };
}

/**
 * The methods a branch can offer on each screen: the ones its region was set up with (the
 * published branch, or the one a new branch was copied from), so labels always match.
 */
export function paymentChoicesOf(base: Pick<Branch, 'payments' | 'modes'>): PaymentChoices {
  const plain = <K extends string>(options: readonly PaymentOption<K>[]) =>
    options.map(({ id, labelKey }) => ({ id, labelKey }));
  return {
    checkout: plain(base.payments.checkout),
    bill: plain(base.payments.bill),
    takeaway: plain(base.modes.takeaway.payments),
    delivery: plain(base.modes.delivery.payments),
    atTable: [...base.payments.atTable],
  };
}

/* ---------- Checking ---------- */

const trimmed = (v: string) => v.trim();
const isWhole = (v: number, min: number, max: number) =>
  Number.isInteger(v) && v >= min && v <= max;
/** A price in major units: 0 or more, at most two decimals. */
export const isMoney = (v: unknown): v is number =>
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
 * Problems with a branch's details. `dialCode`: the region's ("+977"), which the phone must
 * start with; `otherShortNames`: the other branches', which the short name mustn't repeat.
 */
export function detailsErrors(
  d: BranchDetails,
  dialCode: string,
  otherShortNames: readonly string[] = [],
): SettingsError[] {
  const phone = cleanPhone(d.phone);
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
    ...textErrors(d.tableLocation, LIMITS.tableLocation, null, 'tableLocationLong'),
  ];
}

export function hoursErrors(s: OpeningSchedule): SettingsError[] {
  const errors: SettingsError[] = [];
  const open = WEEKDAYS.map((d) => s.days[d]).filter((d) => d.open);
  if (open.length === 0) errors.push('noOpenDay');
  if (open.some((d) => !isTime(d.opens) || !isTime(d.closes))) errors.push('dayTime');
  else if (open.some((d) => toMinutes(d.closes) <= toMinutes(d.opens))) errors.push('dayOrder');
  else if (
    !isWhole(s.lastOrdersMinutes, 0, LIMITS.lastOrdersMinutes) ||
    open.some((d) => s.lastOrdersMinutes >= openMinutes(d))
  ) {
    errors.push('lastOrders');
  }
  if (s.windows.length > LIMITS.windows) errors.push('tooManyWindows');
  const labels = s.windows.map((w) => w.label.trim().toLowerCase());
  if (labels.some((l) => !l || l.length > LIMITS.windowLabel)) errors.push('windowLabel');
  else if (new Set(labels).size !== labels.length) errors.push('windowLabelTaken');
  if (s.windows.some((w) => !isTime(w.from) || !isTime(w.to))) errors.push('windowTime');
  else if (s.windows.some((w) => toMinutes(w.to) <= toMinutes(w.from))) errors.push('windowOrder');
  return errors;
}

/** `current`: the branch's tax lines now (staff change their rates, not which there are). */
export function taxErrors(t: TaxSettings, current: TaxSettings): SettingsError[] {
  const errors: SettingsError[] = [];
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

/** Areas are told apart in any case and spacing: "HAL 2nd stage" is "Hal 2nd Stage". */
export const areaKey = (area: string) => area.trim().replace(/\s+/g, ' ').toLowerCase();

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

/* ---------- Writing ---------- */

/** A maps search for an address (a plain link, opened in the guest's maps app). */
export const mapUrlFor = (address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;

export function withDetails(branch: Branch, d: BranchDetails): Branch {
  const phone = cleanPhone(d.phone);
  const address = trimmed(d.address);
  return {
    ...branch,
    name: trimmed(d.name),
    shortName: trimmed(d.shortName),
    city: trimmed(d.city),
    address,
    mapUrl: address === branch.address ? branch.mapUrl : mapUrlFor(address),
    phone,
    phoneHref: `tel:${phone}`,
    wifiName: trimmed(d.wifiName),
    tableLocation: trimmed(d.tableLocation),
  };
}

export function withHours(branch: Branch, s: OpeningSchedule): Branch {
  return {
    ...branch,
    schedule: {
      days: Object.fromEntries(
        WEEKDAYS.map((d) => [d, { ...s.days[d] }]),
      ) as OpeningSchedule['days'],
      lastOrdersMinutes: s.lastOrdersMinutes,
      windows: s.windows.map((w) => ({ label: w.label.trim(), from: w.from, to: w.to })),
    },
  };
}

/** Splits a rate into equal parts; the first takes any odd basis point (they add up to it). */
export function splitRate(rateBp: number, parts: number): number[] {
  const share = Math.floor(rateBp / parts);
  return [rateBp - share * (parts - 1), ...Array.from({ length: parts - 1 }, () => share)];
}

export function withTax(branch: Branch, t: TaxSettings): Branch {
  const { tax } = branch;
  const { serviceCharge: _old, ...rest } = tax;
  return {
    ...branch,
    tax: {
      ...rest,
      ...(t.serviceChargeBp !== null
        ? { serviceCharge: { labelKey: 'serviceCharge', rateBp: t.serviceChargeBp } }
        : {}),
      discountBeforeTax: t.discountBeforeTax,
      lines: tax.lines.map((line, i) => {
        const next = t.lines[i];
        const rates = line.splitInto ? splitRate(next.rateBp, line.splitInto.length) : [];
        return {
          ...line,
          rateBp: next.rateBp,
          base: next.base,
          ...(line.splitInto
            ? { splitInto: line.splitInto.map((p, j) => ({ ...p, rateBp: rates[j] })) }
            : {}),
        };
      }),
      rounding: t.roundTotal
        ? { unit: branch.currency.minorUnit, showRoundOff: true }
        : { unit: 1, showRoundOff: false },
    },
  };
}

/** A channel's methods as the screens list them: labelled from the choices, in staff's order. */
const optionsFor = <K extends string>(
  settings: PaymentChannelSettings,
  choices: readonly PaymentOption<K>[],
): PaymentOption<K>[] =>
  settings.methods.flatMap((id) => {
    const choice = choices.find((c) => c.id === id);
    if (!choice) return [];
    return [
      {
        id,
        labelKey: choice.labelKey,
        ...(settings.recommended === id ? { recommended: true } : {}),
      },
    ];
  });

export function withPayments(branch: Branch, p: PaymentSettings, choices: PaymentChoices): Branch {
  return {
    ...branch,
    payments: {
      checkout: optionsFor(p.checkout, choices.checkout),
      bill: optionsFor(p.bill, choices.bill),
      atTable: [...p.atTable],
    },
    modes: {
      ...branch.modes,
      takeaway: { ...branch.modes.takeaway, payments: optionsFor(p.takeaway, choices.takeaway) },
      delivery: { ...branch.modes.delivery, payments: optionsFor(p.delivery, choices.delivery) },
    },
  };
}

export function withDelivery(branch: Branch, d: DeliverySettings): Branch {
  return {
    ...branch,
    modes: {
      ...branch.modes,
      delivery: {
        enabled: d.enabled,
        prepMinutes: d.prepMinutes,
        ...(d.maxDistanceKm !== undefined ? { maxDistanceKm: d.maxDistanceKm } : {}),
        feeTaxable: d.feeTaxable,
        zones: d.zones.map((z) => ({
          id: z.id,
          name: z.name.trim(),
          areas: z.areas.map((a) => a.trim().replace(/\s+/g, ' ')),
          fee: z.fee,
          ...(z.freeAbove !== undefined ? { freeAbove: z.freeAbove } : {}),
          minOrder: z.minOrder,
          etaMinutes: z.etaMinutes,
        })),
        payments: branch.modes.delivery.payments,
      },
    },
  };
}

export function withPickup(branch: Branch, p: PickupSettings): Branch {
  return {
    ...branch,
    modes: {
      ...branch.modes,
      takeaway: {
        enabled: p.enabled,
        prepMinutes: p.prepMinutes,
        minOrder: p.minOrder,
        asap: p.asap,
        slotMinutes: p.slotMinutes,
        payments: branch.modes.takeaway.payments,
      },
    },
  };
}

/** The branch with some sections of its settings replaced (each already checked). */
export function applySettings(
  branch: Branch,
  patch: Partial<BranchSettings>,
  choices: BranchSettingsChoices,
): Branch {
  let next = branch;
  if (patch.details) next = withDetails(next, patch.details);
  if (patch.hours) next = withHours(next, patch.hours);
  if (patch.tax) next = withTax(next, patch.tax);
  if (patch.payments) next = withPayments(next, patch.payments, choices.payments);
  if (patch.delivery) next = withDelivery(next, patch.delivery);
  if (patch.pickup) next = withPickup(next, patch.pickup);
  return next;
}

/** The same settings (a draft with nothing changed). */
export const sameSettings = <T>(a: T, b: T) => JSON.stringify(a) === JSON.stringify(b);

/** "Koramangala & Ulsoor" → "koramangala-ulsoor"; `base-2`, `base-3`… when taken. */
export function uniqueId(name: string, taken: ReadonlySet<string>, fallback = 'item'): string {
  const base =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || fallback;
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}
