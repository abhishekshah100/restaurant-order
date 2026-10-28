import type { OfferRequest } from '@/api/contracts';
import type { OrderMode } from '@/types/branch';
import type { AutoOffer, Weekday } from '@/types/promotion';
import { isOfferActive, localWeekTime } from './promotions';

/*
 * Settings › Offers, pure: an offer as the form edits it, what's wrong with it (the server's
 * rules: OfferRequest in api/contracts.ts), and where an offer stands now.
 */

export const OFFER_DAYS: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const OFFER_MODES: readonly OrderMode[] = ['dineIn', 'takeaway', 'delivery'];
export const OFFER_NAME_MAX = 40;

/** The form: every field as typed. */
export interface OfferDraft {
  name: string;
  active: boolean;
  days: Weekday[];
  from: string;
  to: string;
  /** "" when there's no limit. */
  startsOn: string;
  endsOn: string;
  modes: OrderMode[];
  categories: string[];
  dishes: string[];
  type: AutoOffer['type'];
  /** As typed. */
  value: string;
}

/** A new offer starts as an evening happy hour on every day, for every way of ordering. */
export function draftOf(offer: AutoOffer | undefined, modes: readonly OrderMode[]): OfferDraft {
  if (!offer) {
    return {
      name: '',
      active: true,
      days: [...OFFER_DAYS],
      from: '16:00',
      to: '19:00',
      startsOn: '',
      endsOn: '',
      modes: [...modes],
      categories: [],
      dishes: [],
      type: 'percent',
      value: '',
    };
  }
  return {
    name: offer.name,
    active: offer.active,
    days: [...offer.days],
    from: offer.from,
    to: offer.to,
    startsOn: offer.startsOn ?? '',
    endsOn: offer.endsOn ?? '',
    modes: [...offer.modes],
    categories: [...(offer.scope.categories ?? [])],
    dishes: [...(offer.scope.dishes ?? [])],
    type: offer.type,
    value: String(offer.value),
  };
}

export type OfferField = 'name' | 'days' | 'to' | 'endsOn' | 'modes' | 'scope' | 'value';
export type OfferProblem =
  'name' | 'days' | 'sameTime' | 'dates' | 'modes' | 'scope' | 'value' | 'percent';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The amount typed, or null when it isn't a positive number with at most two decimals. */
export function offerValue(text: string): number | null {
  const clean = text.replace(/[,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const value = Number(clean);
  return value > 0 ? value : null;
}

/** What's wrong, by field (the first problem of each). */
export function offerErrors(draft: OfferDraft): Partial<Record<OfferField, OfferProblem>> {
  const errors: Partial<Record<OfferField, OfferProblem>> = {};
  const name = draft.name.trim();
  if (name === '' || name.length > OFFER_NAME_MAX) errors.name = 'name';
  if (draft.days.length === 0) errors.days = 'days';
  if (!TIME.test(draft.from) || !TIME.test(draft.to) || draft.from === draft.to) {
    errors.to = 'sameTime';
  }
  if (draft.startsOn && draft.endsOn && draft.endsOn < draft.startsOn) errors.endsOn = 'dates';
  if (draft.modes.length === 0) errors.modes = 'modes';
  if (draft.categories.length + draft.dishes.length === 0) errors.scope = 'scope';
  const value = offerValue(draft.value);
  if (value === null) errors.value = 'value';
  else if (draft.type === 'percent' && value > 100) errors.value = 'percent';
  return errors;
}

/** The request for a checked draft. */
export function offerRequest(draft: OfferDraft): OfferRequest {
  return {
    name: draft.name.trim(),
    active: draft.active,
    days: OFFER_DAYS.filter((d) => draft.days.includes(d)),
    from: draft.from,
    to: draft.to,
    ...(draft.startsOn ? { startsOn: draft.startsOn } : {}),
    ...(draft.endsOn ? { endsOn: draft.endsOn } : {}),
    modes: OFFER_MODES.filter((m) => draft.modes.includes(m)),
    scope: { categories: draft.categories, dishes: draft.dishes },
    type: draft.type,
    value: offerValue(draft.value) ?? 0,
  };
}

/** An offer switched on or off, the rest as it is. */
export const toggledRequest = (offer: AutoOffer): OfferRequest => ({
  ...offerRequest(draftOf(offer, offer.modes)),
  active: !offer.active,
});

/**
 * Where an offer stands now (branch time): on right now, paused, before its first day, past its
 * last day, or switched on and waiting for its next window.
 */
export type OfferStanding = 'live' | 'paused' | 'upcoming' | 'ended' | 'scheduled';

export function offerStanding(offer: AutoOffer, now: Date, timeZone: string): OfferStanding {
  if (!offer.active) return 'paused';
  const { date } = localWeekTime(now, timeZone);
  if (offer.endsOn && date > offer.endsOn) return 'ended';
  if (isOfferActive(offer, now, timeZone)) return 'live';
  if (offer.startsOn && date < offer.startsOn) return 'upcoming';
  return 'scheduled';
}

/** The days as words go: every day, weekdays, weekends, or the days themselves in week order. */
export type DaysSummary =
  { kind: 'every' | 'weekdays' | 'weekends' } | { kind: 'list'; days: Weekday[] };

export function daysSummary(days: readonly Weekday[]): DaysSummary {
  const set = new Set(days);
  const ordered = OFFER_DAYS.filter((d) => set.has(d));
  if (ordered.length === 7) return { kind: 'every' };
  if (ordered.join() === 'mon,tue,wed,thu,fri') return { kind: 'weekdays' };
  if (ordered.join() === 'sat,sun') return { kind: 'weekends' };
  return { kind: 'list', days: ordered };
}
