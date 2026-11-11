import type { MissedShift, ShiftListResponse, ShiftRow } from '@/types/admin';

/*
 * Team › Attendance, worked out from the shifts list: one line per shift worked, planned shift
 * nobody came for, or planned shift still to come; each line's one status word; what needs a
 * manager's eye (a shift out that's missing); totals per person; and the times a manager types
 * (the branch's wall clock) turned into instants and back.
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
/** On shift longer than this: they probably forgot to shift out. */
export const LONG_SHIFT_HOURS = 12;

/** A line on the attendance list. */
export type AttendanceLine =
  | { kind: 'worked'; key: string; at: string; staffId: string; name: string; shift: ShiftRow }
  | { kind: 'absent'; key: string; at: string; staffId: string; name: string; missed: MissedShift }
  | {
      kind: 'expected';
      key: string;
      at: string;
      staffId: string;
      name: string;
      planned: MissedShift;
    };

/**
 * How a line went, the one word shown first (then any extras): working now, a shift out that's
 * missing, absent, still to come, late, left early, extra time, not on the rota, on time.
 */
export type AttendanceStatus =
  | 'working'
  | 'outMissing'
  | 'absent'
  | 'expected'
  | 'late'
  | 'leftEarly'
  | 'extra'
  | 'unplanned'
  | 'onTime';

/** Every line, newest first: shifts worked, planned ones nobody came for, those still to come. */
export function attendanceLines(data: ShiftListResponse): AttendanceLine[] {
  const lines: AttendanceLine[] = [
    ...data.shifts.map((shift) => ({
      kind: 'worked' as const,
      key: `w-${shift.id}`,
      at: shift.startedAt,
      staffId: shift.staff.id,
      name: shift.staff.name,
      shift,
    })),
    ...(data.missed ?? []).map((missed) => ({
      kind: 'absent' as const,
      key: `a-${missed.id}`,
      at: missed.planned.startsAt,
      staffId: missed.staff.id,
      name: missed.staff.name,
      missed,
    })),
    ...(data.expected ?? []).map((planned) => ({
      kind: 'expected' as const,
      key: `e-${planned.id}`,
      at: planned.planned.startsAt,
      staffId: planned.staff.id,
      name: planned.staff.name,
      planned,
    })),
  ];
  return lines.sort((a, b) => b.at.localeCompare(a.at));
}

/** Still on shift for longer than a shift should run: they likely forgot to shift out. */
export const isLongOpen = (shift: ShiftRow, now: Date) =>
  !shift.endedAt && now.getTime() - Date.parse(shift.startedAt) > LONG_SHIFT_HOURS * HOUR_MS;

/** A shift whose shift out is missing: closed by the system, or on for far too long. */
export const outMissing = (shift: ShiftRow, now: Date) =>
  Boolean(shift.autoClosed) || isLongOpen(shift, now);

/** A line's statuses, the main one first. Not on the rota counts only when the rota is in use. */
export function statusesOf(
  line: AttendanceLine,
  now: Date,
  rotaInUse: boolean,
): AttendanceStatus[] {
  if (line.kind === 'absent') return ['absent'];
  if (line.kind === 'expected') return ['expected'];
  const s = line.shift;
  if (outMissing(s, now)) return ['outMissing', ...(s.lateMinutes ? ['late' as const] : [])];
  const found: AttendanceStatus[] = [];
  if (!s.endedAt) found.push('working');
  if (s.lateMinutes) found.push('late');
  if (s.leftEarlyMinutes) found.push('leftEarly');
  if (s.extraMinutes) found.push('extra');
  if (found.length === 0) {
    if (!s.planned) {
      if (rotaInUse) found.push('unplanned');
    } else found.push('onTime');
  }
  return found;
}

/** Whether the branch plans with the rota on these days (else nothing is "not on the rota"). */
export const rotaInUse = (data: ShiftListResponse) =>
  (data.missed?.length ?? 0) > 0 ||
  (data.expected?.length ?? 0) > 0 ||
  data.shifts.some((s) => s.planned);

