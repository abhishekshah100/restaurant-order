import { describe, expect, it } from 'vitest';
import { totalsByPerson } from '@/components/admin/settings/shifts/ShiftsReport';
import type { ShiftRow } from '@/types/admin';

const shift = (id: string, name: string, minutes: number, collected: number): ShiftRow => ({
  id: `${id}-${String(minutes)}`,
  staff: { id, name },
  startedAt: '2026-11-10T12:00:00Z',
  minutes,
  ordersTaken: 2,
  payments: 1,
  collected,
  tips: 10,
});

describe('Team › Shifts', () => {
  it('adds up each person’s shifts, most hours first', () => {
    expect(
      totalsByPerson([
        shift('a', 'Arjun', 300, 1000),
        shift('p', 'Priya', 480, 2000),
        shift('a', 'Arjun', 240, 500),
      ]),
    ).toEqual([
      {
        id: 'a',
        name: 'Arjun',
        shifts: 2,
        minutes: 540,
        ordersTaken: 4,
        collected: 1500,
        tips: 20,
      },
      {
        id: 'p',
        name: 'Priya',
        shifts: 1,
        minutes: 480,
        ordersTaken: 2,
        collected: 2000,
        tips: 10,
      },
    ]);
  });
});
