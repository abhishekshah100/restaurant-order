'use client';

import { useCallback } from 'react';
import { useContent } from '@/api/hooks';
import { useToast } from '@/context/ToastContext';

/** Tells the guest a request to the server got no answer (an error toast); the screen stays as it was. */
export function useRequestFailed(): () => void {
  const { showToast } = useToast();
  const t = useContent('common');
  return useCallback(() => showToast(t('error.requestFailed'), { tone: 'error' }), [showToast, t]);
}
