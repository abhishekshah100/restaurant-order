'use client';

import { useCallback } from 'react';
import { useContent } from '@/api/hooks';
import { useMarkServed, useResolveRequest } from '@/api/mutations';
import { useToast } from '@/context/ToastContext';
import type { QueueItem } from '@/lib/adminService';
import { useAdminWorkspace } from '../shell/AdminWorkspace';

/**
 * The queue's one action per item: Done (a request) or Mark served / Handed over (a ready
 * round). The item leaves the queue at once; if the server refuses, it comes back with a toast.
 */
export function useQueueActions() {
  const t = useContent('common');
  const { showToast } = useToast();
  const { branch } = useAdminWorkspace();
  const resolve = useResolveRequest();
  const serve = useMarkServed();
  const failed = useCallback(
    () => showToast(t('adminHome.queue.failed'), { tone: 'error' }),
    [showToast, t],
  );

  return useCallback(
    (item: QueueItem) => {
      if (item.kind === 'ready') {
        serve.mutate(
          { branchId: branch.id, orderId: item.order.id, round: item.ready.round },
          { onError: failed },
        );
      } else {
        resolve.mutate({ branchId: branch.id, request: item.request }, { onError: failed });
      }
    },
    [branch.id, failed, resolve, serve],
  );
}
