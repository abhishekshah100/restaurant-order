import { useContent } from '@/api/hooks';
import { Icon } from '@/components/ui';
import type { DaySummary } from '@/lib/adminPayments';
import { methodIcon, usePaymentText } from './usePaymentText';
import styles from './MethodBreakdown.module.css';

/**
 * Today's payments by method (cash, card, UPI, eSewa…), the most taken first, each with its
 * share of the day, how many and anything refunded; then the cash that should be in the drawer.
 */
export function MethodBreakdown({ day }: { day: DaySummary }) {
  const t = useContent('common');
  const { amount, methodName } = usePaymentText();
  const largest = Math.max(1, ...day.byMethod.map((m) => m.amount));

  return (
    <section className={styles.card} aria-labelledby="methods-title">
      <h2 id="methods-title" className={styles.title}>
        {t('adminPayments.methods.title')}
      </h2>
      {day.byMethod.length > 0 ? (
        <ul className={styles.list}>
          {day.byMethod.map((m) => (
            <li
              key={m.method}
              className={styles.row}
              aria-label={t('adminPayments.methods.row', {
                method: methodName(m.method),
                amount: amount(m.amount),
                count: t.plural('adminPayments.methods.count', m.count),
              })}
            >
              <span className={styles.icon} data-channel={m.channel} aria-hidden="true">
                <Icon name={methodIcon(m.method)} size="sm" />
              </span>
              <span className={styles.body} aria-hidden="true">
                <span className={styles.head}>
                  <span className={styles.name}>{methodName(m.method)}</span>
                  <span className={styles.amount}>{amount(m.amount)}</span>
                </span>
                <span className={styles.track}>
                  <span
                    className={styles.fill}
                    data-channel={m.channel}
                    style={{ width: `${(m.amount / largest) * 100}%` }}
                  />
                </span>
                <span className={styles.meta}>
                  {t.plural('adminPayments.methods.count', m.count)}
                  {m.refunds > 0 &&
                    ` · ${t('adminPayments.methods.refunded', { amount: amount(m.refunds) })}`}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>{t('adminPayments.methods.empty')}</p>
      )}
      <div className={styles.drawer}>
        <span className={styles.drawerIcon} aria-hidden="true">
          <Icon name="cash" size="sm" />
        </span>
        <span className={styles.drawerText}>
          <span className={styles.drawerLabel}>{t('adminPayments.methods.drawer')}</span>
          <span className={styles.drawerHint}>{t('adminPayments.methods.drawerHint')}</span>
        </span>
        <strong className={styles.drawerAmount}>{amount(day.cashInDrawer)}</strong>
      </div>
    </section>
  );
}
