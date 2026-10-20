import type { ApiErrorBody, ApiErrorCode } from './contracts';
import { backendUrl, isBackendRequest } from './backend';
import { REQUEST_TIMEOUT_MS, apiUrl, isMockApi } from './config';

/**
 * A request that failed. `status` is the HTTP status, or 0 when no answer came back (offline,
 * the server unreachable, or it took too long). Screens branch on `code`, the contract's error
 * code, and read its extras from `body` (`tables`, `shortBy`…).
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    /** The error body the server sent (see api/contracts), if any. */
    readonly body?: ApiErrorBody,
  ) {
    super(
      status === 0
        ? `Request to ${url} got no answer`
        : `Request to ${url} failed with ${status}${body ? ` (${body.error})` : ''}`,
    );
    this.name = 'ApiError';
  }

  get code(): ApiErrorCode | undefined {
    return this.body?.error;
  }

  /** No answer came back: worth trying again. */
  get isNetworkError(): boolean {
    return this.status === 0;
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
  /** Request headers, names in lower case (e.g. `authorization` on admin requests). */
  headers?: Record<string, string>;
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

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * The backend's envelope (restaurant-backend › docs/decisions.md › ADR-004) read into the
 * shapes the screens use: `{ success: true, data }` → `data`; `{ success: false, error: { code,
 * details } }` → an ApiError whose body is the contract's `{ error: code, ...extras }`.
 */
function unwrapEnvelope<T>({ status, body }: ApiResponse, url: string): T {
  if (status >= 200 && status <= 299) {
    return (isObject(body) ? body.data : undefined) as T;
  }
  const error = isObject(body) && isObject(body.error) ? body.error : undefined;
  const code = typeof error?.code === 'string' ? error.code : undefined;
  const extras = isObject(error?.details) ? error.details : {};
  throw new ApiError(status, url, code ? ({ ...extras, error: code } as ApiErrorBody) : undefined);
}

/** JSON text, or undefined for an empty or non-JSON body (a proxy's HTML error page). */
function parseJson(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * One HTTP request. It gives up after REQUEST_TIMEOUT_MS unless the caller passed its own
 * signal; no answer at all (offline, unreachable, timed out) is an ApiError with status 0.
 */
async function http<T>(
  url: string,
  { method, body }: ApiRequest,
  init: RequestInit | undefined,
  read: (response: ApiResponse, url: string) => T,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...init?.headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError(0, url);
  }
  const text = res.status === 204 ? '' : await res.text().catch(() => '');
  return read({ status: res.status, body: parseJson(text) }, url);
}

/** The dummy JSON (or a server answering the contract's bare shapes). */
const viaFetch = <T>(request: ApiRequest, init?: RequestInit): Promise<T> =>
  http(apiUrl(request.path), request, init, unwrap<T>);

/** The backend, for the endpoints it serves (api/backend.ts). */
const viaBackend = <T>(request: ApiRequest, init?: RequestInit): Promise<T> =>
  http(backendUrl(request.path), request, init, unwrapEnvelope<T>);

/**
 * The transport. Endpoints the backend serves go to it when NEXT_PUBLIC_BACKEND_URL is set
 * (api/backend.ts). Otherwise, with the mock on (NEXT_PUBLIC_API_MOCK, default), the in-browser
 * mock server answers the endpoints it owns; everything else is a plain HTTP request for the
 * dummy JSON. The mock is loaded on first use, so a backend build never runs it.
 */
async function send<T>(request: ApiRequest, init?: RequestInit): Promise<T> {
  if (isBackendRequest(request)) return viaBackend<T>(request, init);
  if (isMockApi()) {
    const { handleMockRequest } = await import('./mock/server');
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    const response = await handleMockRequest({ ...request, headers });
    if (response) return unwrap<T>(response, apiUrl(request.path));
  }
  return viaFetch<T>(request, init);
}

/**
 * GET over HTTP even while the mock server is on. MOCK ONLY: the mock reads the dummy JSON it
 * builds on (the menu before staff changes) with it.
 */
export const staticGet = <T>(path: string): Promise<T> => viaFetch<T>({ method: 'GET', path });

/** GET an endpoint and parse its JSON body. Throws ApiError on a non-2xx response. */
export const apiGet = <T>(path: string, init?: RequestInit): Promise<T> =>
  send<T>({ method: 'GET', path }, init);

/** POST a JSON body. Throws ApiError (with the server's error code) on a non-2xx response. */
export const apiPost = <T>(path: string, body: unknown, init?: RequestInit): Promise<T> =>
  send<T>({ method: 'POST', path, body }, init);

/** PATCH a JSON body. */
export const apiPatch = <T>(path: string, body: unknown, init?: RequestInit): Promise<T> =>
  send<T>({ method: 'PATCH', path, body }, init);

/** DELETE a resource (204, no body). */
export const apiDelete = (path: string, init?: RequestInit): Promise<void> =>
  send<void>({ method: 'DELETE', path }, init);
