import { describe, expect, it } from 'vitest';
import {
  formatAddOnPrice,
  formatINR,
  formatMobile,
  formatPaise,
  formatSignedPaise,
  pluralize,
} from '@/lib/format';

describe('formatINR', () => {
  it('uses Indian digit grouping', () => {
    expect(formatINR(1424)).toBe('₹1,424');
    expect(formatINR(369)).toBe('₹369');
    expect(formatINR(123456)).toBe('₹1,23,456');
  });
  it('formats negatives with a minus sign', () => {
    expect(formatINR(-1424)).toBe('−₹1,424');
  });
});

describe('formatPaise', () => {
  it('shows two decimals', () => {
    expect(formatPaise(135600)).toBe('₹1,356.00');
    expect(formatPaise(3390)).toBe('₹33.90');
  });
  it('signs the round-off line', () => {
    expect(formatSignedPaise(20)).toBe('+₹0.20');
    expect(formatSignedPaise(-45)).toBe('−₹0.45');
  });
});

describe('formatAddOnPrice', () => {
  it('labels free add-ons', () => {
    expect(formatAddOnPrice(0)).toBe('Free');
    expect(formatAddOnPrice(40)).toBe('+₹40');
  });
});

describe('formatMobile', () => {
  it('groups 5 + 5', () => {
    expect(formatMobile('9876543210')).toBe('98765 43210');
    expect(formatMobile('98765')).toBe('98765');
    expect(formatMobile('987654')).toBe('98765 4');
  });
  it('strips non-digits and caps at 10', () => {
    expect(formatMobile('98765-432101')).toBe('98765 43210');
  });
});

describe('pluralize', () => {
  it('handles one and many', () => {
    expect(pluralize(1, 'item')).toBe('1 item');
    expect(pluralize(3, 'item')).toBe('3 items');
  });
});
