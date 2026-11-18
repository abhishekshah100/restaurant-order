import type { Branch, OpeningSchedule, PaymentOption, Session, WeekSessions } from '@/types/branch';
import { WEEKDAYS } from '@/types/branch';
import type {
  BranchDetails,
  BranchSettings,
  BranchSettingsChoices,
  DeliverySettings,
  ServicesSettings,
  PaymentChannelSettings,
  PaymentChoices,
  PaymentSettings,
  PickupSettings,
  TaxSettings,
} from '@/types/branchSettings';
import { CURRENCIES, LOCALES, type CurrencyCode, type LocaleCode } from '@/config/masters';
import { REGION_PRESETS } from '@/config/regions';
import { sessionMinutes } from '../branchHours';
import { cleanTaxId, taxIdOf, trimmed } from './checking';
import { withHelp } from './help-page';
import { cleanPhone } from './reading';

/* ---------- Writing ---------- */

/** A maps search for an address (a plain link, opened in the guest's maps app). */
const mapUrlFor = (address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;

/**
 * The branch in a country, time zone, locale and currency. Another country brings its phone
 * rules, taxes and payment methods (config/regions); prices keep their numbers.
 */
export function withRegion(
  branch: Branch,
  {
    country,
    timezone,
    locale,
    currency,
  }: Pick<BranchDetails, 'country' | 'timezone' | 'locale' | 'currency'>,
): Branch {
  const { localeFallback: _fallback, ...rest } = branch;
  const money = CURRENCIES[currency as CurrencyCode];
  const fallback: string | undefined = (LOCALES[locale as LocaleCode] as { fallback?: string })
    .fallback;
  let next: Branch = {
    ...rest,
    country,
    timezone,
    locale,
    ...(fallback ? { localeFallback: fallback } : {}),
    currency: {
      code: currency,
      symbol: money.symbol,
      minorUnit: money.minorUnit,
      nameKey: money.nameKey,
    },
  };
  if (country !== branch.country) {
    const preset = structuredClone(REGION_PRESETS[country]);
    next = {
      ...next,
      mobile: preset.mobile,
      tax: preset.tax,
      payments: {
        checkout: preset.payments.checkout,
        bill: preset.payments.bill,
        atTable: preset.payments.atTable,
      },
      modes: {
        ...next.modes,
        takeaway: { ...next.modes.takeaway, payments: preset.payments.takeaway },
        delivery: { ...next.modes.delivery, payments: preset.payments.delivery },
      },
    };
  }
  return next;
}

export function withServices(branch: Branch, s: ServicesSettings): Branch {
  return {
    ...branch,
    modes: {
      dineIn: { ...branch.modes.dineIn, enabled: s.dineIn },
      takeaway: { ...branch.modes.takeaway, enabled: s.takeaway },
      delivery: { ...branch.modes.delivery, enabled: s.delivery },
    },
    ordering: { ...branch.ordering, guestChanges: s.guestChanges },
  };
}

export function withDetails(branch: Branch, d: BranchDetails): Branch {
  const phone = cleanPhone(d.phone);
  const address = trimmed(d.address);
  return {
    ...withRegion(branch, d),
    name: trimmed(d.name),
    shortName: trimmed(d.shortName),
    city: trimmed(d.city),
    address,
    mapUrl: address === branch.address ? branch.mapUrl : mapUrlFor(address),
    phone,
    wifiName: trimmed(d.wifiName),
    // Left out: the branch keeps its photo; null removes it.
    image: d.image === undefined ? branch.image : (d.image ?? undefined),
  };
}

/** Sessions tidied: names trimmed (none when blank), earliest first. */
const tidySessions = (sessions: readonly Session[]): Session[] =>
  sessions
    .map(({ label, opens, closes }) => {
      const name = label?.trim();
      return { ...(name ? { label: name } : {}), opens, closes };
    })
    .sort((a, b) => sessionMinutes(a).opens - sessionMinutes(b).opens);

const tidyWeek = (week: WeekSessions): WeekSessions =>
  Object.fromEntries(WEEKDAYS.map((d) => [d, tidySessions(week[d])])) as WeekSessions;

function withHours(branch: Branch, s: OpeningSchedule): Branch {
  return {
    ...branch,
    schedule: {
      days: tidyWeek(s.days),
      lastOrdersMinutes: s.lastOrdersMinutes,
      takeaway: s.takeaway ? tidyWeek(s.takeaway) : null,
      delivery: s.delivery ? tidyWeek(s.delivery) : null,
      specialDays: s.specialDays
        .map((d) => {
          const name = d.label?.trim();
          return {
            from: d.from,
            to: d.to,
            ...(name ? { label: name } : {}),
            sessions: tidySessions(d.sessions),
          };
        })
        .sort((a, b) => a.from.localeCompare(b.from)),
    },
  };
}

/** Splits a rate into equal parts; the first takes any odd basis point (they add up to it). */
export function splitRate(rateBp: number, parts: number): number[] {
  const share = Math.floor(rateBp / parts);
  return [rateBp - share * (parts - 1), ...Array.from({ length: parts - 1 }, () => share)];
}

/**
 * What bills are called and their one-line summary under these settings, as the server words
 * them: the region's with tax; without, "Bill of supply" (India) or "Bill", and the summary
 * names only what's left (the service charge, the round-off). The registration number with them.
 */
export function taxWording(
  country: string,
  t: Pick<TaxSettings, 'enabled' | 'taxId' | 'serviceChargeBp'>,
): Pick<Branch['tax'], 'compactLabelKey' | 'invoiceKey' | 'taxId' | 'taxIdKey'> {
  const region = REGION_PRESETS[country as keyof typeof REGION_PRESETS]?.tax;
  const taxId = cleanTaxId(t.taxId);
  return {
    ...(t.enabled && region
      ? { compactLabelKey: region.compactLabelKey, invoiceKey: region.invoiceKey }
      : {
          compactLabelKey: t.serviceChargeBp !== null ? 'serviceOnly' : 'roundOff',
          invoiceKey: country === 'IN' ? 'billOfSupply' : 'bill',
        }),
    ...(taxId ? { taxId } : {}),
    taxIdKey: taxIdOf(country).key,
  };
}

export function withTax(branch: Branch, t: TaxSettings): Branch {
  const { tax } = branch;
  const { serviceCharge: _old, taxId: _oldId, ...rest } = tax;
  return {
    ...branch,
    tax: {
      ...rest,
      ...(t.serviceChargeBp !== null
        ? { serviceCharge: { labelKey: 'serviceCharge', rateBp: t.serviceChargeBp } }
        : {}),
      discountBeforeTax: t.discountBeforeTax,
      // From the settings' own lines: the branch's are none while it doesn't charge tax.
      lines: (t.enabled ? t.lines : []).map((line) => {
        const rates = line.parts ? splitRate(line.rateBp, line.parts.length) : [];
        return {
          id: line.id,
          labelKey: line.labelKey,
          rateBp: line.rateBp,
          base: line.base,
          ...(line.parts
            ? { splitInto: line.parts.map((p, j) => ({ ...p, rateBp: rates[j] })) }
            : {}),
        };
      }),
      ...taxWording(branch.country, t),
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

function withDelivery(branch: Branch, d: DeliverySettings): Branch {
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
  if (patch.help) next = withHelp(next, patch.help);
  if (patch.services) next = withServices(next, patch.services);
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
