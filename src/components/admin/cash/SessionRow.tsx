'use client';

import type { CashSessionSummary } from '@/api/contracts';
import { useContent } from '@/api/hooks';
import { differenceKind } from '@/lib/cashRegister';
import { cx } from '@/lib/cx';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './CashRegister.module.css';

/** One register session in a list: when, who closed it, what was counted and how it came out. */
export function SessionRow({
  session: s,
  onOpen,
}: {
  session: CashSessionSummary;
  onOpen: () => void;
}) {
  const t = useContent('common');
  const { money, clock } = useAdminWorkspace();
  const closed = s.closedAt !== undefined;
  const kind = differenceKind(s.difference ?? 0);
  return (
    <button
      type="button"
      className={styles.historyRow}
      aria-label={t('adminCash.history.view', { number: s.number })}
      onClick={onOpen}
    >
      <span className={styles.historyMain}>
        <strong>{t('adminCash.register', { number: s.number })}</strong>
        <span className={styles.muted}>
          {t('adminCash.history.when', {
            from: clock.dateTime(s.openedAt),
            to: s.closedAt ? clock.time(s.closedAt) : '…',
          })}
          {s.closedBy ? ` · ${s.closedBy}` : ''}
        </span>
      </span>
      <span className={styles.historyNumbers}>
        {closed ? (
          <>
            <span>{money.format(s.counted ?? 0)}</span>
            <span className={cx(styles.chip, styles[kind])}>
              {kind === 'match'
                ? t('adminCash.close.match')
                : kind === 'short'
                  ? t('adminCash.close.short', { amount: money.format(-(s.difference ?? 0)) })
                  : t('adminCash.close.over', { amount: money.format(s.difference ?? 0) })}
            </span>
            {s.overLimit && (
              <span className={cx(styles.chip, styles.short)}>{t('adminCash.needsReview')}</span>
            )}
          </>
        ) : (
          <span className={cx(styles.chip, styles.isOpen)}>{t('adminCash.status.open')}</span>
        )}
      </span>
    </button>
  );
}
