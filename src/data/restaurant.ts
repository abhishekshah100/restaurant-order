import type { Restaurant } from '@/types/restaurant';

/**
 * Restaurant profile and live status (mock).
 * Bracketed values are placeholders from the design package — replace before launch.
 */
export const restaurant: Restaurant = {
  name: 'The Olive Table',
  tagline: 'Seasonal Indian and Mediterranean plates, cooked to order.',
  status: 'open',
  closesAt: '11:00 PM',
  opensAt: '12:00 PM',
  opensIn: 'in about 1 hr 20 min',
  pausedForMinutes: 15,
  hoursToday: '12:00 PM – 11:00 PM',
  lastOrders: '10:30 PM',
  serviceWindows: [
    { label: 'Lunch', hours: '12:00 PM – 3:30 PM' },
    { label: 'Dinner', hours: '7:00 PM – 11:00 PM' },
  ],
  phone: '[RESTAURANT PHONE]',
  address: '[RESTAURANT ADDRESS]',
  wifiName: '[NETWORK NAME]',
  paymentPartner: '[PAYMENT PARTNER]',
  defaultTable: 12,
  tableLocation: 'Ground floor · Garden side',
};

/** Mock OTP accepted at checkout. */
export const MOCK_OTP = '123456';
export const OTP_ATTEMPTS = 3;
export const OTP_RESEND_SECONDS = 30;
/** Seconds the mock UPI request stays open on the processing screen. */
export const PAYMENT_WINDOW_SECONDS = 272; // 4:32, as drawn
