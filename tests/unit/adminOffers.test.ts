import { describe, expect, it } from 'vitest';
import {
  daysSummary,
  draftOf,
  offerErrors,
  offerRequest,
  offerStanding,
  toggledRequest,
} from '@/lib/adminOffers';
import type { AutoOffer } from '@/types/promotion';

/* Settings › Offers: the form's checks, the request it sends, and where an offer stands. */

const KOLKATA = 'Asia/Kolkata';

const happyHour: AutoOffer = {
  id: 'happy-hour',
  name: 'Happy hour',
  active: true,
  days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  from: '16:00',
  to: '19:00',
  scope: { categories: ['beverages'] },
  type: 'percent',
  value: 20,
  labelKey: 'happyHour',
  modes: ['dineIn', 'takeaway', 'delivery'],
};

describe('the offer form', () => {
  it('starts a new offer as an evening happy hour, for the ways of ordering the branch has', () => {
    const draft = draftOf(undefined, ['dineIn', 'takeaway']);
    expect(draft).toMatchObject({ from: '16:00', to: '19:00', modes: ['dineIn', 'takeaway'] });
    // Nothing named, covered or priced yet.
    expect(offerErrors(draft)).toEqual({ name: 'name', scope: 'scope', value: 'value' });
  });

  it('says what is wrong, the way the server would refuse it', () => {
    const ok = draftOf(happyHour, happyHour.modes);
    expect(offerErrors(ok)).toEqual({});
    expect(offerErrors({ ...ok, value: '150' })).toEqual({ value: 'percent' });
    expect(offerErrors({ ...ok, type: 'flat', value: '150' })).toEqual({});
    expect(offerErrors({ ...ok, value: '0' })).toEqual({ value: 'value' });
    expect(offerErrors({ ...ok, to: '16:00' })).toEqual({ to: 'sameTime' });
    expect(offerErrors({ ...ok, startsOn: '2026-11-30', endsOn: '2026-11-01' })).toEqual({
      endsOn: 'dates',
    });
    expect(offerErrors({ ...ok, days: [], modes: [] })).toEqual({ days: 'days', modes: 'modes' });
  });

  it('sends days and modes in week order, dates only when set, and pauses or switches on', () => {
    const draft = { ...draftOf(happyHour, happyHour.modes), days: ['sun', 'sat'] as const };
    const body = offerRequest({ ...draft, days: [...draft.days], name: '  Weekend  ' });
    expect(body).toMatchObject({ name: 'Weekend', days: ['sat', 'sun'], value: 20 });
    expect(body).not.toHaveProperty('startsOn');
    expect(toggledRequest(happyHour).active).toBe(false);
  });
});

describe('where an offer stands', () => {
  const at = (iso: string) => new Date(iso);

  it('on now, waiting for its hours, paused, before its first day or after its last', () => {
    expect(offerStanding(happyHour, at('2026-10-15T11:00:00Z'), KOLKATA)).toBe('live');
    expect(offerStanding(happyHour, at('2026-10-15T06:00:00Z'), KOLKATA)).toBe('scheduled');
    expect(
      offerStanding({ ...happyHour, active: false }, at('2026-10-15T11:00:00Z'), KOLKATA),
    ).toBe('paused');
    expect(
      offerStanding({ ...happyHour, startsOn: '2026-11-01' }, at('2026-10-15T11:00:00Z'), KOLKATA),
    ).toBe('upcoming');
    expect(
      offerStanding({ ...happyHour, endsOn: '2026-10-14' }, at('2026-10-15T11:00:00Z'), KOLKATA),
    ).toBe('ended');
  });

  it('words the days: every day, weekdays, weekends, or the days in week order', () => {
    expect(daysSummary(happyHour.days)).toEqual({ kind: 'every' });
    expect(daysSummary(['fri', 'mon', 'tue', 'wed', 'thu'])).toEqual({ kind: 'weekdays' });
    expect(daysSummary(['sun', 'sat'])).toEqual({ kind: 'weekends' });
    expect(daysSummary(['fri', 'mon'])).toEqual({ kind: 'list', days: ['mon', 'fri'] });
  });
});
