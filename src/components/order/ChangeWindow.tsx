'use client';

import { useState } from 'react';
import { useContent } from '@/api/hooks';
import { Button, Icon } from '@/components/ui';
import { useCancelOrderAction, useChangeWindow, useEditOrder } from '@/hooks/useOrderChanges';
import { cx } from '@/lib/cx';
import { formatCountdown } from '@/lib/format';
import { isFinished } from '@/lib/orders';
import type { Order } from '@/types/order';
import { CancelOrderDialog } from './CancelOrderDialog';
import styles from './ChangeWindow.module.css';

/**
 * "You can change or cancel for 1:42" with Change and Cancel, on the guest's own order while
 * its latest round is still waiting for the kitchen and within the branch's window. Once the
 * kitchen starts or the time is up, the actions give way to a line saying why.
 */
export function ChangeWindow({ order, className }: { order: Order; className?: string }) {
  const changes = useChangeWindow(order);
  const editOrder = useEditOrder();
  const { cancel, cancelling } = useCancelOrderAction(order);
  const [confirming, setConfirming] = useState(false);
  const t = useContent('orders');
  if (!changes || isFinished(order)) return null;

  if (!changes.open) {
    return (
      <p className={cx(styles.closed, className)} role="status">
        <Icon name="lock" size="sm" />
        <span>
          {t(`change.closed.${changes.reason}`)} {t(`change.help.${order.mode}`)}
        </span>
      </p>
    );
  }

  const round = changes.round.number;
  const { isTab } = changes;
  return (
    <section className={cx(styles.card, className)} aria-label={t('change.label')}>
      <p className={styles.text}>
        <Icon name="clock" size="sm" />
        <span>
          {t.rich(
            isTab ? 'change.openRound' : 'change.open',
            { b: (c) => <b className={styles.time}>{c}</b> },
            { round, time: formatCountdown(changes.secondsLeft) },
          )}
          <span className={styles.hint}>{t('change.openHint')}</span>
        </span>
      </p>
      <div className={styles.actions}>
        <Button variant="secondary" size="sm" iconStart="pencil" onClick={() => editOrder(order)}>
          {isTab ? t('change.changeRound', { round }) : t('change.change')}
        </Button>
        <Button variant="ghost" size="sm" iconStart="x" onClick={() => setConfirming(true)}>
          {isTab ? t('change.cancelRound', { round }) : t('change.cancel')}
        </Button>
      </div>
      <CancelOrderDialog
        open={confirming}
        order={order}
        round={round}
        isTab={isTab}
        cancelling={cancelling}
        onClose={() => setConfirming(false)}
        onConfirm={async () => {
          if (await cancel(round)) setConfirming(false);
        }}
      />
    </section>
  );
}
