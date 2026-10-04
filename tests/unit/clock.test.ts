import { describe, expect, it } from 'vitest';
import { createClock } from '@/lib/clock';
import { testBranch } from '../apiState';

const kolkata = createClock(testBranch());
const kathmandu = createClock(testBranch('ktm-thamel'));

describe('clock', () => {
  const at = new Date('2026-10-03T14:12:00Z');

  it("shows times in the branch's time zone", () => {
    expect(kolkata.time(at)).toBe('7:42 PM');
    expect(kathmandu.time(at)).toBe('7:57 PM');
    expect(kolkata.time('2026-10-03T03:30:00Z')).toBe('9:00 AM');
  });

  it('dates in the branch time zone', () => {
    expect(kolkata.date('2026-09-12T14:48:00Z')).toBe('12 Sep 2026');
  });

  it('works out "today" in the branch time zone', () => {
    // 18:20 UTC is 23:50 in India but already 00:05 the next day in Nepal.
    const late = new Date('2026-10-03T18:20:00Z');
    expect(kolkata.dayKey(late)).toBe('2026-10-03');
    expect(kathmandu.dayKey(late)).toBe('2026-10-04');
    expect(kolkata.isSameDay(late, '2026-10-03T04:00:00Z')).toBe(true);
    expect(kathmandu.isSameDay(late, '2026-10-03T04:00:00Z')).toBe(false);
  });

  it('writes local times with the branch offset', () => {
    const now = new Date('2026-10-03T12:00:00Z');
    expect(kolkata.localTimestamp(0, '19:42', now)).toBe('2026-10-03T19:42:00+05:30');
    expect(kathmandu.localTimestamp(1, '08:05', now)).toBe('2026-10-02T08:05:00+05:45');
  });
});
