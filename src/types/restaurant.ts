/** Restaurant status as the (mock) server reports it. */
export type RestaurantStatus = 'open' | 'closed' | 'paused';

/** What the guest can do right now: the restaurant status, or 'offline' when the device has no connection. */
export type OrderingState = RestaurantStatus | 'offline';

interface ServiceWindow {
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
  /** Usual kitchen time, shown in the cart, checkout and on new orders: "18–22 min". */
  prepTime: string;
  /** "30 min before close" */
  lastOrdersNote: string;
  serviceWindows: ServiceWindow[];
  phone: string;
  /** tel: link for the phone number. */
  phoneHref: string;
  address: string;
  wifiName: string;
  paymentPartner: string;
  defaultTable: number;
  tableLocation: string;
  /** Social profiles shown under "Follow us" on the Help page. */
  social: SocialLink[];
}

export type SocialNetwork = 'instagram' | 'facebook' | 'youtube' | 'x';

export interface SocialLink {
  network: SocialNetwork;
  /** Platform name shown under the icon, e.g. "Instagram". */
  label: string;
  url: string;
}
