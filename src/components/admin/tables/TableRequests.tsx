'use client';

import { useContent } from '@/api/hooks';
import { useResolveRequest } from '@/api/mutations';
import { Icon } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { minutesSince } from '@/lib/adminService';
import { cx } from '@/lib/cx';
import type { AdminServiceRequest } from '@/types/admin';
import { useRequestText } from '../requests/useRequestText';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './TableRequests.module.css';

/** The table's open waiter calls and bill requests, oldest first, each with Done. */
export function TableRequests({
  requests,
  now,
}: {
  requests: readonly AdminServiceRequest[];
  now: Date | null;
}) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const { showToast } = useToast();
  const resolve = useResolveRequest();
  const text = useRequestText();

  const age = (since: string) => {
    if (!now) return null;
    const minutes = minutesSince(since, now);
    return minutes < 1
      ? t('adminHome.queue.age.now')
      : t('adminHome.queue.age.minutes', { count: minutes });
  };

  return (
    <section className={styles.panel} aria-labelledby="requests-title">
      <h2 id="requests-title" className={styles.title}>
        {t('adminTables.detail.requests.title')}
      </h2>
      <ul className={styles.list}>
        {requests.map((request) => {
          const { title, detail } = text(request);
          const when = age(request.requestedAt);
          // Hidden while this request's Done is on its way.
          if (resolve.isPending && resolve.variables?.request.id === request.id) return null;
          return (
            <li key={request.id} className={cx(styles.item, styles[request.kind])}>
              <span className={styles.icon} aria-hidden="true">
                <Icon name={request.kind === 'waiter' ? 'bell' : 'receipt'} size="sm" />
              </span>
              <span className={styles.body}>
                <span className={styles.what}>{title}</span>
                {(detail || when) && (
                  <span className={styles.detail}>
                    {[detail, when].filter(Boolean).join(' · ')}
                  </span>
                )}
              </span>
              <button
                type="button"
                className={styles.done}
                aria-label={t('adminTables.detail.requests.doneLabel', { what: title })}
                onClick={() =>
                  resolve.mutate(
                    { branchId: branch.id, request },
                    {
                      onError: () =>
                        showToast(t('adminTables.detail.requests.failed'), { tone: 'error' }),
                    },
                  )
                }
              >
                <Icon name="check" size="xs" />
                {t('adminTables.detail.requests.done')}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
