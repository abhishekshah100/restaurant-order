import type cart from '../../public/api/content/cart.json';
import type checkout from '../../public/api/content/checkout.json';
import type common from '../../public/api/content/common.json';
import type service from '../../public/api/content/service.json';
import type { Price } from './menu';

/** Countries with a branch. Region copy in content is keyed by these (e.g. the phone-prefix error). */
export type CountryCode = 'IN' | 'NP';

/** Whether a branch is taking orders, as the (mock) server reports it. */
export type BranchStatus = 'open' | 'closed' | 'paused';

export interface ServiceWindow {
  label: string;
  /** "12:00 PM – 3:30 PM", in the branch's local time. */
  hours: string;
}

/** The branch's currency. Prices in the menu are in major units (rupees); bills work in minor units. */
export interface CurrencyConfig {
  /** ISO 4217 code, e.g. "INR", "NPR". */
  code: string;
  /** Symbol shown instead of the one Intl picks, e.g. "₹", "रू". */
  symbol: string;
  /** Minor units per major unit: 100 paise to the rupee. */
  minorUnit: number;
  /** Its spoken name for screen readers (common › currencyNames): "rupees". */
  nameKey: keyof (typeof common)['currencyNames'];
}

/** Mobile numbers the branch accepts at checkout. */
export interface MobileRules {
  /** "+91", "+977". */
  dialCode: string;
  /** Digits in a national mobile number. */
  length: number;
  /** A valid national number, as a regular expression over the digits only. */
  pattern: string;
  /** How the digits are grouped for display, e.g. [5, 5] → "98765 43210". */
  groups: number[];
  /** Between groups: " " or "-". */
  separator: string;
  /** Show the dial code beside the checkout field. */
  showDialCode: boolean;
}

/** Content key of a bill line label (cart › priceSummary.lines). */
export type BillLineKey = keyof (typeof cart)['priceSummary']['lines'];
/** Content key of the one-line "taxes + round off" label (cart › priceSummary.compact). */
export type BillCompactKey = keyof (typeof cart)['priceSummary']['compact'];

/** A tax applied on top of the menu prices. Rates are in basis points: 250 = 2.5%. */
export interface TaxLine {
  id: string;
  labelKey: BillLineKey;
  rateBp: number;
  /** What it's charged on: the item total, or the item total plus the service charge. */
  base: 'items' | 'itemsPlusService';
  /** Shown as these lines on a split bill (CGST + SGST); their rates add up to `rateBp`. */
  splitInto?: { id: string; labelKey: BillLineKey; rateBp: number }[];
}

export interface TaxConfig {
  /** Menu prices exclude tax (the only model so far). */
  pricesIncludeTax: false;
  /** Charged on the item total before tax. No service charge: the bill says "Not added". */
  serviceCharge?: { labelKey: BillLineKey; rateBp: number };
  lines: TaxLine[];
  rounding: {
    /** The total is rounded to a multiple of this, in minor units: 100 = whole rupees. */
    unit: number;
    showRoundOff: boolean;
  };
  /** Label of the single "taxes and round off" line (checkout summary). */
  compactLabelKey: BillCompactKey;
  /** The tax invoice guests can ask for (service › region.taxInvoice): "GST invoice". */
  invoiceKey: keyof (typeof service)['region']['taxInvoice'];
}

/** Every payment method the app knows; each branch offers some of them. */
export type PaymentMethodId =
  'online' | 'upi' | 'card' | 'esewa' | 'khalti' | 'fonepay' | 'counter' | 'pickup' | 'cod';

/** A payment method offered on a screen, with the content key of its title and descriptions. */
export interface PaymentOption<K extends string> {
  id: PaymentMethodId;
  labelKey: K;
  /** Marked "Fastest". */
  recommended?: boolean;
}

/** A way to settle the printed bill with the server (service › region.atTable), e.g. "cash". */
export type AtTableMethodKey = keyof (typeof service)['region']['atTable'];

export type CheckoutMethodKey = keyof (typeof checkout)['payment']['methods'];
export type BillMethodKey = keyof (typeof service)['payBill']['methods'];

/** Dietary marks a branch shows on dishes and in the filters. */
export type DietaryMark = 'veg' | 'nonveg';

