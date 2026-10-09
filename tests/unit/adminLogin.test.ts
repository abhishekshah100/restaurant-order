import { describe, expect, it } from 'vitest';
import { adminLoginSchema, DEMO_ADMIN_CREDENTIALS, isDemoAdminLogin } from '@/lib/adminLogin';

describe('admin login demo', () => {
  it('validates an email or Indian mobile number and a required password', () => {
    expect(
      adminLoginSchema.safeParse({ identity: 'abhishek@gmail.com', password: 'secret' }).success,
    ).toBe(true);
    expect(adminLoginSchema.safeParse({ identity: '9876543210', password: 'secret' }).success).toBe(
      true,
    );
    expect(
      adminLoginSchema.safeParse({ identity: 'not-an-email', password: 'secret' }).success,
    ).toBe(false);
    expect(adminLoginSchema.safeParse({ identity: '9876543210', password: '' }).success).toBe(
      false,
    );
  });

  it('accepts the demo email or phone with the static password', () => {
    expect(
      isDemoAdminLogin({
        identity: DEMO_ADMIN_CREDENTIALS.email,
        password: DEMO_ADMIN_CREDENTIALS.password,
      }),
    ).toBe(true);
    expect(
      isDemoAdminLogin({
        identity: DEMO_ADMIN_CREDENTIALS.phone,
        password: DEMO_ADMIN_CREDENTIALS.password,
      }),
    ).toBe(true);
    expect(
      isDemoAdminLogin({ identity: '9876543211', password: DEMO_ADMIN_CREDENTIALS.password }),
    ).toBe(false);
    expect(isDemoAdminLogin({ identity: DEMO_ADMIN_CREDENTIALS.email, password: 'wrong' })).toBe(
      false,
    );
  });
});
