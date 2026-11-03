/*
 * A temporary password an admin gives someone (new, or reset): 10 characters they can read out,
 * without the ones that look alike (0/O, 1/l/I), with a capital, a small letter and a digit.
 */

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';
const ALL = UPPER + LOWER + DIGITS;
const LENGTH = 10;

const pick = (set: string, random: number) => set[random % set.length] ?? '';

export function temporaryPassword(random: (n: number) => Uint32Array = randomValues): string {
  const r = random(LENGTH);
  const chars = [pick(UPPER, r[0] ?? 0), pick(LOWER, r[1] ?? 0), pick(DIGITS, r[2] ?? 0)];
  for (let i = 3; i < LENGTH; i++) chars.push(pick(ALL, r[i] ?? 0));
  // The three kinds somewhere in it, not always first.
  const shift = (r[0] ?? 0) % LENGTH;
  return [...chars.slice(shift), ...chars.slice(0, shift)].join('');
}

function randomValues(n: number): Uint32Array {
  return crypto.getRandomValues(new Uint32Array(n));
}

/** At least 8 characters, as the server asks. */
export const isPasswordLongEnough = (password: string) => password.length >= 8;
