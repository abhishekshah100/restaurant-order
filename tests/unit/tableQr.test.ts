import { beforeEach, describe, expect, it } from 'vitest';
import type { ApiResponse } from '@/api/client';
import type { AdminSignInResponse, TableQrCodesResponse } from '@/api/contracts';
import { DEMO_ADMIN } from '@/api/mock/demoAdmin';
import { parseScan } from '@/lib/scan';
import { qrPath, tableLink } from '@/lib/tableQr';
import type { GuestSession } from '@/types/session';
import { createTestServer, testBranches } from '../apiState';

/* Table QR codes: the links the server issues, what a scan of one opens, and the drawing. */

const server = createTestServer();
const call = (
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
) => server({ method, path, body, headers }) as Promise<ApiResponse>;

let admin: Record<string, string>;

beforeEach(async () => {
  window.localStorage.clear();
  const res = await call('POST', 'admin/sessions', {
    identity: DEMO_ADMIN.email,
    password: DEMO_ADMIN.password,
  });
  admin = { authorization: `Bearer ${(res.body as AdminSignInResponse).token}` };
});

const codes = async (branchId = 'blr-indiranagar') => {
  const res = await call('GET', `admin/branches/${branchId}/tables/qr-codes`, undefined, admin);
  expect(res.status).toBe(200);
  return (res.body as TableQrCodesResponse).codes;
};

describe('GET /admin/branches/:branchId/tables/qr-codes (mock)', () => {
  it('has a link for every table on the floor plan, by area, the same each time', async () => {
    const all = await codes();
    expect(all.map((c) => c.table)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    expect(all[4]).toMatchObject({
      table: 5,
      seats: 6,
      floor: { id: 'ground', name: 'Ground floor' },
    });
    expect(all[4].path).toMatch(/^\/\?branch=blr-indiranagar&table=5&qr=[\w.~-]+$/);
    expect((await codes())[4].path).toBe(all[4].path);
    // Another branch's table 5 has its own code.
    expect((await codes('ktm-thamel'))[4].path).not.toBe(all[4].path);
    expect((await call('GET', 'admin/branches/blr-indiranagar/tables/qr-codes')).status).toBe(401);
  });

  it('opens a dine-in session at that table when scanned', async () => {
    const link = tableLink('https://olive.example', (await codes())[4].path);
    const request = parseScan(new URL(link).search, testBranches(), 'blr-indiranagar');
    expect(request).toMatchObject({ branchId: 'blr-indiranagar', table: 5 });
    expect(request?.qrToken).toBeTruthy();
    const res = await call('POST', 'sessions', {
      branchId: request?.branchId,
      mode: 'dineIn',
      table: request?.table,
      qrToken: request?.qrToken,
    });
    expect(res.status).toBe(201);
    expect(res.body as GuestSession).toMatchObject({ table: 5, qrToken: request?.qrToken });
  });
});

describe('drawing a QR code', () => {
  it('puts the app address in front of the path, and draws the modules as one path', () => {
    const link = tableLink('https://olive.example', '/?branch=blr-indiranagar&table=5&qr=abc');
    expect(link).toBe('https://olive.example/?branch=blr-indiranagar&table=5&qr=abc');
    const { size, d } = qrPath(link);
    expect(size).toBeGreaterThanOrEqual(21);
    expect((size - 17) % 4).toBe(0); // a valid QR version
    expect(d.startsWith('M')).toBe(true);
    expect(qrPath(link)).toEqual({ size, d });
  });
});
