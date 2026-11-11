import { describe, expect, it } from 'vitest';
import {
  attendanceLines,
  instantAt,
  needsAttention,
  statusesOf,
  totalsByPerson,
  typedTimes,
  wallTime,
} from '@/lib/attendance';
import type { MissedShift, ShiftListResponse, ShiftRow } from '@/types/admin';

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

describe('Team › Attendance: totals', () => {
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
        plannedMinutes: 0,
        late: 0,
        missed: 0,
        ordersTaken: 4,
        collected: 1500,
        tips: 20,
      },
      {
        id: 'p',
        name: 'Priya',
        shifts: 1,
        minutes: 480,
        plannedMinutes: 0,
        late: 0,
        missed: 0,
        ordersTaken: 2,
        collected: 2000,
        tips: 10,
      },
    ]);
  });

  it('adds planned hours, late shift-ins and missed shifts', () => {
    const planned = { startsAt: '', endsAt: '', minutes: 360, breakMinutes: 0 };
    const [arjun] = totalsByPerson(
      [{ ...shift('a', 'Arjun', 300, 0), planned, lateMinutes: 20 }],
      [{ id: 'm', staff: { id: 'a', name: 'Arjun' }, planned }],
    );
    expect(arjun).toMatchObject({
      shifts: 1,
      minutes: 300,
      plannedMinutes: 720,
      late: 1,
      missed: 1,
    });
  });
});

describe('Team › Attendance: each line', () => {
  const NOW = new Date('2026-11-12T14:00:00Z');
  const planned = {
    startsAt: '2026-11-12T04:30:00Z',
    endsAt: '2026-11-12T10:30:00Z',
    minutes: 360,
    breakMinutes: 0,
  };
  const worked = (fields: Partial<ShiftRow>): ShiftRow => ({
    ...shift('a', 'Arjun', 360, 0),
    startedAt: '2026-11-12T04:30:00Z',
    endedAt: '2026-11-12T10:30:00Z',
    ...fields,
  });
  const missed: MissedShift = { id: 'm1', staff: { id: 'k', name: 'Kiran' }, planned };
  const data = (shifts: ShiftRow[], extra: Partial<ShiftListResponse> = {}): ShiftListResponse => ({
    from: '2026-11-12',
    to: '2026-11-12',
    shifts,
    missed: [],
    expected: [],
    ...extra,
  });
  const status = (s: ShiftRow, rota = true) =>
    statusesOf(attendanceLines(data([s]))[0]!, NOW, rota);

  it('names how each shift went, the main word first', () => {
    expect(status(worked({ planned }))).toEqual(['onTime']);
    expect(status(worked({ planned, lateMinutes: 12, leftEarlyMinutes: 20 }))).toEqual([
      'late',
      'leftEarly',
    ]);
    expect(status(worked({ planned, extraMinutes: 30 }))).toEqual(['extra']);
    // Still on (started 2 h ago): working; not on the rota only matters when the rota is used.
    expect(status(worked({ startedAt: '2026-11-12T12:00:00Z', endedAt: undefined }))).toEqual([
      'working',
    ]);
    expect(status(worked({}))).toEqual(['unplanned']);
    expect(status(worked({}), false)).toEqual([]);
  });

  it('flags a missing shift out: closed by the system, or on for over 12 hours', () => {
    expect(status(worked({ planned, autoClosed: true, lateMinutes: 9 }))).toEqual([
      'outMissing',
      'late',
    ]);
    const longOpen = worked({ startedAt: '2026-11-12T01:00:00Z', endedAt: undefined });
    expect(status(longOpen)).toEqual(['outMissing']);
    const lines = attendanceLines(
      data([worked({ autoClosed: true }), worked({ id: 'ok', planned })], { missed: [missed] }),
    );
    expect(needsAttention(lines, NOW).map((l) => l.kind)).toEqual(['worked', 'absent']);
  });

  it('lists worked, absent and still-to-come lines, newest first', () => {
    const later = {
      ...missed,
      id: 'e1',
      planned: { ...planned, startsAt: '2026-11-12T15:00:00Z' },
    };
    const lines = attendanceLines(
      data([worked({ planned })], { missed: [missed], expected: [later] }),
    );
    expect(lines.map((l) => l.kind)).toEqual(['expected', 'worked', 'absent']);
  });
});

describe('Team › Attendance: the branch’s clock', () => {
  it('turns a typed day and time into the instant, wherever the branch is', () => {
    expect(instantAt('2026-11-12', '18:00', 'Asia/Kolkata').toISOString()).toBe(
      '2026-11-12T12:30:00.000Z',
    );
    expect(instantAt('2026-11-12', '09:15', 'Asia/Kathmandu').toISOString()).toBe(
      '2026-11-12T03:30:00.000Z',
    );
    // London: summer time in July, not in November.
    expect(instantAt('2026-07-01', '10:00', 'Europe/London').toISOString()).toBe(
      '2026-07-01T09:00:00.000Z',
    );
    expect(instantAt('2026-11-12', '10:00', 'Europe/London').toISOString()).toBe(
      '2026-11-12T10:00:00.000Z',
    );
    expect(wallTime('2026-11-12T12:30:00.000Z', 'Asia/Kolkata')).toBe('18:00');
  });

  it('ends a night shift the next day, and leaves a shift still on without an end', () => {
    expect(typedTimes('2026-11-12', '18:00', '01:30', 'Asia/Kolkata')).toEqual({
      startedAt: '2026-11-12T12:30:00.000Z',
      endedAt: '2026-11-12T20:00:00.000Z',
      overnight: true,
    });
    expect(typedTimes('2026-11-12', '10:00', '16:00', 'Asia/Kolkata').overnight).toBe(false);
    expect(typedTimes('2026-11-12', '10:00', null, 'Asia/Kolkata')).toEqual({
      startedAt: '2026-11-12T04:30:00.000Z',
      overnight: false,
    });
  });
});
