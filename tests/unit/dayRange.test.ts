import { describe, expect, it } from 'vitest';
import {
  inDayRange,
  isDayKey,
  ordersFilter,
  parseDayRange,
  shiftDay,
  withFrom,
  withTo,
} from '@/lib/dayRange';

/* The range of days staff look back at orders and payments over. */

const TODAY = '2026-10-26';

describe('day range', () => {
  it('works out calendar days', () => {
    expect(shiftDay('2026-11-01', -1)).toBe('2026-10-31');
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
    expect(isDayKey('2026-10-15')).toBe(true);
    expect(isDayKey('2026-02-30')).toBe(false);
    expect(isDayKey('26-10-15')).toBe(false);
  });

  it('reads the address: today by default, one day for the other, always valid', () => {
    expect(parseDayRange(null, null, TODAY)).toEqual({ from: TODAY, to: TODAY });
    expect(parseDayRange('2026-10-20', null, TODAY)).toEqual({
      from: '2026-10-20',
      to: '2026-10-20',
    });
    expect(parseDayRange('nonsense', '2026-10-21', TODAY)).toEqual({
      from: '2026-10-21',
      to: '2026-10-21',
    });
    expect(parseDayRange('2026-10-24', '2026-10-20', TODAY)).toEqual({
      from: '2026-10-20',
      to: '2026-10-24',
    });
    // Past today moves in; too far back moves to the first day; too long keeps the last 31.
    expect(parseDayRange('2026-10-25', '2026-12-01', TODAY)).toEqual({
      from: '2026-10-25',
      to: TODAY,
    });
    expect(parseDayRange('2026-01-01', '2026-07-01', TODAY)).toEqual({
      from: '2026-07-28',
      to: '2026-07-28',
    });
    expect(parseDayRange('2026-08-01', '2026-10-26', TODAY)).toEqual({
      from: '2026-09-26',
      to: TODAY,
    });
  });

  it('moves the other end when a pick would make the range wrong or too long', () => {
    const range = { from: '2026-10-20', to: '2026-10-22' };
    expect(withFrom(range, '2026-10-24', TODAY)).toEqual({ from: '2026-10-24', to: '2026-10-24' });
    expect(withFrom(range, '2026-09-01', TODAY)).toEqual({ from: '2026-09-01', to: '2026-10-01' });
    expect(withTo(range, '2026-10-18', TODAY)).toEqual({ from: '2026-10-18', to: '2026-10-18' });
    expect(withTo({ from: '2026-09-01', to: '2026-09-02' }, TODAY, TODAY)).toEqual({
      from: '2026-09-26',
      to: TODAY,
    });
  });

  it('asks the server for nothing extra on today alone', () => {
    expect(ordersFilter({ from: TODAY, to: TODAY }, TODAY)).toEqual({});
    expect(ordersFilter({ from: '2026-10-20', to: TODAY }, TODAY)).toEqual({
      from: '2026-10-20',
      to: TODAY,
    });
    expect(inDayRange('2026-10-21', { from: '2026-10-20', to: '2026-10-22' })).toBe(true);
    expect(inDayRange('2026-10-23', { from: '2026-10-20', to: '2026-10-22' })).toBe(false);
  });
});
