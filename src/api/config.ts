/**
 * Where the app reads its data. By default that's the dummy JSON in `public/api/`, served
 * by the static site like real endpoints (`/api/menu.json`). When the backend exists, set
 * NEXT_PUBLIC_API_BASE_URL to its URL and NEXT_PUBLIC_API_SUFFIX to "" — nothing else changes.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api';
export const API_SUFFIX = process.env.NEXT_PUBLIC_API_SUFFIX ?? '.json';

/** Full URL of an endpoint path, e.g. "menu" → "/api/menu.json". */
export const apiUrl = (path: string) => `${API_BASE_URL}/${path}${API_SUFFIX}`;
