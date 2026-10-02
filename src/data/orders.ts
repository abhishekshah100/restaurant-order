import type { Order } from '@/types/order';

/**
 * Mock order history, exactly as drawn in the design files.
 * "Today" orders are dated relative to the build date's evening so the
 * screens read naturally; earlier visits keep the drawn dates.
 */

const today = (time: string) => {
  const [hm, meridiem] = time.split(' ');
  const [h, m] = hm.split(':').map(Number);
  const hours = (h % 12) + (meridiem === 'PM' ? 12 : 0);
  const d = new Date();
  d.setHours(hours, m, 0, 0);
  return d.toISOString();
};

export const mockOrders: Order[] = [
  {
    id: 'A104',
    table: 12,
    customerName: 'Ananya Rao',
    placedBy: 'you',
    placedAt: today('7:42 PM'),
    status: 'preparing',
    items: [
      {
        dishSlug: 'paneer-tikka',
        name: 'Paneer Tikka',
        veg: true,
        quantity: 1,
        variant: 'Full',
        details: ['Full · 10 pcs · Medium spicy', '+ Extra mint chutney (free)'],
        unitPrice: 549,
        status: 'preparing',
      },
      {
        dishSlug: 'truffle-mushroom-pasta',
        name: 'Truffle Mushroom Pasta',
        veg: true,
        quantity: 1,
        variant: 'Regular',
        details: ['Regular · ₹369', '+ Extra parmesan · ₹40'],
        note: 'Less cheese',
        unitPrice: 409,
        status: 'queued',
      },
      {
        dishSlug: 'iced-hazelnut-latte',
        name: 'Iced Hazelnut Latte',
        veg: true,
        quantity: 2,
        variant: 'Regular',
        details: ['Regular · Oat milk · ₹199 each'],
        unitPrice: 199,
        status: 'ready',
      },
    ],
    itemTotal: 1356,
    total: 1424,
    payment: {
      method: 'online',
      status: 'paid',
      detail: 'UPI · ananya@[bank]',
      transactionRef: '•••• 4821',
    },
    timeline: [
      { status: 'received', time: '7:42 PM', note: 'Paid online' },
      { status: 'preparing', time: '7:46 PM', note: 'Your drinks are on the way first' },
    ],
    estimate: '18–22 min',
  },
  {
    id: 'A097',
    table: 12,
    customerName: 'Ananya Rao',
    placedBy: 'you',
    placedAt: today('7:05 PM'),
    status: 'served',
    items: [
      {
        dishSlug: 'masala-chai',
        name: 'Masala Chai',
        veg: true,
        quantity: 1,
        details: [],
        unitPrice: 99,
        status: 'served',
      },
      {
        dishSlug: 'crispy-corn-chaat',
        name: 'Crispy Corn Chaat',
        veg: true,
        quantity: 1,
        details: [],
        unitPrice: 204,
        status: 'served',
      },
    ],
    itemTotal: 303,
    total: 318,
    payment: { method: 'counter', status: 'unpaid' },
    timeline: [
      { status: 'received', time: '7:05 PM', note: 'Pay at counter' },
      { status: 'preparing', time: '7:07 PM' },
      { status: 'ready', time: '7:16 PM' },
      { status: 'served', time: '7:18 PM' },
    ],
  },
  {
    id: 'A101',
    table: 12,
    customerName: 'Rohan',
    placedBy: 'other',
    placedAt: today('7:20 PM'),
    status: 'preparing',
    items: [
      {
        dishSlug: 'old-delhi-butter-chicken',
        name: 'Old Delhi Butter Chicken',
        veg: false,
        quantity: 1,
        details: [],
        unitPrice: 449,
      },
      {
        dishSlug: 'garlic-naan',
        name: 'Garlic Naan',
        veg: true,
        quantity: 2,
        details: [],
        unitPrice: 89,
      },
      {
        dishSlug: 'sweet-lassi',
        name: 'Sweet Lassi',
        veg: true,
        quantity: 1,
        details: [],
        unitPrice: 93,
      },
    ],
    itemTotal: 720,
    total: 756,
    payment: { method: 'counter', status: 'unpaid' },
    timeline: [{ status: 'received', time: '7:20 PM' }],
  },
  {
    id: 'A098',
    table: 12,
    customerName: 'Ananya Rao',
    placedBy: 'you',
    placedAt: today('7:31 PM'),
    status: 'cancelled',
    items: [
      {
        dishSlug: 'truffle-mushroom-pasta',
        name: 'Truffle Mushroom Pasta',
        veg: true,
        quantity: 1,
        variant: 'Regular',
        details: ['Regular · Extra parmesan'],
        unitPrice: 409,
      },
    ],
    itemTotal: 390,
    total: 409,
    payment: { method: 'online', status: 'refund-started', refundAmount: 409 },
    timeline: [
      { status: 'received', time: '7:31 PM', note: 'Paid online' },
      { status: 'cancelled', time: '7:34 PM', note: 'Item unavailable' },
    ],
    cancelReason: 'Truffle Mushroom Pasta has just sold out for tonight. We’re sorry about that.',
  },
  {
    id: 'A061',
    table: 5,
    customerName: 'Ananya Rao',
    placedBy: 'you',
    placedAt: '2026-09-12T20:18:00+05:30',
    status: 'served',
    items: [
      {
        dishSlug: 'dal-makhani',
        name: 'Dal Makhani',
        veg: true,
        quantity: 1,
        details: [],
        unitPrice: 299,
      },
      {
        dishSlug: 'butter-naan',
        name: 'Butter Naan',
        veg: true,
        quantity: 2,
        details: [],
        unitPrice: 79,
      },
      {
        dishSlug: 'jeera-rice',
        name: 'Jeera Rice',
        veg: true,
        quantity: 1,
        details: [],
        unitPrice: 197,
      },
    ],
    itemTotal: 654,
    total: 687,
    payment: { method: 'online', status: 'paid' },
    timeline: [
      { status: 'received', time: '8:18 PM' },
      { status: 'served', time: '8:41 PM' },
    ],
  },
  {
    id: 'A033',
    table: 8,
    customerName: 'Ananya Rao',
    placedBy: 'you',
    placedAt: '2026-08-28T13:12:00+05:30',
    status: 'served',
    items: [
      {
        dishSlug: 'paneer-tikka',
        name: 'Paneer Tikka',
        veg: true,
        quantity: 1,
        variant: 'Full',
        details: ['Full · 10 pcs'],
        unitPrice: 549,
      },
      {
        dishSlug: 'veg-dum-biryani',
        name: 'Veg Dum Biryani',
        veg: true,
        quantity: 1,
        details: [],
        unitPrice: 197,
      },
      {
        dishSlug: 'mango-lassi',
        name: 'Mango Lassi',
        veg: true,
        quantity: 1,
        details: [],
        unitPrice: 130,
      },
    ],
    itemTotal: 876,
    total: 920,
    payment: { method: 'online', status: 'paid' },
    timeline: [
      { status: 'received', time: '1:12 PM' },
      { status: 'served', time: '1:38 PM' },
    ],
  },
  {
    id: 'A029',
    table: 8,
    customerName: 'Ananya Rao',
    placedBy: 'you',
    placedAt: '2026-08-28T12:40:00+05:30',
    status: 'cancelled',
    items: [
      {
        dishSlug: 'chicken-chettinad',
        name: 'Chicken Chettinad',
        veg: false,
        quantity: 1,
        details: [],
        unitPrice: 429,
      },
    ],
    itemTotal: 429,
    total: 450,
    payment: { method: 'online', status: 'refunded', refundAmount: 450 },
    timeline: [
      { status: 'received', time: '12:40 PM' },
      { status: 'cancelled', time: '12:44 PM', note: 'Item unavailable' },
    ],
  },
];

/**
 * IDs handed to orders placed in this browser. Static export can only serve
 * pre-rendered order pages, so new orders draw from this pre-generated pool.
 */
export const NEW_ORDER_IDS = Array.from({ length: 20 }, (_, i) => `A${105 + i}`);

export const ALL_ORDER_IDS = [...mockOrders.map((o) => o.id), ...NEW_ORDER_IDS];
