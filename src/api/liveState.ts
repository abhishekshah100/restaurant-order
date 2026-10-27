/*
 * Whether the branch's events are coming in (api/liveEvents), for the queries that poll: while
 * they are, the branch's pages poll rarely (LIVE_REFRESH_MS), as a safety net. Plain module
 * state, usable on the server (where it's never connected).
 */

/** How often the branch's pages poll while events come in. */
export const LIVE_REFRESH_MS = 60_000;

let connected = false;
const listeners = new Set<() => void>();

export function setEventsConnected(value: boolean) {
  if (connected === value) return;
  connected = value;
  listeners.forEach((l) => l());
}

/** Whether the branch's events are coming in now. */
export const eventsConnected = () => connected;

export function subscribeEventsConnected(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** How often a branch's page polls: rarely while its events come in. */
export const liveRefresh = (ms: number) => () => (connected ? LIVE_REFRESH_MS : ms);
