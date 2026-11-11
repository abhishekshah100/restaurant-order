import { describe, expect, it } from 'vitest';
import {
  addDays,
  clockLabel,
  coverageByDay,
  minutesByPerson,
  mondayOf,
  overnight,
  spanLabel,
  spanOf,
} from '@/lib/rota';
import type { RotaShift } from '@/types/admin';

const shift = (over: Partial<RotaShift>): RotaShift => ({
  id: 's',
  staffId: 'a',
  day: '2026-11-09',
  startsAt: '10:00',
  endsAt: '16:00',
  breakMinutes: 0,
  minutes: 360,
  ...over,
});

describe('rota', () => {
  it('finds a week’s Monday and moves days', () => {
    expect(mondayOf('2026-11-11')).toBe('2026-11-09');
    expect(mondayOf('2026-11-15')).toBe('2026-11-09');
    expect(mondayOf('2026-11-09')).toBe('2026-11-09');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('measures shifts, past midnight too', () => {
    expect(spanOf('10:00', '16:00')).toBe(360);
    expect(spanOf('18:00', '02:00')).toBe(480);
    expect(overnight('18:00', '02:00')).toBe(true);
    expect(overnight('10:00', '16:00')).toBe(false);
  });

  it('words times in the 12-hour style', () => {
    expect(clockLabel('00:00')).toBe('12 AM');
    expect(clockLabel('12:30')).toBe('12:30 PM');
    expect(spanLabel('16:00', '23:30')).toBe('4 PM – 11:30 PM');
  });

  it('adds up hours per person and people per day', () => {
    const shifts = [
      shift({ staffId: 'a', minutes: 360 }),
      shift({ staffId: 'a', day: '2026-11-10', minutes: 420 }),
      shift({ staffId: 'b', minutes: 300 }),
    ];
    expect(Object.fromEntries(minutesByPerson(shifts))).toEqual({ a: 780, b: 300 });
    expect(coverageByDay(shifts, ['2026-11-09', '2026-11-10', '2026-11-11'])).toEqual([
      { day: '2026-11-09', people: 2, minutes: 660 },
      { day: '2026-11-10', people: 1, minutes: 420 },
      { day: '2026-11-11', people: 0, minutes: 0 },
    ]);
  });
});
