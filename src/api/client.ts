import type { ApiErrorBody, ApiErrorCode } from './contracts';
import { apiUrl, isMockApi } from './config';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    /** The error body the server sent (see api/contracts), if any. */
    readonly body?: ApiErrorBody,
  ) {
    super(`Request to ${url} failed with ${status}${body ? ` (${body.error})` : ''}`);
    this.name = 'ApiError';
  }

  get code(): ApiErrorCode | undefined {
    return this.body?.error;
  }
}

/** True for an ApiError with this error code. */
export const isApiError = (error: unknown, code: ApiErrorCode): error is ApiError =>
  error instanceof ApiError && error.code === code;

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/** One request as the transport sees it; `path` is relative to the API base ("orders/A105"). */
export interface ApiRequest {
  method: HttpMethod;
  path: string;
  body?: unknown;
}

/** A response from the mock server, shaped like an HTTP one. */
export interface ApiResponse {
  status: number;
  body?: unknown;
}

const isErrorBody = (v: unknown): v is ApiErrorBody =>
  typeof v === 'object' && v !== null && typeof (v as ApiErrorBody).error === 'string';

function unwrap<T>({ status, body }: ApiResponse, url: string): T {
  if (status < 200 || status > 299) {
    throw new ApiError(status, url, isErrorBody(body) ? body : undefined);
  }
  return body as T;
}

async function viaFetch<T>({ method, path, body }: ApiRequest, init?: RequestInit): Promise<T> {
  const url = apiUrl(path);
  const res = await fetch(url, {
    method,
    ...init,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = res.status === 204 ? '' : await res.text();
  return unwrap<T>({ status: res.status, body: text ? JSON.parse(text) : undefined }, url);
}

/**
 * The transport. With the mock on (NEXT_PUBLIC_API_MOCK, default), the in-browser mock server
 * answers the endpoints it owns; everything else (and everything with the mock off) is a
 * real HTTP request. The mock is loaded on first use, so a backend build never runs it.
 */
async function send<T>(request: ApiRequest, init?: RequestInit): Promise<T> {
  if (isMockApi()) {
    const { handleMockRequest } = await import('./mock/server');
    const response = await handleMockRequest(request);
    if (response) return unwrap<T>(response, apiUrl(request.path));
  }
  return viaFetch<T>(request, init);
}

/** GET an endpoint and parse its JSON body. Throws ApiError on a non-2xx response. */
export const apiGet = <T>(path: string, init?: RequestInit): Promise<T> =>
  send<T>({ method: 'GET', path }, init);

/** POST a JSON body. Throws ApiError (with the server's error code) on a non-2xx response. */
export const apiPost = <T>(path: string, body: unknown): Promise<T> =>
  send<T>({ method: 'POST', path, body });

/** PATCH a JSON body. */
export const apiPatch = <T>(path: string, body: unknown): Promise<T> =>
  send<T>({ method: 'PATCH', path, body });

/** DELETE a resource (204, no body). */
export const apiDelete = (path: string): Promise<void> => send<void>({ method: 'DELETE', path });
