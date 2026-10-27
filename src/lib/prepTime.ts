/*
 * A dish's prep time as staff write it on the menu ("15 min", "12–15 min") and guests read it.
 * The kitchen reads it too: a round is due when its slowest dish is done. The server checks the
 * same form (restaurant-backend › menu.rules).
 */

/** "15", "15 min", "12–15 min" or "12-15 mins": one time, or a range, in minutes. */
const PREP_TIME = /^\s*(\d{1,3})\s*(?:[–-]\s*(\d{1,3}))?\s*(?:min|mins|minutes)?\s*$/i;

/** The minutes a prep time says (a range's longest: what the kitchen plans for); null if none. */
export function prepMinutes(text: string | undefined): number | null {
  const match = text ? PREP_TIME.exec(text) : null;
  if (!match) return null;
  const longest = Number(match[2] ?? match[1]);
  return longest > 0 && longest <= 240 ? longest : null;
}

/** A prep time the way the menu writes it ("12–15 min"), or null if it isn't one. */
export function tidyPrepTime(text: string): string | null {
  const match = PREP_TIME.exec(text);
  if (!match || prepMinutes(text) === null) return null;
  return match[2] ? `${match[1]}–${match[2]} min` : `${match[1]} min`;
}
