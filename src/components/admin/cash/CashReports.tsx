'use client';

import { useState } from 'react';
import { useCashReport, useContent } from '@/api/hooks';
import { useSetCashLimit } from '@/api/mutations';
import { Button, Dialog } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { differenceKind } from '@/lib/cashRegister';
import { shiftDay } from '@/lib/dayRange';
import { AmountInput, parseAmount } from '../payments/PaymentFields';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './CashRegister.module.css';

/** The longest report the server gives, and the default. */
const MAX_DAYS = 92;
const DEFAULT_DAYS = 30;

/** How big a difference can be before a session needs review: reviewers set it. */
function DifferenceLimit({ limit, onClose }: { limit: number; onClose: () => void }) {
  const t = useContent('common');
  const { branch, region, money } = useAdminWorkspace();
  const { showToast } = useToast();
  const save = useSetCashLimit();
  const [text, setText] = useState(String(limit));
  const value = parseAmount(text);
  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminCash.limit.title')}
      description={t('adminCash.limit.body')}
    >
      <div className={styles.form}>
        <AmountInput
          id="cash-limit-amount"
          label={t('adminCash.limit.label')}
          symbol={region.currency.symbol}
          value={text}
          onChange={setText}
          compact
        />
        <Button
          variant="secondary"
          disabled={value === null || value === limit}
          loading={save.isPending}
          onClick={() =>
            value !== null &&
            save.mutate(
              { branchId: branch.id, differenceLimit: value },
              {
                onSuccess: () => {
                  showToast(t('adminCash.limit.saved', { amount: money.format(value) }), {
                    tone: 'success',
                  });
                  onClose();
                },
                onError: () => showToast(t('adminCash.limit.failed'), { tone: 'error' }),
              },
            )
          }
        >
          {t('adminCash.limit.save')}
        </Button>
      </div>
    </Dialog>
  );
}

/**
 * Reports: for the days chosen (the last 30 by default), four figures at a glance (total short,
 * total extra, days with a difference, drawers to check); the closed drawers day by day (should
 * be, counted, difference, to check, signed off) and who closed them (drawers, short, extra).
 * Reviewers set the allowed difference under Settings.
 */
export function CashReports({ today, limit }: { today: string; limit: number }) {
  const t = useContent('common');
  const { branch, money, clock, can } = useAdminWorkspace();
  const [from, setFrom] = useState(shiftDay(today, -(DEFAULT_DAYS - 1)));
  const [to, setTo] = useState(today);
  const valid = from <= to && to <= today && from >= shiftDay(to, -(MAX_DAYS - 1));
  const report = useCashReport(branch.id, valid ? { from, to } : { from: to, to }).data;
  const dayLabel = (day: string) => clock.date(`${day}T12:00:00Z`);
  const [settings, setSettings] = useState(false);
  // The days at a glance: what went missing, what was extra, how often, what to check.
  const kpis = report
    ? [
        {
          key: 'kpiShort',
          value: money.format(report.staff.reduce((sum, s) => sum + s.short, 0)),
          tone: report.staff.some((s) => s.short > 0) ? styles.short : undefined,
        },
        {
          key: 'kpiOver',
          value: money.format(report.staff.reduce((sum, s) => sum + s.over, 0)),
          tone: report.staff.some((s) => s.over > 0) ? styles.over : undefined,
        },
        {
          key: 'kpiDays',
          value: String(report.days.filter((d) => d.difference !== 0).length),
        },
        {
          key: 'kpiReview',
          value: String(report.days.reduce((sum, d) => sum + d.needsReview, 0)),
          tone: report.days.some((d) => d.needsReview > 0) ? styles.short : undefined,
        },
      ]
    : [];

  return (
    <div className={styles.form}>
      <div className={styles.reportTop}>
        <div className={styles.rangeRow}>
          <label className={styles.dateField}>
            <span className={styles.label}>{t('adminCash.report.from')}</span>
            <input
              type="date"
              className={styles.dateInput}
              value={from}
              max={to}
              onChange={(event) => event.target.value && setFrom(event.target.value)}
            />
          </label>
          <label className={styles.dateField}>
            <span className={styles.label}>{t('adminCash.report.to')}</span>
            <input
              type="date"
              className={styles.dateInput}
              value={to}
              max={today}
              onChange={(event) => event.target.value && setTo(event.target.value)}
            />
          </label>
        </div>
        {can('cash.review') && (
          <Button
            size="sm"
            variant="secondary"
            iconStart="sliders"
            onClick={() => setSettings(true)}
          >
            {t('adminCash.report.settings')}
          </Button>
        )}
      </div>
      {!valid && <p className={styles.muted}>{t('adminCash.report.range')}</p>}

      {kpis.length > 0 && (
        <dl className={styles.kpis}>
          {kpis.map((k) => (
            <div key={k.key} className={styles.kpi}>
              <dt>{t(`adminCash.report.${k.key as 'kpiShort'}`)}</dt>
              <dd className={k.tone}>{k.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <section className={styles.card} aria-labelledby="report-days">
        <h2 id="report-days" className={styles.cardTitle}>
          {t('adminCash.report.daysTitle')}
        </h2>
        {!report ? (
          <p className={styles.muted}>{t('adminCash.loading')}</p>
        ) : report.days.length === 0 ? (
          <p className={styles.muted}>{t('adminCash.report.none')}</p>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t('adminCash.report.day')}</th>
                  <th scope="col">{t('adminCash.report.sessions')}</th>
                  <th scope="col">{t('adminCash.report.expected')}</th>
                  <th scope="col">{t('adminCash.report.counted')}</th>
                  <th scope="col">{t('adminCash.report.difference')}</th>
                  <th scope="col">{t('adminCash.report.review')}</th>
                  <th scope="col">{t('adminCash.report.signedOff')}</th>
                </tr>
              </thead>
              <tbody>
                {report.days.map((d) => (
                  <tr key={d.day}>
                    <th scope="row">{dayLabel(d.day)}</th>
                    <td>{d.sessions}</td>
                    <td>{money.format(d.expected)}</td>
                    <td>{money.format(d.counted)}</td>
                    <td className={styles[differenceKind(d.difference)]}>
                      {money.format(d.difference)}
                    </td>
                    <td className={d.needsReview > 0 ? styles.short : undefined}>
                      {d.needsReview > 0 ? d.needsReview : '–'}
                    </td>
                    <td>{d.signedOff ? t('adminCash.report.yes') : t('adminCash.report.no')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {report && report.staff.length > 0 && (
        <section className={styles.card} aria-labelledby="report-staff">
          <h2 id="report-staff" className={styles.cardTitle}>
            {t('adminCash.report.staffTitle')}
          </h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t('adminCash.report.name')}</th>
                <th scope="col">{t('adminCash.report.sessions')}</th>
                <th scope="col">{t('adminCash.report.short')}</th>
                <th scope="col">{t('adminCash.report.over')}</th>
              </tr>
            </thead>
            <tbody>
              {report.staff.map((s) => (
                <tr key={s.name}>
                  <th scope="row">{s.name}</th>
                  <td>{s.sessions}</td>
                  <td className={s.short > 0 ? styles.short : undefined}>
                    {money.format(s.short)}
                  </td>
                  <td className={s.over > 0 ? styles.over : undefined}>{money.format(s.over)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {settings && <DifferenceLimit limit={limit} onClose={() => setSettings(false)} />}
    </div>
  );
}
