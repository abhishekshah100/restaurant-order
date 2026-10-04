import { describe, expect, it } from 'vitest';
import { formatMobile, mobileDigits, mobileError, mobileInputLength } from '@/lib/phone';
import { testBranch } from '../apiState';

const india = testBranch().mobile;
const nepal = testBranch('ktm-thamel').mobile;

describe('India mobile numbers (+91)', () => {
  it('groups 5 + 5, partial input as typed', () => {
    expect(formatMobile('9876543210', india)).toBe('98765 43210');
    expect(formatMobile('98765', india)).toBe('98765');
    expect(formatMobile('987654', india)).toBe('98765 4');
  });
  it('strips non-digits and caps at 10', () => {
    expect(mobileDigits('98765-432101', india)).toBe('9876543210');
    expect(formatMobile('98765-432101', india)).toBe('98765 43210');
    expect(mobileInputLength(india)).toBe(11);
  });
  it('accepts numbers starting 6–9', () => {
    expect(mobileError('9876543210', india)).toBeNull();
    expect(mobileError('6000000000', india)).toBeNull();
    expect(mobileError('5876543210', india)).toBe('phonePrefix');
    expect(mobileError('98765', india)).toBe('phoneLength');
  });
});

describe('Nepal mobile numbers (+977)', () => {
  it('has its dial code', () => expect(nepal.dialCode).toBe('+977'));
  it('groups 3 - 7', () => {
    expect(formatMobile('9841234567', nepal)).toBe('984-1234567');
    expect(formatMobile('9841', nepal)).toBe('984-1');
    expect(mobileInputLength(nepal)).toBe(11);
  });
  it('accepts numbers starting 97 or 98', () => {
    expect(mobileError('9841234567', nepal)).toBeNull();
    expect(mobileError('9741234567', nepal)).toBeNull();
    expect(mobileError('9641234567', nepal)).toBe('phonePrefix');
    expect(mobileError('984123456', nepal)).toBe('phoneLength');
  });
});
