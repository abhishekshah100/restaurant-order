import { describe, expect, it } from 'vitest';
import { settingsChanges, type SettingsWords } from '@/components/admin/audit/settingsChanges';

const NAMES: Record<string, string> = {
  hours: 'Opening hours',
  tax: 'Tax & bill',
  delivery: 'Delivery',
  help: 'Help page',
  details: 'Branch details',
  days: 'Dine-in',
  serviceChargeBp: 'Service charge',
  roundTotal: 'Round off the total',
  zones: 'Delivery zones',
  fee: 'Delivery fee',
  prepMinutes: 'Time to get ready',
  wifiPassword: 'Wi-Fi password',
  image: 'Photo',
  paymentQrs: 'Payment QR codes',
  note: 'Line under the QR',
};
const words: SettingsWords = {
  section: (k) => NAMES[k],
  field: (k) => NAMES[k],
  day: (k) => ({ mon: 'Monday', tue: 'Tuesday' })[k],
  method: (id) => id.toUpperCase(),
  money: (n) => `₹${n}`,
  minutes: (n) => `${n} min`,
  km: (n) => `${n} km`,
  on: 'On',
  off: 'Off',
  empty: 'Not set',
  closed: 'Closed',
  added: 'Added',
  removed: 'Removed',
  changed: 'Changed',
  oldPhoto: 'Old photo',
  newPhoto: 'New photo',
};
const lines = (before: object, after: object) =>
  settingsChanges(before as never, after as never, words).map(
    (c) => `${c.label}: ${c.before} → ${c.after}`,
  );

describe('settingsChanges', () => {
  it('says each changed field in words: rates, switches, minutes', () => {
    expect(
      lines(
        {
          tax: { serviceChargeBp: 500, roundTotal: true, lines: [] },
          delivery: { prepMinutes: 20 },
        },
        {
          tax: { serviceChargeBp: 1000, roundTotal: false, lines: [] },
          delivery: { prepMinutes: 30 },
        },
      ),
    ).toEqual([
      'Tax & bill › Service charge: 5% → 10%',
      'Tax & bill › Round off the total: On → Off',
      'Delivery › Time to get ready: 20 min → 30 min',
    ]);
  });

  it('tells opening hours by day, and Closed for a day without hours', () => {
    const day = (opens: string, closes: string) => [{ opens, closes }];
    expect(
      lines(
        { hours: { days: { mon: day('11:00', '23:00'), tue: day('11:00', '23:00') } } },
        { hours: { days: { mon: day('12:00', '23:00'), tue: [] } } },
      ),
    ).toEqual([
      'Opening hours › Dine-in › Monday: 11:00–23:00 → 12:00–23:00',
      'Opening hours › Dine-in › Tuesday: 11:00–23:00 → Closed',
    ]);
  });

  it('matches list items by id: added, removed and changed zones by name', () => {
    const zone = (id: string, name: string, fee: number) => ({ id, name, fee, areas: [] });
    expect(
      lines(
        { delivery: { zones: [zone('a', 'Sector 18', 40), zone('b', 'Sector 62', 60)] } },
        { delivery: { zones: [zone('a', 'Sector 18', 50), zone('c', 'Noida City', 80)] } },
      ),
    ).toEqual([
      'Delivery › Delivery zones › Sector 18 › Delivery fee: ₹40 → ₹50',
      'Delivery › Delivery zones › Sector 62: Sector 62 → Removed',
      'Delivery › Delivery zones › Noida City: Not set → Added',
    ]);
  });

  it('names payment QR codes by their method: added, replaced, removed', () => {
    const qr = (method: string, src: string, note = '') => ({ method, image: { src }, note });
    expect(
      lines(
        { paymentQrs: [qr('esewa', 'a.png'), qr('fonepay', 'b.png')] },
        { paymentQrs: [qr('esewa', 'c.png', 'Olive Table'), qr('khalti', 'd.png')] },
      ),
    ).toEqual([
      'Payment QR codes › ESEWA › Photo: Old photo → New photo',
      'Payment QR codes › ESEWA › Line under the QR: Not set → Olive Table',
      'Payment QR codes › FONEPAY: FONEPAY → Removed',
      'Payment QR codes › KHALTI: Not set → Added',
    ]);
  });

  it('never shows the photo address, and nothing when nothing changed', () => {
    expect(
      lines({ details: { image: { src: 'a.jpg' } } }, { details: { image: { src: 'b.jpg' } } }),
    ).toEqual(['Branch details › Photo: Old photo → New photo']);
    expect(lines({ tax: { roundTotal: true } }, { tax: { roundTotal: true } })).toEqual([]);
  });
});
