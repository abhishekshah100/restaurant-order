import { describe, expect, it } from 'vitest';
import { isPasswordLongEnough, temporaryPassword } from '@/lib/staffPassword';

/* The temporary passwords admins give staff: easy to read out, never too weak. */

describe('temporaryPassword', () => {
  it('is 10 characters with a capital, a small letter and a digit, none that look alike', () => {
    for (let i = 0; i < 200; i++) {
      const password = temporaryPassword();
      expect(password).toHaveLength(10);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[2-9]/);
      expect(password).not.toMatch(/[01OolI]/);
      expect(isPasswordLongEnough(password)).toBe(true);
    }
  });

  it('comes from the random numbers it is given', () => {
    const fixed = () => new Uint32Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(temporaryPassword(fixed)).toBe('Aa2AAAAAAA');
    expect(isPasswordLongEnough('short')).toBe(false);
  });
});
