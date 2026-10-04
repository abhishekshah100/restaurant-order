/**
 * Where the app reads its data. By default that's the dummy JSON in `public/api/`, served
 * by the static site like real endpoints (`/api/menu.json`). When the backend exists, set
 * NEXT_PUBLIC_API_BASE_URL to its URL and NEXT_PUBLIC_API_SUFFIX to "" — nothing else changes.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api';
export const API_SUFFIX = process.env.NEXT_PUBLIC_API_SUFFIX ?? '.json';

/** Full URL of an endpoint path, e.g. "menu" → "/api/menu.json". */
export const apiUrl = (path: string) => `${API_BASE_URL}/${path}${API_SUFFIX}`;

/*
 * The mock server (api/mock) answers the server-owned endpoints (sessions, OTP, orders,
 * payments, service requests) in the browser until the backend exists. On by default; set
 * NEXT_PUBLIC_API_MOCK=false to send every request to the backend. These are read per call
 * (Next inlines them at build time) so tests can switch them.
 */

/** True unless NEXT_PUBLIC_API_MOCK is "false". */
export const isMockApi = () => process.env.NEXT_PUBLIC_API_MOCK !== 'false';

/**
 * The mock server's response time in ms, as `[min, max]`: NEXT_PUBLIC_API_MOCK_LATENCY_MS is
 * "200-400" (the default) or one number ("0" in unit tests).
 */
export function mockLatencyRange(): [number, number] {
  const raw = process.env.NEXT_PUBLIC_API_MOCK_LATENCY_MS ?? '200-400';
  const [min, max = min] = raw.split('-').map((n) => Math.max(0, Number(n) || 0));
  return [min, Math.max(min, max)];
}
