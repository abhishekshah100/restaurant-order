import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isBackendRequest } from '@/api/backend';
import { api } from '@/api/endpoints';
import type { ClientDetail, PackagePlan } from '@/api/contracts';
import {
  addDays,
  changesOf,
  dateField,
  downgradeOf,
  draftOf,
  endOfDay,
  listPriceOf,
  matchesFilter,
  nextTermEnd,
  priceOf,
  termEnd,
  withPackage,
} from '@/lib/platform';

/*
 * The platform console: its requests go to the backend with the platform key (never a staff
 * token); Save sends only what changed, and picking a package brings its limits and features;
 * a downgrade lists what the client would go over or lose.
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
});

const basic: PackagePlan = {
  code: 'basic',
  name: 'Basic',
  position: 2,
  prices: { yearly: 9000, halfYearly: 5000, extraBranch: null },
  limits: { staff: 5, branches: 1, floors: 2, tables: 20, dishes: 300, reportDays: 30 },
  features: ['ordering', 'takeaway', 'reports'],
  hidden: false,
};

const platinum: PackagePlan = {
  code: 'platinum',
  name: 'Platinum',
  position: 4,
  prices: { yearly: 36000, halfYearly: 20000, extraBranch: 15000 },
  limits: {
    staff: null,
    branches: null,
    floors: null,
    tables: null,
    dishes: null,
    reportDays: null,
  },
  features: ['ordering', 'takeaway', 'reports', 'inventory', 'reservations'],
  hidden: false,
};

const client: ClientDetail = {
  id: 'r1',
  name: 'Thamel Café',
  createdAt: '2026-11-01T00:00:00.000Z',
  branches: [{ id: 'ktm-thamel', name: 'Thamel' }],
  plan: { code: 'platinum', name: 'Platinum' },
  billingCycle: 'yearly',
  status: 'active',
  endsAt: null,
  lockAt: null,
  daysLeft: null,
  limits: { ...platinum.limits },
  usage: { staff: 12, branches: 1, floors: 2, tables: 18, dishes: 240 },
  features: [...platinum.features],
  price: 36000,
  listPrice: 36000,
  remindedAt: null,
  contactName: '',
  contactPhone: '',
  demo: false,
  trialEndsAt: null,
  startsAt: null,
  paidUntil: null,
  graceDays: 7,
  suspendedAt: null,
  suspendReason: null,
  customPrice: null,
  priceNote: '',
  contact: { name: '', phone: '', email: '', taxNumber: '' },
  notes: '',
  history: [],
  payments: [],
  addons: [],
};

describe('platform requests', () => {
  it('go to the backend with the platform owner’s one key, never a staff token', async () => {
    expect(isBackendRequest({ method: 'GET', path: 'platform/clients' })).toBe(true);
    expect(isBackendRequest({ method: 'PATCH', path: 'platform/clients/r1' })).toBe(true);
    expect(isBackendRequest({ method: 'POST', path: 'platform/clients/r1/suspend' })).toBe(true);
    expect(isBackendRequest({ method: 'PATCH', path: 'platform/plans/basic' })).toBe(true);
    expect(isBackendRequest({ method: 'PATCH', path: 'platform/settings' })).toBe(true);
    await api.platformClients('the-key');
    await api.updatePlatformClient('the-key', 'r1', { by: 'Abhishek', limits: { staff: 8 } });
    const [list, update] = fetchMock.mock.calls;
    expect(list?.[0]).toBe(`${BACKEND}/platform/clients`);
    expect(new Headers(list?.[1]?.headers).get('X-Dev-Key')).toBe('the-key');
    expect(new Headers(update?.[1]?.headers).get('Authorization')).toBeNull();
    expect(JSON.parse(String(update?.[1]?.body))).toEqual({
      by: 'Abhishek',
      limits: { staff: 8 },
    });
  });
});

describe("a client's changes", () => {
  it('send nothing when nothing changed', () => {
    expect(changesOf(client, draftOf(client), 'A')).toBeNull();
  });

  it('send only what changed, with who made it', () => {
    const draft = draftOf(client);
    draft.limits.staff = 15;
    draft.price = '30,000';
    draft.contact.phone = ' 9801234567 ';
    expect(changesOf(client, draft, 'Abhishek')).toEqual({
      by: 'Abhishek',
      limits: { staff: 15 },
      price: 30000,
      contact: { phone: '9801234567' },
    });
  });

  it('bring a picked package with all its limits and features', () => {
    const draft = withPackage(draftOf(client), basic);
    expect(draft.limits).toEqual(basic.limits);
    const body = changesOf(client, draft, 'A');
    expect(body?.plan).toBe('basic');
    expect(body?.limits).toEqual(basic.limits);
    expect(body?.features).toEqual(['ordering', 'takeaway', 'reports']);
  });

  it('list what a downgrade goes over and switches off', () => {
    expect(downgradeOf(client, draftOf(client))).toBeNull();
    expect(downgradeOf(client, withPackage(draftOf(client), basic))).toEqual({
      over: [{ limit: 'staff', used: 12, max: 5 }],
      featuresOff: ['inventory', 'reservations'],
    });
  });
});

describe('prices and dates', () => {
  it('read typed rupees', () => {
    expect(priceOf('')).toBeNull();
    expect(priceOf('9,000')).toBe(9000);
    expect(priceOf('9.5')).toBeNaN();
  });

  it('price extra branches as the server does', () => {
    expect(listPriceOf(platinum, 'yearly', 3)).toBe(36000 + 2 * 15000);
    expect(listPriceOf(platinum, 'halfYearly', 2)).toBe(20000 + 8300);
    expect(listPriceOf(basic, 'yearly', 3)).toBe(9000);
  });

  it('run a date to the end of that day, and back', () => {
    const iso = endOfDay('2026-12-31');
    expect(iso).not.toBeNull();
    expect(dateField(iso)).toBe('2026-12-31');
    expect(endOfDay('')).toBeNull();
  });

  it('add days from the date, or from today once it has passed', () => {
    const today = new Date(2026, 10, 26, 10);
    expect(addDays('2026-12-01', 15, today)).toBe('2026-12-16');
    expect(addDays('2026-11-01', 7, today)).toBe('2026-12-03');
    expect(addDays('', 30, today)).toBe('2026-12-26');
  });

  it('end a term the day before a year or six months on', () => {
    expect(termEnd('2026-11-26', 'yearly')).toBe('2027-11-25');
    expect(termEnd('2026-11-26', 'halfYearly')).toBe('2027-05-25');
  });
});

describe('recording a payment', () => {
  it('extends one cycle from the end while it runs, else from the day paid', () => {
    const running = new Date(2027, 0, 31, 23, 59).toISOString();
    expect(new Date(nextTermEnd(running, '2026-12-20', 'yearly'))).toEqual(
      new Date(2028, 0, 31, 23, 59),
    );
    // Six months from 31 January: the end of July.
    expect(new Date(nextTermEnd(running, '2026-12-20', 'halfYearly'))).toEqual(
      new Date(2027, 6, 31, 23, 59),
    );
    const ended = new Date(2026, 9, 1).toISOString();
    expect(new Date(nextTermEnd(ended, '2026-11-26', 'yearly'))).toEqual(
      new Date(2027, 10, 26, 12),
    );
    expect(new Date(nextTermEnd(null, '2026-11-26', 'halfYearly'))).toEqual(
      new Date(2027, 4, 26, 12),
    );
  });
});

describe('the list', () => {
  it('counts trials and terms ending within 15 days as ending soon', () => {
    expect(matchesFilter({ ...client, status: 'trial', daysLeft: 12 }, 'endingSoon')).toBe(true);
    expect(matchesFilter({ ...client, status: 'active', daysLeft: 40 }, 'endingSoon')).toBe(false);
    expect(matchesFilter({ ...client, status: 'grace', daysLeft: -2 }, 'endingSoon')).toBe(false);
    expect(matchesFilter(client, 'all')).toBe(true);
  });
});
