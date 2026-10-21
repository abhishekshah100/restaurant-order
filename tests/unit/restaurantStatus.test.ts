import { describe, expect, it } from 'vitest';
import {
  applyPreview,
  compactTimeRange,
  parseStatusPreview,
  pausedMinutes,
  withLiveStatus,
  resolveOrdering,
  statusTone,
} from '@/lib/restaurantStatus';
import { createTranslator } from '@/api/translator';
import type { ContentMap } from '@/api/queries';
import { readApiJson, testBranch } from '../apiState';
import type { Branch } from '@/types/branch';

const { closesAt } = testBranch();
const t = createTranslator(readApiJson<ContentMap['status']>('content/status'));

describe('status line / statusTone', () => {
  it('describes each restaurant status', () => {
    expect(t('line.open', { time: closesAt })).toBe(`Open · until ${closesAt}`);
    expect(t('line.closed')).toBe('Closed now');
    expect(t('line.paused')).toBe('Ordering paused');
  });

  it('colours closed as an error and paused as a warning', () => {
    expect(statusTone('open')).toBeNull();
    expect(statusTone('closed')).toBe('error');
    expect(statusTone('paused')).toBe('warn');
  });
});

describe('parseStatusPreview', () => {
  it('accepts the four preview values only', () => {
    expect(parseStatusPreview('closed')).toBe('closed');
    expect(parseStatusPreview('paused')).toBe('paused');
    expect(parseStatusPreview('offline')).toBe('offline');
    expect(parseStatusPreview('open')).toBe('open');
    expect(parseStatusPreview('CLOSED')).toBeNull();
    expect(parseStatusPreview('')).toBeNull();
    expect(parseStatusPreview(null)).toBeNull();
  });
});

describe('resolveOrdering', () => {
  it('allows adding and checkout only while open and online', () => {
    expect(resolveOrdering('open', true)).toEqual({
      state: 'open',
      status: 'open',
      canAdd: true,
      canCheckout: true,
    });
  });

  it('keeps the menu browsable but read-only while closed', () => {
    expect(resolveOrdering('closed', true)).toMatchObject({ canAdd: false, canCheckout: false });
  });

  it('lets guests keep building the cart while paused', () => {
    expect(resolveOrdering('paused', true)).toMatchObject({
      state: 'paused',
      canAdd: true,
      canCheckout: false,
    });
  });

  it('reports offline over any status, but keeps the status for the header', () => {
    expect(resolveOrdering('open', false)).toMatchObject({
      state: 'offline',
      status: 'open',
      canAdd: true,
      canCheckout: false,
    });
    expect(resolveOrdering('closed', false)).toMatchObject({ state: 'offline', canAdd: false });
  });
});

describe('applyPreview', () => {
  const live = { status: 'open', online: true } as const;

  it('uses the live values without a preview', () => {
    expect(applyPreview(null, live).state).toBe('open');
    expect(applyPreview(null, { status: 'open', online: false }).state).toBe('offline');
  });

  it('replaces the status, or forces offline', () => {
    expect(applyPreview('closed', live)).toMatchObject({ state: 'closed', status: 'closed' });
    expect(applyPreview('paused', live)).toMatchObject({ state: 'paused', status: 'paused' });
    expect(applyPreview('offline', live)).toMatchObject({ state: 'offline', status: 'open' });
    expect(applyPreview('open', { status: 'closed', online: true }).state).toBe('open');
  });

  it('still reports a real loss of connection under a status preview', () => {
    expect(applyPreview('paused', { status: 'open', online: false }).state).toBe('offline');
  });
});

describe('withLiveStatus', () => {
  const branch = { ...testBranch(), reopensTomorrow: true } as Branch;
  const paused = {
    id: branch.id,
    status: 'paused',
    opensAt: branch.opensAt,
    opensIn: branch.opensIn,
    pausedForMinutes: 12,
  } as const;

  it("takes the polled status when it's newer than the branch list, and only its own", () => {
    expect(withLiveStatus(branch, 1000, paused, 2000)).toMatchObject({
      name: branch.name,
      status: 'paused',
      pausedForMinutes: 12,
    });
    // reopensTomorrow is part of the status: gone when the newer status doesn't have it.
    expect(withLiveStatus(branch, 1000, paused, 2000)).not.toHaveProperty('reopensTomorrow');
    expect(withLiveStatus(branch, 3000, paused, 2000)).toBe(branch);
    expect(withLiveStatus(branch, 1000, { ...paused, id: 'ktm-thamel' }, 2000)).toBe(branch);
    expect(withLiveStatus(branch, 1000, undefined, 0)).toBe(branch);
  });
});

describe('pausedMinutes', () => {
  it("is a paused branch's minutes left, or the shortest pause for a preview", () => {
    expect(pausedMinutes({ pausedForMinutes: 42 })).toBe(42);
    expect(pausedMinutes({ pausedForMinutes: 0 })).toBe(15);
  });
});

describe('compactTimeRange', () => {
  it('drops the first AM / PM when both ends share it', () => {
    expect(compactTimeRange('12:00 PM – 3:30 PM')).toBe('12:00 – 3:30 PM');
    expect(compactTimeRange('7:00 PM – 11:00 PM')).toBe('7:00 – 11:00 PM');
  });

  it('keeps ranges that cross noon or midnight, and anything unexpected', () => {
    expect(compactTimeRange('11:00 AM – 3:30 PM')).toBe('11:00 AM – 3:30 PM');
    expect(compactTimeRange('Noon to late')).toBe('Noon to late');
  });
});
