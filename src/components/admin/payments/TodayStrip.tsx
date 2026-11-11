import { useContent } from '@/api/hooks';
import { Icon } from '@/components/ui';
import type { DaySummary, DueSections } from '@/lib/adminPayments';
import { cx } from '@/lib/cx';
import { usePaymentText } from './usePaymentText';
import styles from './TodayStrip.module.css';

/**
 * Today's money in one strip, the two numbers staff ask about first: To collect (every bill
 * still open, the same as the list below, with what's from earlier days) and Taken today (after
 * refunds). Under them, small: online, in person, tips, refunds. Day report and Excel at the top.
 */
export function TodayStrip({
  day,
  due,
  bills,
  period,
  onCollect,
  onReport,
  onExport,
}: {
  /** Today's money as it was taken. */
  day: Pick<DaySummary, 'net' | 'online' | 'inPerson' | 'tips' | 'refunds' | 'waived'>;
  due: Pick<DueSections, 'total' | 'earlierTotal'>;
  /** How many bills are open. */
  bills: number;
  /** "Today · 11 Nov 2026". */
  period: string;
  onCollect: () => void;
  onReport: () => void;
  onExport: () => void;
}) {
  const t = useContent('common');
  const { amount } = usePaymentText();
  const open = due.total > 0;

  const small: { key: string; label: string; value: number; tone?: string }[] = [
    { key: 'online', label: t('adminPayments.strip.online'), value: day.online },
    { key: 'inPerson', label: t('adminPayments.strip.inPerson'), value: day.inPerson },
    { key: 'tips', label: t('adminPayments.strip.tips'), value: day.tips },
    {
      key: 'refunds',
      label: t('adminPayments.strip.refunds'),
      value: day.refunds,
      tone: day.refunds > 0 ? styles.refunds : undefined,
    },
  ];
  if (day.waived > 0) {
    small.push({ key: 'left', label: t('adminPayments.strip.left'), value: day.waived });
  }

  return (
    <section className={styles.strip} aria-labelledby="today-title">
      <div className={styles.head}>
        <h2 id="today-title" className={styles.period}>
          {period}
        </h2>
        <div className={styles.tools}>
          <button type="button" className={styles.tool} onClick={onReport}>
            <Icon name="receipt" size="xs" />
            {t('adminPayments.actions.report')}
          </button>
          <button
            type="button"
            className={styles.tool}
            aria-label={t('adminPayments.actions.export')}
            onClick={onExport}
          >
            <Icon name="list" size="xs" />
            {t('adminPayments.strip.export')}
          </button>
        </div>
      </div>

      <div className={styles.main}>
        <button
          type="button"
          className={cx(styles.big, styles.collect, open ? styles.open : styles.settled)}
          onClick={onCollect}
        >
          <span className={styles.label}>
            <Icon name={open ? 'clock' : 'checkc'} size="xs" />
            {t('adminPayments.strip.toCollect')}
          </span>
          <span className={styles.value}>{amount(due.total)}</span>
          <span className={styles.hint}>
            {open
              ? [
                  t.plural('adminPayments.strip.bills', bills),
                  due.earlierTotal > 0 &&
                    t('adminPayments.strip.earlier', { amount: amount(due.earlierTotal) }),
                ]
                  .filter(Boolean)
                  .join(' · ')
              : t('adminPayments.strip.settled')}
          </span>
        </button>
        <div className={styles.big}>
          <span className={styles.label}>
            <Icon name="cash" size="xs" />
            {t('adminPayments.strip.taken')}
          </span>
          <span className={styles.value}>{amount(day.net)}</span>
          <span className={styles.hint}>{t('adminPayments.strip.takenHint')}</span>
        </div>
      </div>

      <dl className={styles.small}>
        {small.map((s) => (
          <div key={s.key} className={cx(styles.item, s.tone)}>
            <dt>{s.label}</dt>
            <dd>{amount(s.value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
