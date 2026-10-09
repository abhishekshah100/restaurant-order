import { z } from 'zod';

/** Temporary demo values; replace this module with the admin auth API when it is ready. */
export const DEMO_ADMIN_CREDENTIALS = {
  email: 'abhishek@gmail.com',
  phone: '9876543210',
  password: 'Restaurant@#123',
} as const;

const isEmailOrIndianMobile = (value: string) =>
  z.string().email().safeParse(value).success || /^(?:\+91[\s-]?)?[6-9]\d{9}$/.test(value);

export const adminLoginSchema = z.object({
  identity: z
    .string()
    .trim()
    .min(1, 'Enter your email or mobile number.')
    .refine(isEmailOrIndianMobile, 'Enter a valid email or 10-digit mobile number.'),
  password: z.string().min(1, 'Enter your password.'),
});

export type AdminLoginValues = z.infer<typeof adminLoginSchema>;

/** Static demo check, kept separate so it can be replaced by the backend login call. */
export function isDemoAdminLogin({ identity, password }: AdminLoginValues): boolean {
  const trimmed = identity.trim();
  const emailMatches = trimmed.toLowerCase() === DEMO_ADMIN_CREDENTIALS.email;
  const phoneMatches = trimmed.replace(/\D/g, '').slice(-10) === DEMO_ADMIN_CREDENTIALS.phone;
  return password === DEMO_ADMIN_CREDENTIALS.password && (emailMatches || phoneMatches);
}
