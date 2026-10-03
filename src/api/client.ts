import { apiUrl } from './config';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`Request to ${url} failed with ${status}`);
    this.name = 'ApiError';
  }
}

/** GET an endpoint and parse its JSON body. Throws ApiError on a non-2xx response. */
export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const url = apiUrl(path);
  const res = await fetch(url, { headers: { Accept: 'application/json' }, ...init });
  if (!res.ok) throw new ApiError(res.status, url);
  return (await res.json()) as T;
}
