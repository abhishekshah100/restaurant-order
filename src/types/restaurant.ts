export type RestaurantStatus = 'open' | 'closed' | 'paused';

export interface ServiceWindow {
  label: string;
  /** "12:00 PM – 3:30 PM" */
  hours: string;
}

export interface Restaurant {
  name: string;
  tagline: string;
  status: RestaurantStatus;
  closesAt: string;
  opensAt: string;
  opensIn: string;
  pausedForMinutes: number;
  hoursToday: string;
  lastOrders: string;
  serviceWindows: ServiceWindow[];
  phone: string;
  address: string;
  wifiName: string;
  paymentPartner: string;
  defaultTable: number;
  tableLocation: string;
}

/** Previewable app states (?state=…). */
export type PreviewState =
  'closed' | 'paused' | 'offline' | 'payment-failed' | 'payment-cancelled' | 'order-cancelled';
