import { describe, expect, it } from 'vitest';
import { isCompleteOtp, validateDetails, wrongCodeError } from '@/lib/checkout';
import { testBranch } from '../apiState';

const india = testBranch().mobile;
const nepal = testBranch('ktm-thamel').mobile;

describe('validateDetails', () => {
  it('requires a name and a 10-digit Indian mobile', () => {
    expect(validateDetails('', '', india)).toEqual({
      name: 'nameRequired',
      phone: 'phoneLength',
    });
    expect(validateDetails('A', '98765432', india)).toEqual({
      name: 'nameTooShort',
      phone: 'phoneLength',
    });
    expect(validateDetails('Ananya Rao', '1234567890', india).phone).toBe('phonePrefix');
    expect(validateDetails('Ananya Rao', '9876543210', india)).toEqual({});
  });

  it("checks the number against the branch's rules (Nepal: 97 or 98)", () => {
    expect(validateDetails('Ananya Rao', '9841234567', nepal)).toEqual({});
    expect(validateDetails('Ananya Rao', '9712345678', nepal)).toEqual({});
    expect(validateDetails('Ananya Rao', '9612345678', nepal).phone).toBe('phonePrefix');
    expect(validateDetails('Ananya Rao', '984123456', nepal).phone).toBe('phoneLength');
    // A valid Indian number isn't a Nepali one.
    expect(validateDetails('Ananya Rao', '8765432109', nepal).phone).toBe('phonePrefix');
  });
});

describe('OTP', () => {
  it('sends only a complete code (the server checks it)', () => {
    expect(isCompleteOtp('123456')).toBe(true);
    expect(isCompleteOtp('123')).toBe(false);
  });
  it('locks once no attempts are left', () => {
    expect(wrongCodeError(2)).toBe('wrong');
    expect(wrongCodeError(1)).toBe('wrong');
    expect(wrongCodeError(0)).toBe('locked');
  });
});
