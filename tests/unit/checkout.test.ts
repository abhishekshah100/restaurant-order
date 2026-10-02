import { describe, expect, it } from 'vitest';
import { checkOtp, displayPhone, validateDetails, wrongCodeMessage } from '@/lib/checkout';

describe('validateDetails', () => {
  it('requires a name and a 10-digit Indian mobile', () => {
    expect(validateDetails('', '')).toEqual({
      name: 'Please enter your name',
      phone: 'Enter a 10-digit mobile number',
    });
    expect(validateDetails('Ananya Rao', '98765432')).toEqual({
      phone: 'Enter a 10-digit mobile number',
    });
    expect(validateDetails('Ananya Rao', '1234567890').phone).toMatch(/start with 6, 7, 8 or 9/);
    expect(validateDetails('Ananya Rao', '9876543210')).toEqual({});
  });
});

describe('OTP', () => {
  it('accepts 123456 only', () => {
    expect(checkOtp('123456')).toBe('ok');
    expect(checkOtp('482719')).toBe('wrong');
    expect(checkOtp('123')).toBe('incomplete');
  });
  it('words the attempts left like the design', () => {
    expect(wrongCodeMessage(2)).toBe(
      "That code doesn't match. Check the SMS and try again — 2 attempts left.",
    );
    expect(wrongCodeMessage(1)).toMatch(/1 attempt left/);
    expect(wrongCodeMessage(0)).toMatch(/no attempts left/);
  });
  it('formats the phone', () => expect(displayPhone('9876543210')).toBe('+91 98765 43210'));
});
