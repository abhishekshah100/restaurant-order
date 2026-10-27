import type cart from '../../public/api/content/cart.json';
import type checkout from '../../public/api/content/checkout.json';
import type common from '../../public/api/content/common.json';
import type service from '../../public/api/content/service.json';
import type { Price } from './menu';
import {
  WEEKDAYS,
  type BranchStatusCode,
  type CountryCodeMaster,
  type OrderType,
  type PaymentMethodCode,
  type WeekdayCode,
} from '@/config/masters';

/** Countries with a branch. Region copy in content is keyed by these (e.g. the phone-prefix error). */
export type CountryCode = CountryCodeMaster;

/** Whether a branch is taking orders, as the (mock) server reports it. */
export type BranchStatus = BranchStatusCode;

/** Days of the week, Monday first (the order Settings › Opening hours lists them). */
export { WEEKDAYS };
export type Weekday = WeekdayCode;

/**
 * One session the branch is open in, 24-hour local "HH:MM": a closing time at or before the
 * opening is the next day's ("18:00"–"02:00"), "24:00" the end of the day ("00:00"–"24:00": all
 * day). Its label ("Lunch", "Dinner") is optional.
 */
export interface Session {
  label?: string;
  opens: string;
  closes: string;
}

/** A week of sessions: each day's, in order; a day without any is closed. */
export type WeekSessions = Record<Weekday, Session[]>;

/**
 * Special dates (a holiday, a festival week): from one of the branch's calendar days to another
 * ("2026-11-08", inclusive) it opens in these sessions instead of its week, for every way of
 * ordering; none is closed.
 */
export interface SpecialDay {
  from: string;
  to: string;
  label?: string;
  sessions: Session[];
}

/**
 * The branch's hours as staff set them (Settings › Opening hours). Orders are taken inside a
 * session until its last orders.
 */
export interface OpeningSchedule {
  /** The opening hours (dine-in, and takeaway or delivery without hours of their own). */
  days: WeekSessions;
  /** The kitchen takes its last order this many minutes before each session closes. */
  lastOrdersMinutes: number;
  /** Takeaway's own week; null: it follows the opening hours. */
  takeaway: WeekSessions | null;
  /** Delivery's own week; null: it follows the opening hours. */
  delivery: WeekSessions | null;
  /** Special dates, earliest first (guests are sent today's and later ones). */
  specialDays: SpecialDay[];
}

/** A way of ordering's status now, and its next change (ISO). */
export interface ModeStatus {
  status: BranchStatus;
  statusUntil?: string;
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
  /**
   * Discounts (automatic offers, promo codes) come off the item total before the service charge
   * and taxes are worked out (true, both demo branches), or off the taxed total (false).
   */
  discountBeforeTax: boolean;
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
  /**
   * What the bill is called (service › region.taxInvoice): "GST invoice", "VAT invoice"; at a
   * branch that doesn't charge tax, "Bill of supply" (India) or "Bill".
   */
  invoiceKey: keyof (typeof service)['region']['taxInvoice'];
  /** The registration number printed on bills (GSTIN, PAN); absent when there's none. */
  taxId?: string;
  /** What the number is called: GSTIN (India), PAN (Nepal). */
  taxIdKey: TaxIdKey;
}

export type TaxIdKey = 'gstin' | 'pan' | 'taxId';

/** Every payment method the app knows; each branch offers some of them. */
export type PaymentMethodId = PaymentMethodCode;

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
export type OrderMode = OrderType;

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

/**
 * When dine-in guests pay for a running order: for each round as it's ordered (online or at the
 * counter), or once at the end of the meal (rounds go straight to the kitchen; the tab is paid
 * with Pay my bill or at the counter).
 */
export type DineInPayment = 'perRound' | 'endOfMeal';

/** How orders work once placed. */
export interface OrderingRules {
  dineInPayment: DineInPayment;
  /** Seconds after placing an order (or round) during which the guest can change or cancel it. */
  cancelWindowSeconds: number;
}

/**
 * A photo of the branch at its file's own pixel size, so it's only ever drawn at or below that
 * size (never upscaled): `{ src: '/images/pasta-square.jpg', width: 240, height: 240 }`.
 */
export interface BranchImage {
  src: string;
  width: number;
  height: number;
}

/** Which ways a branch takes orders (GET /branches); their rules are in its config. */
export type BranchModeFlags = Record<OrderMode, { enabled: boolean }>;

/**
 * GET /branches: one restaurant location in brief, for the outlet picker and the guest's own
 * branch: where it is, how to reach it, its week and status, and which ways it takes orders.
 */
export interface BranchSummary {
  id: string;
  name: string;
  /** "Indiranagar", "Thamel". */
  shortName: string;
  city: string;
  country: CountryCode;
  address: string;
  /** Shown as a small thumbnail (admin branch picker); a monogram tile stands in without one. */
  image?: BranchImage;
  /** A maps search for the address (a plain link, opened in the guest's maps app). */
  mapUrl: string;
  /** Contact number as shown ("+918826314093"); calls go to `tel:` it. */
  phone: string;
  wifiName: string;
  /** Open, paused or closed now: what staff set, else what the week says about today. */
  status: BranchStatus;
  /**
   * ISO 8601, only while staff have it paused (when ordering resumes) or closed (when it opens
   * again). A day the week is shut has none: `schedule` says when it opens next.
   */
  statusUntil?: string;
  /**
   * Takeaway's and delivery's status, by their own hours when they have them (else as `status`);
   * what staff set holds for them too.
   */
  modeStatus: Record<'takeaway' | 'delivery', ModeStatus>;
  /**
   * The week's opening hours, last orders and service windows, in 24-hour local "HH:MM". Every
   * time a screen shows ("Open until 9:00 PM", "Opens Tuesday at 11:00 AM") is worked out from
   * it, `status` and `statusUntil` (lib/branchHours › branchTimes).
   */
  schedule: OpeningSchedule;
  /** BCP 47 locale for numbers and times, e.g. "en-IN". */
  locale: string;
  /** Used for number formatting when the runtime has no data for `locale` (en-NP → en-IN). */
  localeFallback?: string;
  /** IANA time zone: "today" and every displayed time are in it. */
  timezone: string;
  /** Dine-in, takeaway and delivery: which are offered. */
  modes: BranchModeFlags;
}

/**
 * GET /branches/:branchId/config: one branch's rules for ordering there, read once a guest
 * orders at it (and by staff working there): money, mobile numbers, taxes, payment methods,
 * dietary marks, each mode's rules and the kitchen time.
 */
export interface BranchConfig {
  id: string;
  currency: CurrencyConfig;
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
  /** Running orders, and changing or cancelling an order just placed. */
  ordering: OrderingRules;
  /** The kitchen's usual time for an order, in minutes (shown as "18–22 min"). */
  prepMinutes: { min: number; max: number };
}

/** A branch as the screens use it: its summary and its rules together (api/hooks › useBranch). */
export type Branch = Omit<BranchSummary, 'modes'> & BranchConfig;

/**
 * What changes about a branch during the day (GET /branches/:branchId/status): open, paused or
 * closed and until when. Pages where guests order poll it instead of every branch's details.
 */
export type BranchLiveStatus = Pick<BranchSummary, 'id' | 'status' | 'statusUntil' | 'modeStatus'>;
