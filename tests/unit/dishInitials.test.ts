import { describe, expect, it } from 'vitest';
import { dishInitials } from '@/lib/menu';

describe('dishInitials', () => {
  it('takes the first letters of the first two words, skipping symbols', () => {
    expect(dishInitials('Garlic Naan')).toBe('GN');
    expect(dishInitials('Tiramisu')).toBe('T');
    expect(dishInitials('Iced Hazelnut Latte')).toBe('IH');
    expect(dishInitials('  paneer   (half) tikka ')).toBe('PH');
    expect(dishInitials('& Co')).toBe('C');
  });
});
