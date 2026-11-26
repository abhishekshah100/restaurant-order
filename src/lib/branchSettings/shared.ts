/* The limits, field lists and small helpers every part of a branch's settings uses. */

export const LIMITS = {
  name: 60,
  shortName: 30,
  city: 40,
  address: 160,
  wifiName: 40,
  orderStart: 999_999,
  sessionLabel: 30,
  sessionsPerDay: 4,
  specialDays: 50,
  specialLabel: 40,
  /** Days one special entry can cover (a festival month at most). */
  specialSpan: 62,
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
  /** The line under a payment QR (who it pays). */
  qrNote: 80,
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
  | 'orderPrefix'
  | 'orderStart'
  | 'image'
  | 'qrMethod'
  | 'qrImage'
  | 'qrNote'
  | 'wifiPasswordLong'
  | 'instagramUrl'
  | 'facebookUrl'
  | 'youtubeUrl'
  | 'tiktokUrl'
  | 'xUrl'
  | 'whatsappUrl'
  | 'googleReviewsUrl'
  | 'tooManyFaqs'
  | 'faqQuestion'
  | 'faqAnswer'
  | 'taxId'
  | 'legalName'
  | 'sacCode'
  | 'fssai'
  | 'invoicePrefix'
  | 'country'
  | 'timezone'
  | 'locale'
  | 'currency'
  | 'noService'
  | 'deliveryNeedsZones'
  | 'noOpenDay'
  | 'sessionTime'
  | 'sessionOverlap'
  | 'tooManySessions'
  | 'sessionLabel'
  | 'lastOrders'
  | 'specialDates'
  | 'specialOverlap'
  | 'tooManySpecialDays'
  | 'specialLabel'
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
