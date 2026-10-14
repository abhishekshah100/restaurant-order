import type { AdminProfile } from '@/types/admin';

/*
 * MOCK ONLY: the staff account the mock server signs in, so testers can reach the admin pages
 * without a backend. A real backend owns its accounts; with NEXT_PUBLIC_API_MOCK=false this
 * module is never loaded. Kept free of other imports so the login page's "Use demo account"
 * hint can load it on its own.
 */
export const DEMO_ADMIN: AdminProfile & { password: string; branchIds: string[] } = {
  name: 'Abhishek Saha',
  email: 'abhishek@gmail.com',
  phone: '+919876543210',
  password: 'Restaurant@#123',
  /** The branches this account manages (GET /admin/branches), in the order it lists them. */
  branchIds: ['blr-indiranagar', 'ktm-thamel'],
};