/** What a manager should look at: shifts out missing, then who didn't come, oldest first. */
export function needsAttention(lines: readonly AttendanceLine[], now: Date): AttendanceLine[] {
  return lines
    .filter((l) => (l.kind === 'worked' ? outMissing(l.shift, now) : l.kind === 'absent'))
    .sort((a, b) => {
      const rank = (l: AttendanceLine) => (l.kind === 'worked' ? 0 : 1);
      return rank(a) - rank(b) || a.at.localeCompare(b.at);
    });
}

export interface PersonTotals {
  id: string;
  name: string;
  /** Shifts worked. */
  shifts: number;
  minutes: number;
  /** Planned on the rota: the shifts worked and those missed. */
  plannedMinutes: number;
  late: number;
  missed: number;
  ordersTaken: number;
  collected: number;
  tips: number;
}

/**
 * Each person's shifts on these days, added up: worked against planned, times late, planned
 * shifts they didn't come for; most hours first.
 */
export function totalsByPerson(
  shifts: readonly ShiftRow[],
  missed: readonly MissedShift[] = [],
): PersonTotals[] {
  const people = new Map<string, PersonTotals>();
  const of = (staff: { id: string; name: string }) => {
    const p = people.get(staff.id) ?? {
      id: staff.id,
      name: staff.name,
      shifts: 0,
      minutes: 0,
      plannedMinutes: 0,
      late: 0,
      missed: 0,
      ordersTaken: 0,
      collected: 0,
      tips: 0,
    };
    people.set(staff.id, p);
    return p;
  };
  for (const s of shifts) {
    const p = of(s.staff);
    p.shifts += 1;
    p.minutes += s.minutes;
    p.plannedMinutes += s.planned?.minutes ?? 0;
    if (s.lateMinutes) p.late += 1;
    p.ordersTaken += s.ordersTaken;
    p.collected += s.collected;
    p.tips += s.tips;
  }
  for (const m of missed) {
    const p = of(m.staff);
    p.missed += 1;
    p.plannedMinutes += m.planned.minutes;
  }
  return [...people.values()].sort((a, b) => b.minutes - a.minutes);
}

/* ---------- The branch's wall clock ---------- */

/** "+05:30" → minutes east of UTC, at that instant in that zone. */
function offsetMinutes(at: Date, timeZone: string): number {
  const name =
    new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const match = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name);
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0));
}

/** The instant of "HH:MM" on `day` ("2026-11-12") on the branch's clock. */
export function instantAt(day: string, time: string, timeZone: string): Date {
  const [y, mo, d] = day.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const wall = Date.UTC(y ?? 1970, (mo ?? 1) - 1, d ?? 1, h ?? 0, mi ?? 0);
  // The zone's offset at the guess, checked again at the answer (a clock change in between).
  let at = wall - offsetMinutes(new Date(wall), timeZone) * MINUTE_MS;
  at = wall - offsetMinutes(new Date(at), timeZone) * MINUTE_MS;
  return new Date(at);
}

/** "18:05" on the branch's clock (for a time field). */
export const wallTime = (at: Date | string, timeZone: string) =>
  new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(typeof at === 'string' ? new Date(at) : at);

/** The day after "2026-11-12". */
const nextDay = (day: string) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/**
 * The times a manager typed, as instants: in on `day`; out the same day, or the next when it's
 * at or before the in time (a night shift). No out: still on shift.
 */
export function typedTimes(
  day: string,
  inTime: string,
  outTime: string | null,
  timeZone: string,
): { startedAt: string; endedAt?: string; overnight: boolean } {
  const start = instantAt(day, inTime, timeZone);
  if (!outTime) return { startedAt: start.toISOString(), overnight: false };
  const overnight = outTime <= inTime;
  const end = instantAt(overnight ? nextDay(day) : day, outTime, timeZone);
  return { startedAt: start.toISOString(), endedAt: end.toISOString(), overnight };
}

/** Minutes between two instants (none when either is missing). */
export const minutesBetween = (from: string, to?: string) =>
  to ? Math.round((Date.parse(to) - Date.parse(from)) / MINUTE_MS) : null;
