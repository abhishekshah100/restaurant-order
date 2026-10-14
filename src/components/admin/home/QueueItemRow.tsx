'use client';

import { useContent } from '@/api/hooks';
import { Icon, type IconName } from '@/components/ui';
import { minutesSince, type QueueItem } from '@/lib/adminService';
import { cx } from '@/lib/cx';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { WhereBadge } from './WhereBadge';
import styles from './QueueItemRow.module.css';

/** From this long, the age turns amber; from twice as long, red. */
const WAIT_WARN_MINUTES = 5;

const KIND_ICONS: Record<QueueItem['kind'], IconName> = {
  waiter: 'bell',
  bill: 'receipt',
  ready: 'cloche',
};

/** What the row says: its title and the line under it. */
function useDescription(item: QueueItem) {
  const t = useContent('common');
  const { money } = useAdminWorkspace();
  if (item.kind === 'waiter') {
    const { reason, note } = item.request;
    return {
      title: t(`adminHome.queue.reasons.${reason}`),
      detail: note ? t('adminHome.queue.note', { note }) : undefined,
    };
  }
  if (item.kind === 'bill') {
    const { scope, balance } = item.request;
    return {
      title: t('adminHome.queue.bill.title'),
      detail: [
        t(`adminHome.queue.bill.${scope}`),
        t('adminHome.queue.bill.balance', { amount: money.format(balance) }),
      ].join(' · '),
    };
  }
  const { order, ready } = item;
  return {
    title: t('adminHome.queue.ready.title', { order: order.id }),
    detail: [
      order.readyRounds.length > 1 || ready.round > 1
        ? t('adminHome.queue.ready.round', { round: ready.round })
        : null,
      t.plural('adminHome.queue.ready.items', ready.itemCount),
      order.customerName,
    ]
      .filter(Boolean)
      .join(' · '),
  };
}

/** One thing waiting on the floor: where, what, how long, and the one action that clears it. */
export function QueueItemRow({
  item,
  now,
  onAct,
}: {
  item: QueueItem;
  now: Date | null;
  onAct: () => void;
}) {
  const t = useContent('common');
  const { title, detail } = useDescription(item);
  const minutes = now ? minutesSince(item.since, now) : null;
  const table = item.kind === 'ready' ? item.order.table : item.request.table;
  const mode = item.kind === 'ready' ? item.order.mode : 'dineIn';
  const where =
    table !== undefined
      ? t('adminHome.queue.where.table', { table })
      : t(`adminHome.queue.where.${mode === 'delivery' ? 'delivery' : 'pickup'}`);
  const action =
    item.kind !== 'ready'
      ? t('adminHome.queue.done')
      : mode === 'takeaway'
        ? t('adminHome.queue.handOver')
        : t('adminHome.queue.serve');

  let age: string | null = null;
  if (minutes !== null) {
    if (minutes < 1) age = t('adminHome.queue.age.now');
    else if (minutes < 60) age = t('adminHome.queue.age.minutes', { count: minutes });
    else
      age = t('adminHome.queue.age.hours', {
        hours: Math.floor(minutes / 60),
        minutes: minutes % 60,
      });
  }

  return (
    <li className={cx(styles.item, styles[item.kind])}>
      <WhereBadge table={table} mode={mode} />
      <div className={styles.body}>
        <p className={styles.title}>
          <Icon name={KIND_ICONS[item.kind]} size="xs" className={styles.kindIcon} />
          {title}
        </p>
        {detail && <p className={styles.detail}>{detail}</p>}
      </div>
      {age && (
        <p
          className={cx(
            styles.age,
            minutes !== null && minutes >= WAIT_WARN_MINUTES && styles.waiting,
            minutes !== null && minutes >= WAIT_WARN_MINUTES * 2 && styles.late,
          )}
        >
          <Icon name="clock" size="xs" />
          <time dateTime={item.since}>{age}</time>
        </p>
      )}
      <button
        type="button"
        className={cx(styles.action, item.kind === 'ready' && styles.primary)}
        onClick={onAct}
        aria-label={t('adminHome.queue.actionLabel', { action, what: title, where })}
      >
        <Icon name="check" size="xs" className={styles.actionIcon} />
        {action}
      </button>
    </li>
  );
}
