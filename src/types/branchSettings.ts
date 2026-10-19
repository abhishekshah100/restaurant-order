import type {
  AtTableMethodKey,
  BillLineKey,
  BillMethodKey,
  CheckoutMethodKey,
  DeliveryMode,
  OpeningSchedule,
  PaymentMethodId,
  PaymentOption,
  TakeawayMode,
  TaxLine,
} from './branch';

/*
 * A branch's settings as staff edit them (Settings), one section per page. GET /branches
 * carries the same data in the shape guests' screens read; these are the parts staff change.
 */

/** Settings › Branch details: who and where the branch is. */
export interface BranchDetails {
  /** "The Olive Table — Thamel". */
  name: string;
  /** "Thamel": how staff and guests tell branches apart. */
  shortName: string;
  city: string;
  address: string;
  /** International form: "+9779852024631". */
  phone: string;
  /** The guest Wi-Fi's name (the offline screen); empty when there's none. */
  wifiName: string;
  /** Where the tables are, told on the welcome screen: "Ground floor · Garden side". */
  tableLocation: string;
}

/** A tax line as staff edit it: its rate and what it's charged on (its name is the region's). */
export interface TaxLineSettings {
  id: string;
  labelKey: BillLineKey;
  rateBp: number;
  base: TaxLine['base'];
  /** Shown as these parts on the bill (CGST + SGST), each an equal share of the rate. */
  parts?: { id: string; labelKey: BillLineKey }[];
}

/** Settings › Tax & service charge. Rates are in basis points: 250 = 2.5%. */
export interface TaxSettings {
  /** The service charge on the item total, or null for none. */
  serviceChargeBp: number | null;
  lines: TaxLineSettings[];
  /** Discounts come off before the service charge and taxes are worked out. */
  discountBeforeTax: boolean;
  /** The total is rounded to a whole currency unit (with a round-off line). */
  roundTotal: boolean;
}

/** Where guests choose how to pay. */
export type PaymentChannel = 'checkout' | 'bill' | 'takeaway' | 'delivery';

export const PAYMENT_CHANNELS: readonly PaymentChannel[] = [
  'checkout',
  'bill',
  'takeaway',
  'delivery',
];

/** The methods a screen offers, in the order shown, and the one marked "Fastest". */
export interface PaymentChannelSettings {
  methods: PaymentMethodId[];
  recommended: PaymentMethodId | null;
}

/** Settings › Payment methods. */
export interface PaymentSettings {
  /** Dine-in checkout. */
  checkout: PaymentChannelSettings;
  /** Pay my bill, in the app (online methods only). */
  bill: PaymentChannelSettings;
  takeaway: PaymentChannelSettings;
  delivery: PaymentChannelSettings;
  /** How the printed bill can be paid at the table, in the order they're named. */
  atTable: AtTableMethodKey[];
}

/** Settings › Delivery zones: everything about delivery but its payment methods. */
export type DeliverySettings = Omit<DeliveryMode, 'payments'>;

/** Settings › Pickup: everything about takeaway but its payment methods. */
export type PickupSettings = Omit<TakeawayMode, 'payments'>;

export interface BranchSettings {
  details: BranchDetails;
  hours: OpeningSchedule;
  tax: TaxSettings;
  payments: PaymentSettings;
  delivery: DeliverySettings;
  pickup: PickupSettings;
}

export type BranchSettingsSection = keyof BranchSettings;

/** The payment methods a branch's region can offer on each screen (its labels included). */
export interface PaymentChoices {
  checkout: PaymentOption<CheckoutMethodKey>[];
  bill: PaymentOption<BillMethodKey>[];
  takeaway: PaymentOption<CheckoutMethodKey>[];
  delivery: PaymentOption<CheckoutMethodKey>[];
  atTable: AtTableMethodKey[];
}

/** What the settings pages may choose from. */
export interface BranchSettingsChoices {
  payments: PaymentChoices;
}
