'use client';

import { useContent } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { useAdminName, useAdminStaffId } from '@/hooks/useAdminSession';
import { mineFirst, serviceQueue } from '@/lib/adminService';
import { sectionsFor } from '@/lib/adminTables';
import type { AdminBranchService } from '@/types/admin';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { useRequestText } from '../requests/useRequestText';
import { QueueItemRow } from './QueueItemRow';
import { useQueueActions } from './useQueueActions';
import styles from './ServiceQueue.module.css';

/** "Needs you now": waiter calls, bill requests and food ready to serve, oldest first. */
export function ServiceQueue({ service, now }: { service: AdminBranchService; now: Date | null }) {
  const t = useContent('common');
  const act = useQueueActions();
  const me = { id: useAdminStaffId(), name: useAdminName() };
  // With a section: my tables first, then the rest (each oldest first).
  const { mine, others } = sectionsFor(service.sections, me);
  const items = mineFirst(serviceQueue(service), mine, others);

  return (
    <section className={styles.panel} aria-labelledby="queue-title">
      <header className={styles.head}>
        <div>
          <h2 id="queue-title" className={styles.title}>
            {t('adminHome.queue.title')}
          </h2>
          <p className={styles.subtitle}>{t('adminHome.queue.subtitle')}</p>
        </div>
        {items.length > 0 && (
          <span className={styles.count}>{t.plural('adminHome.queue.count', items.length)}</span>
        )}
      </header>

      {items.length > 0 ? (
        <ol className={styles.list}>
          {items.map((item) => (
            <QueueItemRow key={item.key} item={item} now={now} onAct={() => act(item)} />
          ))}
        </ol>
      ) : (
        <div className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden="true">
            <Icon name="check" size="md" />
          </span>
          <p className={styles.emptyTitle}>{t('adminHome.queue.empty.title')}</p>
          <p className={styles.emptyBody}>{t('adminHome.queue.empty.body')}</p>
        </div>
      )}
      <Handled done={service.doneRequests} />
    </section>
  );
}

/** How many of the last half hour's handled requests show (Requests lists them all). */
const HANDLED_SHOWN = 4;

/**
 * Handled in the last 30 minutes: what, where, by whom and when, newest first, so two waiters
 * don't head to the same table.
 */
function Handled({ done }: { done: AdminBranchService['doneRequests'] }) {
  const t = useContent('common');
  const { clock } = useAdminWorkspace();
  const text = useRequestText();
  if (done.length === 0) return null;
  return (
    <div className={styles.handled}>
      <h3 className={styles.handledTitle}>
        <Icon name="history" size="xs" />
        {t('adminHome.queue.handled.title')}
      </h3>
      <ul className={styles.handledList}>
        {done.slice(0, HANDLED_SHOWN).map((request) => (
          <li key={request.id} className={styles.handledRow}>
            <span className={styles.handledWhere}>
              {request.table !== undefined ? (
                t('adminHome.queue.where.table', { table: request.table })
              ) : (
                <Icon name="chef" size="xs" />
              )}
            </span>
            <span className={styles.handledWhat}>{text(request).title}</span>
            <span className={styles.handledWho}>
              {[request.resolvedBy, request.resolvedAt && clock.time(request.resolvedAt)]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
