import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isBackendRequest } from '@/api/backend';
import { ApiError } from '@/api/client';
import { api } from '@/api/endpoints';
import { sampleText } from '@/components/devSetup/SetupTemplates';
import { guestTableLink, parsePasted, saveDevKey, savedDevKey } from '@/lib/devSetup';

/*
 * The developer setup page: its requests go to the backend with the developer key (never a staff
 * token), the pasted JSON is read before anything is sent, and an import's table links open the
 * table as its printed QR code does.
 */

const BACKEND = 'http://localhost:4000/v1';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let fetchMock: ReturnType<typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>>;

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_BACKEND_URL', BACKEND);
  fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
    Promise.resolve(json({ success: true, data: [] })),
  );
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  saveDevKey(null);
});

describe('developer setup requests', () => {
  it('go to the backend', () => {
    expect(isBackendRequest({ method: 'POST', path: 'dev/setup/check' })).toBe(true);
    expect(isBackendRequest({ method: 'POST', path: 'dev/setup/import' })).toBe(true);
    expect(isBackendRequest({ method: 'GET', path: 'dev/setup/restaurants' })).toBe(true);
    expect(isBackendRequest({ method: 'POST', path: 'dev/setup/restaurants/abc/reset' })).toBe(
      true,
    );
    expect(isBackendRequest({ method: 'DELETE', path: 'dev/setup/restaurants/abc' })).toBe(true);
  });

  it('carry the developer key, and the JSON as `data`', async () => {
    await api.setupRestaurants('the-key');
    await api.importSetup('the-key', {
      data: { restaurant: { name: 'Momo House' } },
      replace: true,
    });
    const [list, imported] = fetchMock.mock.calls;
    expect(list?.[0]).toBe(`${BACKEND}/dev/setup/restaurants`);
    expect(new Headers(list?.[1]?.headers).get('X-Dev-Key')).toBe('the-key');
    expect(new Headers(imported?.[1]?.headers).get('Authorization')).toBeNull();
    expect(JSON.parse(String(imported?.[1]?.body))).toEqual({
      data: { restaurant: { name: 'Momo House' } },
      replace: true,
    });
  });

  it("read an import's problems from the error", async () => {
    fetchMock.mockResolvedValueOnce(
      json(
        {
          success: false,
          error: {
            code: 'invalid_request',
            message: '…',
            details: { issues: [{ path: 'staff[0].phone', message: 'given twice' }], warnings: [] },
          },
        },
        400,
      ),
    );
    const error = await api.importSetup('k', { data: {}, replace: false }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).body?.issues).toEqual([
      { path: 'staff[0].phone', message: 'given twice' },
    ]);
  });
});

describe('developer setup templates', () => {
  it('are read with the key, and the sample pastes back as the same JSON', async () => {
    const sample = { restaurant: { name: 'Sample Momo House' } };
    fetchMock.mockResolvedValueOnce(json({ success: true, data: { sample, prompt: 'Turn…' } }));
    const templates = await api.setupTemplates('the-key');
    const [call] = fetchMock.mock.calls;
    expect(call?.[0]).toBe(`${BACKEND}/dev/setup/templates`);
    expect(new Headers(call?.[1]?.headers).get('X-Dev-Key')).toBe('the-key');
    expect(isBackendRequest({ method: 'GET', path: 'dev/setup/templates' })).toBe(true);
    const text = sampleText(templates.sample);
    expect(text.endsWith('}\n')).toBe(true);
    expect(parsePasted(text)).toEqual({ ok: true, data: sample });
  });
});

describe('developer setup helpers', () => {
  it('say why pasted text is not JSON', () => {
    expect(parsePasted('{"a": 1}')).toEqual({ ok: true, data: { a: 1 } });
    const bad = parsePasted('{ “restaurant”: 1 }');
    expect(bad.ok).toBe(false);
  });

  it('link a table as its QR code does', () => {
    expect(
      guestTableLink('https://olive.example', 'kathmandu-thamel', { number: 3, qrToken: 'v1.abc' }),
    ).toBe('https://olive.example/?branch=kathmandu-thamel&table=3&qr=v1.abc');
  });

  it('keep the key for this tab only', () => {
    saveDevKey('k1');
    expect(savedDevKey()).toBe('k1');
    expect(window.localStorage.getItem('olive.devSetupKey')).toBeNull();
    saveDevKey(null);
    expect(savedDevKey()).toBeNull();
  });
});
