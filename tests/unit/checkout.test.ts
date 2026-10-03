import { describe, expect, it } from 'vitest';
import { checkOtp, displayPhone, validateDetails, wrongCodeError } from '@/lib/checkout';

describe('validateDetails', () => {
  it('requires a name and a 10-digit Indian mobile', () => {
    expect(validateDetails('', '')).toEqual({
      name: 'nameRequired',
      phone: 'phoneLength',
    });
    expect(validateDetails('A', '98765432')).toEqual({
      name: 'nameTooShort',
      phone: 'phoneLength',
    });
    expect(validateDetails('Ananya Rao', '1234567890').phone).toBe('phonePrefix');
    expect(validateDetails('Ananya Rao', '9876543210')).toEqual({});
  });
});

describe('OTP', () => {
  it('accepts 123456 only', () => {
    expect(checkOtp('123456')).toBe('ok');
    expect(checkOtp('482719')).toBe('wrong');
    expect(checkOtp('123')).toBe('incomplete');
  });
  it('locks once no attempts are left', () => {
    expect(wrongCodeError(2)).toBe('wrong');
    expect(wrongCodeError(1)).toBe('wrong');
    expect(wrongCodeError(0)).toBe('locked');
  });
  it('formats the phone', () => expect(displayPhone('9876543210')).toBe('98765 43210'));
});
