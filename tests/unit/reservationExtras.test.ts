import { describe, expect, it } from 'vitest';
import {
  cancelOutcome,
  depositAsked,
  noShowStats,
  remindersDue,
  smsLink,
  whatsappLink,
} from '@/lib/reservations';
import type { Reservation, ReservationRules } from '@/types/admin';

/* No-shows, deposits and reminders: the rules the booking screens apply. */

const NOW = Date.parse('2026-11-03T12:00:00.000Z');
const HOUR = 3_600_000;
const rules: ReservationRules = {
  noShowAfterMinutes: 30,
  depositPartySize: 6,
  depositPerPerson: 100,
  depositCancelHours: 24,
  depositAfterNoShows: 2,
};
const booking = (id: string, extra: Partial<Reservation> = {}): Reservation => ({
  id,
  table: 2,
  guestName: 'Meera',
  phone: '9876501234',
  partySize: 4,
  at: new Date(NOW + 2 * HOUR).toISOString(),
  minutes: 90,
  status: 'booked',
  createdAt: new Date(NOW).toISOString(),
  createdBy: 'Arjun',
  ...extra,
});

describe('reservation extras', () => {
  it('asks a deposit of big parties and of guests who missed bookings', () => {
    expect(depositAsked(rules, 4, 0)).toBe(0);
    expect(depositAsked(rules, 6, 0)).toBe(600);
    expect(depositAsked(rules, 2, 2)).toBe(200);
    expect(depositAsked({ ...rules, depositPerPerson: 0 }, 8, 3)).toBe(0);
    expect(depositAsked(undefined, 8, 3)).toBe(0);
  });

  it('refunds a deposit cancelled early enough, keeps a late one', () => {
    expect(cancelOutcome(new Date(NOW + 25 * HOUR).toISOString(), NOW, 24)).toBe('refunded');
    expect(cancelOutcome(new Date(NOW + 2 * HOUR).toISOString(), NOW, 24)).toBe('kept');
  });

  it('lists the reminders due: booked, with a number, in the next day, soonest first', () => {
    const due = remindersDue(
      [
        booking('R3', { at: new Date(NOW + 5 * HOUR).toISOString() }),
        booking('R1'),
        booking('R2', { phone: undefined }),
        booking('R4', { at: new Date(NOW + 30 * HOUR).toISOString() }),
        booking('R5', { status: 'cancelled' }),
        booking('R6', { at: new Date(NOW - HOUR).toISOString() }),
      ],
      NOW,
    );
    expect(due.map((r) => r.id)).toEqual(['R1', 'R3']);
  });

  it('opens WhatsApp or messages with the text ready', () => {
    expect(whatsappLink('+91', '9876501234', 'See you at 7')).toBe(
      'https://wa.me/919876501234?text=See%20you%20at%207',
    );
    expect(smsLink('+977', '9812345678', 'Hi')).toBe('sms:+9779812345678?body=Hi');
  });

  it('counts no-shows against the parties that were due', () => {
    const stats = noShowStats([
      booking('R1', { status: 'seated' }),
      booking('R2', { status: 'seated' }),
      booking('R3', {
        status: 'noShow',
        partySize: 6,
        deposit: { amount: 600, method: 'upi', at: '', status: 'kept' },
      }),
      booking('R4', { status: 'cancelled' }),
      booking('R5'),
    ]);
    expect(stats).toEqual({
      bookings: 5,
      seated: 2,
      noShows: 1,
      cancelled: 1,
      rate: 1 / 3,
      lostCovers: 6,
      depositsKept: 600,
    });
  });
});
