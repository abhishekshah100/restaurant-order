import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from '@/api/client';
import { isBackendRequest } from '@/api/backend';
import { makeQueryClient } from '@/api/queryClient';
import { adminSession, signInAdmin } from '@/lib/adminAuth';

/*
 * The transport with NEXT_PUBLIC_BACKEND_URL set: the endpoints restaurant-backend serves go to
 * it and its envelope is read into the contract's shapes; failures become ApiErrors the screens
 * already handle; everything else stays on the mock.
 */

const BACKEND = 'http://localhost:4000/v1';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let fetchMock: ReturnType<typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>>;

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_BACKEND_URL', `${BACKEND}/`);
  vi.stubEnv('NEXT_PUBLIC_API_MOCK_LATENCY_MS', '0');
  fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
    Promise.resolve(json({ success: true, data: null })),
  );
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('which requests go to the backend', () => {
  it('sends the routes it serves, and nothing else', () => {
    expect(isBackendRequest({ method: 'POST', path: 'admin/sessions' })).toBe(true);
    expect(isBackendRequest({ method: 'PATCH', path: 'admin/branches/ktm-thamel/settings' })).toBe(
      true,
    );
    expect(isBackendRequest({ method: 'GET', path: 'branches' })).toBe(true);
    expect(isBackendRequest({ method: 'GET', path: 'branches/blr/menu' })).toBe(true);
    expect(
      isBackendRequest({
        method: 'PATCH',
        path: 'admin/branches/blr/menu/dishes/dahi-kebab/availability',
      }),
    ).toBe(true);
    expect(isBackendRequest({ method: 'GET', path: 'branches/blr/promotions' })).toBe(false);
    expect(isBackendRequest({ method: 'POST', path: 'orders' })).toBe(false);
    vi.stubEnv('NEXT_PUBLIC_BACKEND_URL', '');
    expect(isBackendRequest({ method: 'GET', path: 'branches' })).toBe(false);
  });
});

describe('the backend transport', () => {
  it('returns the data of a success, sending JSON with the bearer token', async () => {
    fetchMock.mockResolvedValueOnce(json({ success: true, data: { branches: [{ id: 'blr' }] } }));
    const res = await apiGet('admin/branches', { headers: { Authorization: 'Bearer t0k' } });
    expect(res).toEqual({ branches: [{ id: 'blr' }] });
    const [url, init] = fetchMock.mock.lastCall ?? [];
    expect(url).toBe(`${BACKEND}/admin/branches`);
    expect(init?.headers).toMatchObject({
      Accept: 'application/json',
      Authorization: 'Bearer t0k',
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    // TanStack Query is the cache: the browser's HTTP cache must never answer for the backend.
    expect(init?.cache).toBe('no-store');

    fetchMock.mockResolvedValueOnce(json({ success: true, data: { status: 'paused' } }));
    await apiPatch('admin/branches/blr/status', { status: 'paused', minutes: 15 });
    expect(fetchMock.mock.lastCall?.[1]).toMatchObject({
      method: 'PATCH',
      body: JSON.stringify({ status: 'paused', minutes: 15 }),
      headers: { 'Content-Type': 'application/json' },
    });

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(apiDelete('admin/branches/blr')).resolves.toBeUndefined();
  });

  it("turns an error into the contract's ApiError, with its extras", async () => {
    const tables = [{ number: 3, reason: 'openOrder', change: 'removed' }];
    fetchMock.mockResolvedValueOnce(
      json(
        {
          success: false,
          error: { code: 'table_in_use', message: 'Some tables…', details: { tables } },
        },
        409,
      ),
    );
    await expect(apiPatch('admin/branches/blr/floors', { floors: [] })).rejects.toMatchObject({
      status: 409,
      code: 'table_in_use',
      body: { error: 'table_in_use', tables },
    });

    // Validation issues come as a list: the code is kept, the list isn't an extra.
    fetchMock.mockResolvedValueOnce(
      json({ success: false, error: { code: 'invalid_request', details: [{ path: 'x' }] } }, 400),
    );
    await expect(apiPost('admin/sessions', {})).rejects.toMatchObject({
      status: 400,
      body: { error: 'invalid_request' },
    });
  });

  it('turns no answer, a timeout or a proxy error page into an ApiError', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const offline = await apiGet('branches').catch((e: unknown) => e);
    expect(offline).toBeInstanceOf(ApiError);
    expect(offline).toMatchObject({ status: 0, isNetworkError: true, code: undefined });

    fetchMock.mockResolvedValueOnce(new Response('<html>Bad gateway</html>', { status: 502 }));
    await expect(apiGet('branches')).rejects.toMatchObject({ status: 502, code: undefined });
  });

  it('leaves the endpoints the backend does not serve on the mock', async () => {
    await apiGet('restaurant').catch(() => undefined);
    expect(fetchMock.mock.lastCall?.[0]).toBe('/api/restaurant.json');
  });
});

describe('staff sessions across the app', () => {
  it('signs staff out when any request answers unauthorized', async () => {
    signInAdmin({
      token: 't0k',
      admin: { name: 'A', email: 'a@x.dev', phone: '+919800000000' },
      expiresAt: Date.now() + 60_000,
    });
    fetchMock.mockResolvedValueOnce(
      json(
        { success: false, error: { code: 'unauthorized', message: 'Sign in to continue.' } },
        401,
      ),
    );
    const client = makeQueryClient();
    await client
      .fetchQuery({ queryKey: ['admin', 'branches'], queryFn: () => apiGet('admin/branches') })
      .catch(() => undefined);
    expect(adminSession()).toBeNull();
  });

  it('retries once when no answer came back or the server failed, never on a 4xx', async () => {
    const client = makeQueryClient();
    const retry = client.getDefaultOptions().queries?.retry as (n: number, e: Error) => boolean;
    expect(retry(0, new ApiError(0, 'x'))).toBe(true);
    expect(retry(0, new ApiError(503, 'x'))).toBe(true);
    expect(retry(1, new ApiError(503, 'x'))).toBe(false);
    expect(retry(0, new ApiError(404, 'x'))).toBe(false);
  });
});
