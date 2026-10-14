import { beforeEach, describe, expect, it } from 'vitest';
import type { ApiResponse } from '@/api/client';
import type { AdminBranchesResponse, AdminSignInResponse, ApiErrorBody } from '@/api/contracts';
import { MOCK_KEYS } from '@/api/mock/db';
import { DEMO_ADMIN } from '@/api/mock/demoAdmin';
import { ADMIN_SESSION_HOURS, HOUR_MS } from '@/api/mock/rules';
import { createTestServer, testBranches } from '../apiState';

/* GET /admin/branches on the mock server, on a clock the test moves. */
const START = Date.parse('2026-10-14T10:00:00+05:30');
let now = START;
const server = createTestServer(() => now);

const signIn = async () => {
  const res = (await server({
    method: 'POST',
    path: 'admin/sessions',
    body: { identity: DEMO_ADMIN.email, password: DEMO_ADMIN.password },
  })) as ApiResponse;
  return (res.body as AdminSignInResponse).token;
};

const listBranches = (headers?: Record<string, string>) =>
  server({ method: 'GET', path: 'admin/branches', headers }) as Promise<ApiResponse>;
const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
const error = (res: ApiResponse) => (res.body as ApiErrorBody).error;

beforeEach(() => {
  now = START;
  window.localStorage.clear();
});

describe('GET /admin/branches (mock)', () => {
  it('lists the branches the signed-in admin manages, with what the picker shows', async () => {
    const res = await listBranches(bearer(await signIn()));
    expect(res.status).toBe(200);
    const { branches } = res.body as AdminBranchesResponse;
    expect(branches.map((b) => b.id)).toEqual(DEMO_ADMIN.branchIds);

    const source = testBranches().find((b) => b.id === 'ktm-thamel')!;
    expect(branches[1]).toEqual({
      id: 'ktm-thamel',
      name: source.name,
      shortName: 'Thamel',
      city: 'Kathmandu',
      country: 'NP',
      address: source.address,
      status: source.status,
      hoursToday: source.hoursToday,
      timezone: 'Asia/Kathmandu',
      locale: source.locale,
      tables: source.tables,
      modes: ['dineIn', 'takeaway', 'delivery'],
      currencyCode: 'NPR',
      image: source.image,
    });
    // Guest-facing region rules stay on GET /branches.
    expect(branches[1]).not.toHaveProperty('tax');
  });

  it('answers 401 unauthorized without a token or with an unknown one', async () => {
    const cases: (Record<string, string> | undefined)[] = [
      undefined,
      {},
      { authorization: 'Bearer nope' },
      { authorization: 'x' },
    ];
    for (const headers of cases) {
      const res = await listBranches(headers);
      expect(res.status).toBe(401);
      expect(error(res)).toBe('unauthorized');
    }
  });

  it('answers 401 once the session has expired', async () => {
    const token = await signIn();
    now = START + ADMIN_SESSION_HOURS * HOUR_MS - 1;
    expect((await listBranches(bearer(token))).status).toBe(200);
    now = START + ADMIN_SESSION_HOURS * HOUR_MS;
    expect(error(await listBranches(bearer(token)))).toBe('unauthorized');
  });

  it("reports a tester's branch status override (mock only)", async () => {
    window.localStorage.setItem(MOCK_KEYS.branchStatus, JSON.stringify({ 'ktm-thamel': 'closed' }));
    const res = await listBranches(bearer(await signIn()));
    const statuses = (res.body as AdminBranchesResponse).branches.map((b) => [b.id, b.status]);
    expect(statuses).toEqual([
      ['blr-indiranagar', 'open'],
      ['ktm-thamel', 'closed'],
    ]);
  });

  it('lists only the modes a branch takes', async () => {
    const one = createTestServer(
      () => now,
      (branches) =>
        branches.map((b) =>
          b.id === 'blr-indiranagar'
            ? { ...b, modes: { ...b.modes, delivery: { ...b.modes.delivery, enabled: false } } }
            : b,
        ),
    );
    const login = (await one({
      method: 'POST',
      path: 'admin/sessions',
      body: { identity: DEMO_ADMIN.email, password: DEMO_ADMIN.password },
    })) as ApiResponse;
    const res = (await one({
      method: 'GET',
      path: 'admin/branches',
      headers: bearer((login.body as AdminSignInResponse).token),
    })) as ApiResponse;
    expect((res.body as AdminBranchesResponse).branches[0].modes).toEqual(['dineIn', 'takeaway']);
  });
});
