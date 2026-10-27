import { describe, expect, it } from 'vitest';
import { prepMinutes, tidyPrepTime } from '@/lib/prepTime';

/* A dish's prep time as staff write it, guests read it and the kitchen plans by it. */

describe('prep time', () => {
  it('reads the minutes a dish takes: a range by its longest', () => {
    expect(prepMinutes('15 min')).toBe(15);
    expect(prepMinutes('12–15 min')).toBe(15);
    expect(prepMinutes('12-15 mins')).toBe(15);
    expect(prepMinutes('20')).toBe(20);
    expect(prepMinutes('quick')).toBeNull();
    expect(prepMinutes('300 min')).toBeNull();
    expect(prepMinutes(undefined)).toBeNull();
  });

  it('writes it the menu’s way, or refuses it', () => {
    expect(tidyPrepTime('15')).toBe('15 min');
    expect(tidyPrepTime(' 12 - 15 minutes ')).toBe('12–15 min');
    expect(tidyPrepTime('soon')).toBeNull();
  });
});
