import { describe, expect, it } from 'vitest';
import type { BranchPlan } from '@/types/admin';
import { hasFeature, offFeature, planNotice, roomFor, whatsappLink } from '@/lib/adminPlan';
import { navFor, splitTabs } from '@/lib/adminNav';
import { settingsFor } from '@/lib/adminSettings';
import { firstDay, withPlanHistory } from '@/lib/dayRange';
import { kitchenNavFor } from '@/lib/kitchenNav';
import { forGuests } from '@/lib/menu';
import type { MenuData } from '@/types/menu';

/*
 * The package on the restaurant's own screens: pages and settings of features it lacks are
 * hidden (from everyone), limits say what's left, and the banner speaks as the end nears.
 */

const plan = (over: Partial<BranchPlan> = {}): BranchPlan => ({
  code: 'basic',
  name: 'Basic',
  status: 'active',
  endsAt: '2027-01-01T00:00:00.000Z',
  lockAt: '2027-01-08T00:00:00.000Z',
  daysLeft: 40,
  limits: { staff: 5, branches: 1, floors: 2, tables: 20, dishes: 300, reportDays: 30 },
  usage: { staff: 5, branches: 1, floors: 1, tables: 12, dishes: 80 },
  support: { phone: '9801234567', whatsapp: '', email: '' },
  ...over,
});
const basic = { features: ['ordering', 'takeaway', 'reports'], plan: plan() };
/** An owner whose role holds everything. */
const owner = () => true;

describe('features by package', () => {
  it('has everything without a list (the mock)', () => {
    expect(hasFeature({ features: undefined }, 'inventory')).toBe(true);
    expect(hasFeature(basic, 'inventory')).toBe(false);
  });

  it('names the feature a page needs that the package leaves out', () => {
    expect(offFeature(basic, 'inventory')).toBe('inventory');
    expect(offFeature(basic, 'purchasing')).toBe('inventory');
    expect(offFeature(basic, 'sales')).toBeUndefined();
    expect(offFeature(basic, 'menu')).toBeUndefined();
    expect(offFeature({ features: undefined }, 'inventory')).toBeUndefined();
  });

  it('hides Requests without waiter requests and Refunds without refunds', () => {
    expect(offFeature(basic, 'requests')).toBe('waiterRequests');
    expect(offFeature(basic, 'refunds')).toBe('refunds');
    const essentials = { features: ['ordering', 'waiterRequests', 'refunds'] };
    expect(offFeature(essentials, 'requests')).toBeUndefined();
    expect(offFeature(essentials, 'refunds')).toBeUndefined();
  });

  it("hides the kitchen's Stock and Activity tabs the package leaves out", () => {
    const tabs = (features: string[]) =>
      kitchenNavFor(owner, (f) => hasFeature({ features }, f)).map((i) => i.id);
    expect(tabs(['ordering'])).toEqual(['board']);
    expect(tabs(['ordering', 'kitchenStock', 'kitchenActivity'])).toEqual([
      'board',
      'stock',
      'activity',
    ]);
    expect(kitchenNavFor(owner).map((i) => i.id)).toEqual(['board', 'stock', 'activity']);
  });
});

describe('History days on the date pickers', () => {
  it("reach as far back as the package's days, today counted, never past the page's own", () => {
    const today = '2026-11-28';
    expect(firstDay(today, withPlanHistory(undefined, 7))).toBe('2026-11-22');
    expect(firstDay(today, withPlanHistory({ historyDays: 30, rangeDays: 31 }, 365))).toBe(
      '2026-10-29',
    );
    expect(withPlanHistory({ historyDays: 30, rangeDays: 31 }, null)).toEqual({
      historyDays: 30,
      rangeDays: 31,
    });
  });

  it('hides those pages from the nav and the phone bar, even where the role opens them', () => {
    const isOff = (id: Parameters<typeof offFeature>[1]) => offFeature(basic, id) !== undefined;
    const ids = navFor(owner, isOff).map((i) => i.id);
    for (const hidden of ['inventory', 'purchasing', 'reservations', 'team', 'audit'] as const) {
      expect(ids).not.toContain(hidden);
    }
    expect(ids).toEqual(expect.arrayContaining(['home', 'orders', 'sales', 'menu']));
    const { tabs, more } = splitTabs(navFor(owner, isOff));
    expect([...tabs, ...more].some((i) => i.id === 'inventory')).toBe(false);
    // Everything there without a package list (the mock).
    expect(navFor(owner).some((i) => i.id === 'inventory')).toBe(true);
  });

  it('hides the settings of features the package leaves out', () => {
    const pages = (has?: (f: string) => boolean) =>
      settingsFor(owner, false, has).flatMap((g) =>
        g.topics.flatMap((tp) => tp.pages.map((p) => p.id)),
      );
    const withBasic = pages((f) => basic.features.includes(f));
    expect(withBasic).toContain('pickup');
    expect(withBasic).not.toContain('delivery');
    expect(withBasic).not.toContain('offers');
    expect(pages()).toEqual(expect.arrayContaining(['pickup', 'delivery', 'offers']));
  });
});

describe('limits', () => {
  it('say what is used and whether one more fits', () => {
    expect(roomFor(plan(), 'staff')).toEqual({ used: 5, max: 5, full: true });
    expect(roomFor(plan(), 'tables')).toEqual({ used: 12, max: 20, full: false });
    expect(roomFor(null, 'staff').full).toBe(false);
    expect(roomFor(plan({ limits: { ...plan().limits, staff: null } }), 'staff').full).toBe(false);
  });
});