/** How the guest gets their food: at a table, collected from the counter, or brought to them. */
export type OrderMode = 'dineIn' | 'takeaway' | 'delivery';

/** A delivery zone: the areas it covers and what delivering there costs (major units). */
export interface DeliveryZone {
  id: string;
  /** "Thamel & Lazimpat". */
  name: string;
  /** Localities (or postcodes) the guest picks from: "Lazimpat". */
  areas: string[];
  fee: Price;
  /** Free delivery from this item total. */
  freeAbove?: Price;
  /** The smallest item total delivered to this zone. */
  minOrder: Price;
  /** Minutes from placing the order to the door. */
  etaMinutes: number;
}

/** Ordering for collection at the counter. */
export interface TakeawayMode {
  enabled: boolean;
  /** Minutes the kitchen needs: "as soon as possible" is ready this long after ordering. */
  prepMinutes: number;
  /** The smallest item total taken (0: none). */
  minOrder: Price;
  /** Offer "As soon as possible" as well as the slots. */
  asap: boolean;
  /** Minutes between pickup slots, counted from opening time. */
  slotMinutes: number;
  /** The checkout payment methods (an offline one is paid when collecting). */
  payments: PaymentOption<CheckoutMethodKey>[];
}

/** Ordering for delivery to the guest's address. */
export interface DeliveryMode {
  enabled: boolean;
  /** Minutes before the rider leaves with the order. */
  prepMinutes: number;
  zones: DeliveryZone[];
  /** Furthest delivery, in km (told to the guest). */
  maxDistanceKm?: number;
  /** The delivery fee is taxed like the items; otherwise it's added after tax. */
  feeTaxable: boolean;
  /** The checkout payment methods (an offline one is cash on delivery). */
  payments: PaymentOption<CheckoutMethodKey>[];
}

/** Which order modes a branch takes, and the rules of each. */
export interface BranchModes {
  dineIn: { enabled: boolean };
  takeaway: TakeawayMode;
  delivery: DeliveryMode;
}

/** GET /branches: one restaurant location, with everything that differs by place. */
export interface Branch {
  id: string;
  name: string;
  /** "Indiranagar", "Thamel". */
  shortName: string;
  city: string;
  country: CountryCode;
  address: string;
  /** A maps search for the address (a plain link, opened in the guest's maps app). */
  mapUrl: string;
  /** Contact number as shown, and its tel: link. */
  phone: string;
  phoneHref: string;
  wifiName: string;
  paymentPartner: string;
  status: BranchStatus;
  /** "11:00 AM", local time. */
  opensAt: string;
  closesAt: string;
  /** Today's opening hours as 24-hour local "HH:MM", for working out pickup slots. */
  hours: { opens: string; closes: string };
  /** "in about 1 hr 20 min" */
  opensIn: string;
  pausedForMinutes: number;
  hoursToday: string;
  lastOrders: string;
  /** "30 min before close" */
  lastOrdersNote: string;
  serviceWindows: ServiceWindow[];
  /** Usual kitchen time, shown in the cart, checkout and on new orders: "18–22 min". */
  prepTime: string;
  /** Table a session starts at when the link has none. */
  defaultTable: number;
  /** Table numbers a QR link may carry. */
  tables: { first: number; last: number };
  tableLocation: string;
  /** BCP 47 locale for numbers and times, e.g. "en-IN". */
  locale: string;
  /** Used for number formatting when the runtime has no data for `locale` (en-NP → en-IN). */
  localeFallback?: string;
  currency: CurrencyConfig;
  /** IANA time zone: "today" and every displayed time are in it. */
  timezone: string;
  mobile: MobileRules;
  tax: TaxConfig;
  payments: {
    /** Checkout payment step. */
    checkout: PaymentOption<CheckoutMethodKey>[];
    /** Paying one's own bill in the app (no counter option). */
    bill: PaymentOption<BillMethodKey>[];
    /** How the printed bill can be paid at the table, in the order they're named. */
    atTable: AtTableMethodKey[];
  };
  dietary: { marks: DietaryMark[] };
  /** Dine-in, takeaway and delivery: which are offered and their rules. */
  modes: BranchModes;
}
