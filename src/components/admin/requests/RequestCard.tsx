import Link from 'next/link';
import { useContent } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { minutesSince } from '@/lib/adminService';
import { tablePath } from '@/lib/adminNav';
import { cx } from '@/lib/cx';
import type { AdminServiceRequest } from '@/types/admin';
import { useRequestText } from './useRequestText';
import styles from './RequestCard.module.css';

/** From this long, the wait turns amber; from twice as long, red. */
const WAIT_WARN_MINUTES = 5;

/**
 * One open request: the table (opens its page), what the guest wants (or what the kitchen says
 * about an order) and how long they've waited, who's on the way, and the actions — On my way
 * while nobody has it, then Done.
 */
export function RequestCard({
  request,
  now,
  me,
  onAcknowledge,
  onResolve,
}: {
  request: AdminServiceRequest;
  now: Date | null;
  /** The signed-in staff member's name, to say "You're on the way". */
  me: string | undefined;
  onAcknowledge: () => void;
  onResolve: () => void;
}) {
  const t = useContent('common');
  const { title, detail } = useRequestText()(request);
  const minutes = now ? minutesSince(request.requestedAt, now) : null;
  const coming = request.acknowledgedBy;

  let age: string | null = null;
  if (minutes !== null) {
    age =
      minutes < 1
        ? t('adminHome.queue.age.now')
        : t('adminHome.queue.age.minutes', { count: minutes });
  }

  // A guest's table; a kitchen message's order's table, or the kitchen for takeaway and delivery.
  const where =
    request.table !== undefined
      ? t('adminHome.queue.where.table', { table: request.table })
      : t('adminRequests.kitchen');

  return (
    <li className={cx(styles.card, styles[request.kind], coming && styles.coming)}>
      {request.table !== undefined ? (
        <Link
          href={tablePath(request.table)}
          className={styles.table}
          aria-label={t('adminRequests.tableLink', { table: request.table })}
        >
          <span className={styles.tableCaption}>{t('adminHome.queue.table')}</span>
          <span className={styles.tableNumber}>{request.table}</span>
        </Link>
      ) : (
        <span className={styles.table}>
          <span className={styles.tableCaption}>{t('adminRequests.kitchen')}</span>
          <Icon name="chef" size="md" />
        </span>
      )}

      <div className={styles.body}>
        <p className={styles.title}>
          <Icon
            name={
              request.kind === 'waiter' ? 'bell' : request.kind === 'kitchen' ? 'chef' : 'receipt'
            }
            size="xs"
            className={styles.kindIcon}
          />
          {title}
        </p>
        {detail && <p className={styles.detail}>{detail}</p>}
        <p className={styles.meta}>
          {age && (
            <span
              className={cx(
                styles.age,
                !coming && minutes !== null && minutes >= WAIT_WARN_MINUTES && styles.waiting,
                !coming && minutes !== null && minutes >= WAIT_WARN_MINUTES * 2 && styles.late,
              )}
            >
              <Icon name="clock" size="xs" />
              <time dateTime={request.requestedAt}>{age}</time>
            </span>
          )}
          {coming && (
            <span className={styles.who}>
              <Icon name="user" size="xs" />
              {coming === me
                ? t('adminRequests.comingYou')
                : t('adminRequests.comingBy', { name: coming })}
            </span>
          )}
        </p>
      </div>

      <div className={styles.actions}>
        {!coming && (
          <button
            type="button"
            className={styles.acknowledge}
            onClick={onAcknowledge}
            aria-label={t('adminRequests.acknowledgeLabel', { what: title, where })}
          >
            <Icon name="arrow" size="xs" />
            {t('adminRequests.acknowledge')}
          </button>
        )}
        <button
          type="button"
          className={cx(styles.resolve, coming && styles.primary)}
          onClick={onResolve}
          aria-label={t('adminRequests.resolveLabel', { what: title, where })}
        >
          <Icon name="check" size="xs" />
          {t('adminRequests.resolve')}
        </button>
      </div>
    </li>
  );
}
