/*
 * The backend's times on the device's clock. A phone's clock can be minutes or days off; the
 * screens compare the times the backend sends (a session's expiry, when a code can be re-sent)
 * with `Date.now()`, so they're moved by how far the device's clock is from the server's (its
 * `Date` header). The server still decides: it checks every session and code on its own clock.
 */

/** The backend's timestamps the screens compare with the device's clock. */
const SERVER_TIMES = ['startedAt', 'expiresAt', 'sentAt', 'resendAt'] as const;

/** Clocks closer than this agree (the `Date` header has whole seconds, and the answer travels). */
const AGREE_MS = 5_000;

/** How far the device's clock runs ahead of the server's (negative: behind), in ms; 0 if they agree. */
export function deviceClockOffset(
  serverDate: string | null | undefined,
  deviceNow: number,
): number {
  const server = Date.parse(serverDate ?? '');
  if (Number.isNaN(server)) return 0;
  const offset = deviceNow - server;
  return Math.abs(offset) < AGREE_MS ? 0 : offset;
}

/** An answer's timestamps moved onto the device's clock. */
export function toDeviceTimes<T>(value: T, offset: number): T {
  if (offset === 0 || typeof value !== 'object' || value === null || Array.isArray(value)) {
    return value;
  }
  const moved = { ...value } as Record<string, unknown>;
  for (const key of SERVER_TIMES) {
    const time = moved[key];
    if (typeof time === 'number') moved[key] = time + offset;
  }
  return moved as T;
}