describe('the banner', () => {
  it('speaks within 15 days of the end, in grace, ended and suspended', () => {
    expect(planNotice(plan())).toBeNull();
    expect(planNotice(plan({ daysLeft: 12, status: 'trial' }))).toEqual({
      kind: 'ending',
      days: 12,
      trial: true,
    });
    expect(planNotice(plan({ status: 'grace' }))).toEqual({
      kind: 'grace',
      lockAt: '2027-01-08T00:00:00.000Z',
    });
    expect(planNotice(plan({ status: 'expired' }))?.kind).toBe('expired');
    expect(planNotice(plan({ status: 'suspended' }))?.kind).toBe('suspended');
    expect(planNotice(null)).toBeNull();
  });

  it('warns of a suspension 3 days before, then finishing up, then suspended, by the clock', () => {
    const NOW = Date.parse('2026-12-01T12:00:00Z');
    const at = (hours: number) => new Date(NOW + hours * 3_600_000);
    const suspension = {
      startsAt: at(0).toISOString(),
      planned: true,
      finishing: false,
      finishUntil: at(3).toISOString(),
      notice: 'paymentOverdue' as const,
      message: '',
    };
    const planned = plan({ suspension });
    // Further off than 3 days: as usual.
    expect(planNotice(planned, at(-24 * 4))).toBeNull();
    expect(planNotice(planned, at(-24 * 2))).toEqual({
      kind: 'suspending',
      startsAt: suspension.startsAt,
      notice: 'paymentOverdue',
      message: '',
    });
    expect(planNotice(planned, at(1))).toMatchObject({
      kind: 'finishing',
      until: suspension.finishUntil,
    });
    expect(planNotice(planned, at(4))).toMatchObject({
      kind: 'suspended',
      notice: 'paymentOverdue',
    });
    // Locked at once: no finishing up.
    expect(
      planNotice(plan({ suspension: { ...suspension, finishUntil: null } }), at(1))?.kind,
    ).toBe('suspended');
  });
});

describe('contacting Restova', () => {
  it('opens WhatsApp with Nepal’s code added to a local mobile number', () => {
    expect(whatsappLink('980-123 4567', 'Hi')).toBe('https://wa.me/9779801234567?text=Hi');
    expect(whatsappLink('+91 98765 43210', 'Hi')).toBe('https://wa.me/919876543210?text=Hi');
    expect(whatsappLink('', 'Hi')).toBeUndefined();
  });
});

describe('a smaller plan (downgrades)', () => {
  const NOW = new Date('2026-12-01T12:00:00Z');
  const basicLimits = { staff: 5, branches: 1, floors: 2, tables: 20, dishes: 300, reportDays: 30 };

  it('says a locked branch is locked, before anything else', () => {
    expect(planNotice(plan({ branchLocked: true }), NOW)).toEqual({
      kind: 'branchLocked',
      branches: 1,
    });
  });

  it('warns of a planned change from 15 days before, saying when it goes over', () => {
    const at = (days: number) => new Date(NOW.getTime() + days * 86_400_000).toISOString();
    const far = plan({ change: { code: 'free', name: 'Free', at: at(30), limits: basicLimits } });
    expect(planNotice(far, NOW)).toBeNull();
    const soon = plan({
      change: { code: 'free', name: 'Free', at: at(10), limits: { ...basicLimits, staff: 1 } },
    });
    expect(planNotice(soon, NOW)).toMatchObject({ kind: 'changing', name: 'Free', over: true });
    const fits = plan({
      change: { code: 'basic', name: 'Basic', at: at(10), limits: basicLimits },
    });
    expect(planNotice(fits, NOW)).toMatchObject({ kind: 'changing', over: false });
  });

  it('says what is locked now', () => {
    const locked = plan({ locked: { branches: 1, staff: 0, tables: 2, dishes: 0 } });
    expect(planNotice(locked, NOW)).toMatchObject({ kind: 'locked' });
  });

  it("leaves dishes over the plan off the guests' menu (staff still have them)", () => {
    const dish = (slug: string, planLocked = false) =>
      ({
        slug,
        ...(planLocked ? { planLocked: true } : {}),
      }) as unknown as MenuData['dishes'][number];
    const menu = {
      dishes: [dish('a'), dish('b', true)],
      chefsPicks: ['a', 'b'],
      categories: [],
    } as unknown as MenuData;
    expect(forGuests(menu).dishes.map((d) => d.slug)).toEqual(['a']);
    expect(forGuests(menu).chefsPicks).toEqual(['a']);
    // A category left with nothing for guests isn't shown.
    const byCategory = {
      dishes: [
        { ...dish('a'), categoryId: 'mains' },
        { ...dish('b', true), categoryId: 'drinks' },
      ],
      chefsPicks: [],
      categories: [{ id: 'mains' }, { id: 'drinks' }, { id: 'new' }],
    } as unknown as MenuData;
    expect(forGuests(byCategory).categories.map((c) => c.id)).toEqual(['mains', 'new']);
    const plain = { ...menu, dishes: [dish('a')] } as MenuData;
    expect(forGuests(plain)).toBe(plain);
  });
});
