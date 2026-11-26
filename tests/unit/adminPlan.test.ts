import { describe, expect, it } from 'vitest';
import type { BranchPlan } from '@/types/admin';
import { hasFeature, offFeature, planNotice, roomFor, whatsappLink } from '@/lib/adminPlan';
import { navFor, splitTabs } from '@/lib/adminNav';
import { settingsFor } from '@/lib/adminSettings';

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
});

describe('contacting Restova', () => {
  it('opens WhatsApp with Nepal’s code added to a local mobile number', () => {
    expect(whatsappLink('980-123 4567', 'Hi')).toBe('https://wa.me/9779801234567?text=Hi');
    expect(whatsappLink('+91 98765 43210', 'Hi')).toBe('https://wa.me/919876543210?text=Hi');
    expect(whatsappLink('', 'Hi')).toBeUndefined();
  });
});
