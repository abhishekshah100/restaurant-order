import { isApiError } from '@/api/client';

/** The catalog already has one of that name (409 conflict `nameTaken`). */
export const nameTaken = (error: unknown): boolean =>
  isApiError(error, 'conflict') && error.body?.reason === 'nameTaken';
