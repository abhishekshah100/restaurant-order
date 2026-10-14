'use client';

import { useContent } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { serviceQueue } from '@/lib/adminService';
import type { AdminBranchService } from '@/types/admin';
import { QueueItemRow } from './QueueItemRow';
import { useQueueActions } from './useQueueActions';
import styles from './ServiceQueue.module.css';

/** "Needs you now": waiter calls, bill requests and food ready to serve, oldest first. */
export function ServiceQueue({ service, now }: { service: AdminBranchService; now: Date | null }) {
  const t = useContent('common');
  const act = useQueueActions();
  const items = serviceQueue(service);

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
    </section>
  );
}
