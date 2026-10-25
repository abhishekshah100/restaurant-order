import { useContent } from '@/api/hooks';
import { Icon } from '@/components/ui';
import type { DaySummary } from '@/lib/adminPayments';
import { cx } from '@/lib/cx';
import { usePaymentText } from './usePaymentText';
import styles from './TakingsSummary.module.css';

/**
 * The day's money (today's, or the days picked) at a glance: net takings (collected less refunded) with how it split between
 * online and in person, the day report and CSV export; then what's still to collect (opens To
 * collect), tips, the average bill and refunds.
 */
export function TakingsSummary({
  day,
  period,
  onCollect,
  onReport,
  onExport,
}: {
  day: DaySummary;
  /** The days, written out: "Today · 26 Oct 2026", "20 Oct 2026 – 25 Oct 2026". */
  period: string;
  onCollect: () => void;
  onReport: () => void;
  onExport: () => void;
}) {
  const t = useContent('common');
  const { amount } = usePaymentText();
  const paid = day.online + day.inPerson;
  const onlineShare = paid > 0 ? (day.online / paid) * 100 : 0;

  return (
    <section className={styles.summary} aria-labelledby="takings-title">
      <div className={styles.hero}>
        <p className={styles.eyebrow}>{period}</p>
        <h2 id="takings-title" className={styles.heroLabel}>
          {t('adminPayments.today.net')}
        </h2>
        <p className={styles.net}>{amount(day.net)}</p>
        <p className={styles.heroHint}>
          {t('adminPayments.today.netHint', {
            collected: amount(day.collected),
            refunds: amount(day.refunds),
          })}
        </p>

        <div className={styles.split}>
          <div
            className={styles.bar}
            role="img"
            aria-label={`${t('adminPayments.today.split')}: ${t('adminPayments.today.online')} ${amount(day.online)}, ${t('adminPayments.today.inPerson')} ${amount(day.inPerson)}`}
          >
            {paid > 0 && (
              <>
                <span className={styles.online} style={{ width: `${onlineShare}%` }} />
                <span className={styles.inPerson} style={{ width: `${100 - onlineShare}%` }} />
              </>
            )}
          </div>
          <dl className={styles.legend}>
            <div>
              <dt>
                <span className={cx(styles.swatch, styles.online)} aria-hidden="true" />
                {t('adminPayments.today.online')}
              </dt>
              <dd>{amount(day.online)}</dd>
            </div>
            <div>
              <dt>
                <span className={cx(styles.swatch, styles.inPerson)} aria-hidden="true" />
                {t('adminPayments.today.inPerson')}
              </dt>
              <dd>{amount(day.inPerson)}</dd>
            </div>
          </dl>
        </div>

        <div className={styles.heroActions}>
          <button type="button" className={styles.heroButton} onClick={onReport}>
            <Icon name="receipt" size="xs" />
            {t('adminPayments.actions.report')}
          </button>
          <button type="button" className={styles.heroButton} onClick={onExport}>
            <Icon name="list" size="xs" />
            {t('adminPayments.actions.export')}
          </button>
        </div>
      </div>

      <dl className={styles.kpis}>
        <div className={cx(styles.kpi, day.toCollect > 0 ? styles.due : styles.settled)}>
          <dt>
            <Icon name={day.toCollect > 0 ? 'clock' : 'checkc'} size="xs" />
            {t('adminPayments.today.toCollect')}
          </dt>
          <dd>
            <button type="button" className={styles.kpiLink} onClick={onCollect}>
              <span className={styles.kpiValue}>{amount(day.toCollect)}</span>
              <span className={styles.kpiHint}>
                {day.unpaidOrders > 0
                  ? t.plural('adminPayments.today.toCollectHint', day.unpaidOrders)
                  : t('adminPayments.today.settled')}
              </span>
            </button>
          </dd>
        </div>
        <div className={styles.kpi}>
          <dt>
            <Icon name="heart" size="xs" />
            {t('adminPayments.today.tips')}
          </dt>
          <dd>
            <span className={styles.kpiValue}>{amount(day.tips)}</span>
            <span className={styles.kpiHint}>{t('adminPayments.today.tipsHint')}</span>
          </dd>
        </div>
        <div className={styles.kpi}>
          <dt>
            <Icon name="receipt" size="xs" />
            {t('adminPayments.today.average')}
          </dt>
          <dd>
            <span className={styles.kpiValue}>{amount(day.averageBill)}</span>
            <span className={styles.kpiHint}>
              {t.plural('adminPayments.today.averageHint', day.paidOrders)}
            </span>
          </dd>
        </div>
        <div className={cx(styles.kpi, day.refunds > 0 && styles.refunds)}>
          <dt>
            <Icon name="refresh" size="xs" />
            {t('adminPayments.today.refunds')}
          </dt>
          <dd>
            <span className={styles.kpiValue}>{amount(day.refunds)}</span>
            <span className={styles.kpiHint}>
              {day.refundsPending > 0
                ? t('adminPayments.today.refundsHint', {
                    amount: amount(day.refundsPending),
                  })
                : t('adminPayments.today.refundsNone')}
            </span>
          </dd>
        </div>
      </dl>
    </section>
  );
}
