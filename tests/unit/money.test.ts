import { describe, expect, it } from 'vitest';
import { createMoney, numberLocale } from '@/lib/money';
import { testBranch } from '../apiState';

const inr = createMoney(testBranch());
const npr = createMoney(testBranch('ktm-thamel'));

describe('money: India (INR, en-IN)', () => {
  it('uses Indian digit grouping and the rupee sign', () => {
    expect(inr.format(1424)).toBe('₹1,424');
    expect(inr.format(369)).toBe('₹369');
    expect(inr.format(123456)).toBe('₹1,23,456');
  });
  it('formats negatives with a minus sign', () => {
    expect(inr.format(-1424)).toBe('−₹1,424');
  });
  it('shows two decimals from paise', () => {
    expect(inr.formatMinor(135600)).toBe('₹1,356.00');
    expect(inr.formatMinor(3390)).toBe('₹33.90');
  });
  it('signs the round-off line', () => {
    expect(inr.formatSignedMinor(20)).toBe('+₹0.20');
    expect(inr.formatSignedMinor(-45)).toBe('−₹0.45');
  });
  it('labels free add-ons', () => {
    expect(inr.addOnPrice(0, 'Free')).toBe('Free');
    expect(inr.addOnPrice(40, 'Free')).toBe('+₹40');
  });
  it('converts to paise', () => expect(inr.toMinor(549)).toBe(54900));
});

describe('money: Nepal (NPR, en-NP)', () => {
  it('falls back to en-IN grouping when the runtime has no en-NP number data', () => {
    const locale = numberLocale(testBranch('ktm-thamel'));
    expect(['en-NP', 'en-IN']).toContain(locale);
    expect(npr.format(123456)).toMatch(/1,23,456$/);
  });
  it('shows the configured symbol, never "NPR" (Intl spaces it with a no-break space)', () => {
    expect(npr.format(2280)).toBe('रू\u00a02,280');
    expect(npr.formatMinor(13156)).toBe('रू\u00a0131.56');
    expect(npr.formatSignedMinor(-56)).toBe('−रू\u00a00.56');
    expect(npr.addOnPrice(65, 'Free')).toBe('+रू\u00a065');
  });
});
