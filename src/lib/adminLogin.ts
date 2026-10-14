import { z } from 'zod';

/** Validation messages for the admin login form (content: `adminLogin.validation`). */
export interface AdminLoginMessages {
  identityRequired: string;
  identityInvalid: string;
  passwordRequired: string;
}

/** A mobile number in international form: an optional "+", then 10–15 digits (spaces, dashes and brackets allowed). */
const isPhone = (value: string) => /^\+?\d{10,15}$/.test(value.replace(/[\s()-]/g, ''));

/**
 * An email address or a mobile number from any region. Only the shape is checked here; the
 * server decides whether it belongs to an account.
 */
export const isAdminIdentity = (value: string) =>
  z.email().safeParse(value).success || isPhone(value);

export const adminLoginSchema = (messages: AdminLoginMessages) =>
  z.object({
    identity: z
      .string()
      .trim()
      .min(1, { message: messages.identityRequired, abort: true })
      .refine(isAdminIdentity, messages.identityInvalid),
    password: z.string().min(1, messages.passwordRequired),
  });

export type AdminLoginValues = z.infer<ReturnType<typeof adminLoginSchema>>;
