import type { Branch, PaymentOption } from '@/types/branch';
import type {
  BranchDetails,
  BranchSettings,
  DeliverySettings,
  HelpSettings,
  ServicesSettings,
  PaymentChannelSettings,
  PaymentChoices,
  PaymentSettings,
  PickupSettings,
  TaxSettings,
} from '@/types/branchSettings';
import { isMasterValue } from '@/config/masters';
import { REGION_PRESETS } from '@/config/regions';
import { QR_METHODS } from '@/lib/payments';

/* ---------- Reading ---------- */

/** "+91 98263 14093" → "+919826314093". */
export const cleanPhone = (phone: string) => phone.replace(/[\s()-]/g, '');

export function detailsOf(branch: Branch): BranchDetails {
  const { name, shortName, city, address, phone, wifiName } = branch;
  const { country, timezone, locale } = branch;
  return {
    name,
    shortName,
    city,
    address,
    phone,
    wifiName,
    country,
    timezone,
    locale,
    currency: branch.currency.code,
    image: branch.image ?? null,
  };
}

export function servicesOf({
  modes,
  ordering,
}: Pick<Branch, 'modes' | 'ordering'>): ServicesSettings {
  return {
    dineIn: modes.dineIn.enabled,
    takeaway: modes.takeaway.enabled,
    delivery: modes.delivery.enabled,
    guestChanges: ordering.guestChanges === true,
  };
}

/** The country code a mobile number there starts with: "+977". */
export const dialCodeOf = (country: string): string =>
  isMasterValue('countries', country) ? REGION_PRESETS[country].mobile.dialCode : '';

/** The tax settings a guest branch implies (the mock's; the server sends its own, rates kept). */
export function taxOf({ tax }: Pick<Branch, 'tax'>): TaxSettings {
  return {
    enabled: tax.lines.length > 0,
    taxId: tax.taxId ?? '',
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

function deliveryOf({ modes }: Pick<Branch, 'modes'>): DeliverySettings {
  const { payments: _payments, ...delivery } = modes.delivery;
  return structuredClone(delivery);
}

function pickupOf({ modes }: Pick<Branch, 'modes'>): PickupSettings {
  const { payments: _payments, ...pickup } = modes.takeaway;
  return { ...pickup };
}

function helpOf(branch: Branch): HelpSettings {
  return {
    wifiName: branch.wifiName,
    wifiPassword: branch.wifiPassword ?? '',
    social: { ...branch.help?.social },
    faqs: (branch.help?.faqs ?? []).map((f) => ({ ...f })),
  };
}

export function settingsOf(branch: Branch): BranchSettings {
  return {
    details: detailsOf(branch),
    // Deleted after 90 days unless the owner keeps them (as every restaurant starts).
    photos: {
      deleteProofsAfterDays:
        branch.deleteProofsAfterDays === undefined ? 90 : branch.deleteProofsAfterDays,
    },
    help: helpOf(branch),
    services: servicesOf(branch),
    hours: structuredClone(branch.schedule),
    tax: taxOf(branch),
    payments: paymentsOf(branch),
    paymentQrs: (branch.payments.qrCodes ?? []).map((q) => ({
      method: q.method,
      image: { ...q.image },
      note: q.note ?? '',
    })),
    delivery: deliveryOf(branch),
    pickup: pickupOf(branch),
  };
}

/**
 * The methods a branch can offer on each screen: the ones its country offers (config/regions),
 * so labels always match.
 */
export function paymentChoicesFor(country: Branch['country']): PaymentChoices {
  const { payments } = REGION_PRESETS[country];
  const plain = <K extends string>(options: readonly PaymentOption<K>[]) =>
    options.map(({ id, labelKey }) => ({ id, labelKey }));
  return {
    checkout: plain(payments.checkout),
    bill: plain(payments.bill),
    takeaway: plain(payments.takeaway),
    delivery: plain(payments.delivery),
    atTable: [...payments.atTable],
    qr: payments.atTable.filter((m) => QR_METHODS.includes(m)),
  };
}
