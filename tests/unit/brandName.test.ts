import { describe, expect, it } from 'vitest';
import { brandName } from '@/lib/branchParts';

describe('brandName', () => {
  it('is the name before " — ", the short name saying which branch', () => {
    expect(brandName('The Olive Table — Thamel')).toBe('The Olive Table');
  });

  it('is the whole name when it has no branch part', () => {
    expect(brandName("Kin's Cafe")).toBe("Kin's Cafe");
    expect(brandName('Café Lumière - Delhi')).toBe('Café Lumière - Delhi');
  });

  it('keeps a name that starts with the separator', () => {
    expect(brandName(' — Thamel')).toBe(' — Thamel');
  });
});
