'use client';

import { useState } from 'react';
import { isApiError } from '@/api/client';
import { useCashDay, useContent } from '@/api/hooks';
import { useSignOffCashDay } from '@/api/mutations';
import { Button, Chip, Icon, IconButton, Textarea } from '@/components/ui';
import { shiftDay } from '@/lib/dayRange';
import { useToast } from '@/context/ToastContext';
import { differenceKind } from '@/lib/cashRegister';
import { cx } from '@/lib/cx';
import { SumRows } from '../payments/PaymentFields';
import { usePaymentText } from '../payments/usePaymentText';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { SessionRow } from './SessionRow';
import styles from './CashRegister.module.css';

/**
 * End of day: a day at the drawer (the branch's calendar day, today by default). At the top where
 * it stands (signed off, waiting, a drawer still open; how many closed, open, need a check); then
 * did the cash match, for the drawers closed that day only (what should have been there against
 * what was counted: a drawer still open isn't counted yet, so it's left out and said so); the
 * cash during the day, card and UPI, the drawers, and Sign off the day (a manager, once every
 * drawer is closed).
 */
export function CashDayEnd({
  today,
  onOpenSession,
}: {
  today: string;
  onOpenSession: (id: string) => void;
}) {
  const t = useContent('common');
  const { branch, money, clock, can } = useAdminWorkspace();
  const { methodName } = usePaymentText();
  const { showToast } = useToast();
  const [day, setDay] = useState(today);
  const [note, setNote] = useState('');
  const query = useCashDay(branch.id, day);
  const signOff = useSignOffCashDay();
  const summary = query.data;
  const dayLabel = clock.date(`${day}T12:00:00Z`);
  // Did the cash match: the drawers closed that day only (one still open isn't counted yet).
  const closed = summary?.sessions.filter((s) => s.closedAt !== undefined) ?? [];
  const openCount = (summary?.sessions.length ?? 0) - closed.length;
  const result = closed.reduce(
    (sum, s) => {
      const counted = s.counted ?? 0;
      const difference = s.difference ?? 0;
      return {
        expected: sum.expected + (s.expected ?? counted - difference),
        counted: sum.counted + counted,
        difference: sum.difference + difference,
      };
    },
    { expected: 0, counted: 0, difference: 0 },
  );

  const sign = () =>
    signOff.mutate(
      { branchId: branch.id, day, ...(note.trim() ? { note: note.trim() } : {}) },
      {
        onSuccess: () => {
          setNote('');
          showToast(t('adminCash.day.signedToast', { day: dayLabel }), { tone: 'success' });
        },
        onError: (error) =>
          showToast(
            isApiError(error, 'day_open')
              ? t('adminCash.day.status.open')
              : t('adminCash.day.signFailed'),
            { tone: 'error' },
          ),
      },
    );

  return (
    <div className={styles.form}>
      {/* The day, with the day before and after a tap away (managers check today or yesterday). */}
      <div className={styles.dayPicker}>
        <label className={styles.dateField}>
          <span className={styles.label}>{t('adminCash.day.date')}</span>
          <input
            type="date"
            className={styles.dateInput}
            value={day}
            max={today}
            onChange={(event) => event.target.value && setDay(event.target.value)}
          />
        </label>
        <div className={styles.dayQuick}>
          <IconButton
            icon="back"
            variant="raised"
            label={t('adminCash.day.prevDay')}
            onClick={() => setDay(shiftDay(day, -1))}
          />
          <IconButton
            icon="arrow"
            variant="raised"
            label={t('adminCash.day.nextDay')}
            disabled={day >= today}
            onClick={() => setDay(shiftDay(day, 1))}
          />
          <Chip pressed={day === shiftDay(today, -1)} onClick={() => setDay(shiftDay(today, -1))}>
            {t('adminCash.day.yesterday')}
          </Chip>
          <Chip pressed={day === today} onClick={() => setDay(today)}>
            {t('adminCash.day.today')}
          </Chip>
        </div>
      </div>

      {!summary ? (
        <p className={styles.muted} aria-busy={!query.isError}>
          {query.isError ? t('adminCash.failed') : t('adminCash.loading')}
        </p>
      ) : summary.sessions.length === 0 ? (
        <p className={styles.card}>{t('adminCash.day.status.empty')}</p>
      ) : (
        <>
          <section
            className={cx(
              styles.card,
              styles.dayHead,
              summary.signOff
                ? styles.daySigned
                : summary.open
                  ? styles.dayOpen
                  : styles.dayWaiting,
            )}
            aria-labelledby="day-status"
          >
            <p id="day-status" className={styles.dayHeadTitle}>
              <Icon
                name={summary.signOff ? 'checkc' : summary.open ? 'clock' : 'alert'}
                size="sm"
              />
              {summary.signOff
                ? summary.signOff.by
                  ? t('adminCash.day.status.signed', {
                      name: summary.signOff.by,
                      time: clock.dateTime(summary.signOff.at),
                    })
                  : t('adminCash.day.status.signedNoName', {
                      time: clock.dateTime(summary.signOff.at),
                    })
                : summary.open
                  ? t('adminCash.day.status.open')
                  : t('adminCash.day.status.pending')}
            </p>
            {summary.signOff?.note && <p className={styles.muted}>{summary.signOff.note}</p>}
            <p className={styles.dayCounts}>
              {[
                t.plural('adminCash.day.closedCount', closed.length),
                openCount > 0 && t.plural('adminCash.day.openCount', openCount),
                summary.needsReview > 0 &&
                  t.plural('adminCash.day.needsReview', summary.needsReview),
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </section>

          {closed.length > 0 && (
            <section className={styles.card} aria-labelledby="day-cash">
              <h2 id="day-cash" className={styles.cardTitle}>
                {t('adminCash.day.cashTitle')}
              </h2>
              <p className={styles.muted}>{t('adminCash.day.cashBody')}</p>
              <dl className={styles.compare}>
                <div>
                  <dt>{t('adminCash.day.expected')}</dt>
                  <dd>{money.format(result.expected)}</dd>
                </div>
                <div>
                  <dt>{t('adminCash.day.counted')}</dt>
                  <dd>{money.format(result.counted)}</dd>
                </div>
                <div className={styles[differenceKind(result.difference)]}>
                  <dt>{t('adminCash.day.difference')}</dt>
                  <dd>
                    {result.difference === 0
                      ? t('adminCash.close.match')
                      : result.difference < 0
                        ? t('adminCash.close.short', {
                            amount: money.format(-result.difference),
                          })
                        : t('adminCash.close.over', { amount: money.format(result.difference) })}
                  </dd>
                </div>
              </dl>
              {openCount > 0 && (
                <p className={styles.muted}>{t.plural('adminCash.day.openNote', openCount)}</p>
              )}
            </section>
          )}

          <details className={styles.flow}>
            <summary>{t('adminCash.day.flowTitle')}</summary>
            <SumRows
              rows={[
                { label: t('adminCash.current.float'), value: money.format(summary.cash.float) },
                { label: t('adminCash.current.taken'), value: money.format(summary.cash.taken) },
                {
                  label: t('adminCash.current.refunded'),
                  value: money.format(-summary.cash.refunded),
                },
                { label: t('adminCash.current.paidIn'), value: money.format(summary.cash.paidIn) },
                {
                  label: t('adminCash.current.paidOut'),
                  value: money.format(-summary.cash.paidOut),
                },
              ]}
            />
          </details>

          {summary.methods.length > 0 && (
            <section className={styles.card} aria-labelledby="day-methods">
              <h2 id="day-methods" className={styles.cardTitle}>
                {t('adminCash.day.methodsTitle')}
              </h2>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">{t('adminCash.day.way')}</th>
                    <th scope="col">{t('adminCash.day.expected')}</th>
                    <th scope="col">{t('adminCash.day.counted')}</th>
                    <th scope="col">{t('adminCash.day.difference')}</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.methods.map((m) => (
                    <tr key={m.method}>
                      <th scope="row">{methodName(m.method)}</th>
                      <td>{money.format(m.expected)}</td>
                      <td>
                        {m.counted !== undefined
                          ? money.format(m.counted)
                          : t('adminCash.close.notChecked')}
                      </td>
                      <td
                        className={
                          m.difference !== undefined
                            ? styles[differenceKind(m.difference)]
                            : undefined
                        }
                      >
                        {m.difference !== undefined ? money.format(m.difference) : '–'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section className={styles.block} aria-labelledby="day-sessions">
            <h2 id="day-sessions" className={styles.blockTitle}>
              {t('adminCash.day.sessionsTitle')}
            </h2>
            <ul className={styles.history}>
              {summary.sessions.map((s) => (
                <li key={s.id}>
                  <SessionRow session={s} onOpen={() => onOpenSession(s.id)} />
                </li>
              ))}
            </ul>
          </section>

          {can('cash.review') && !summary.signOff && (
            <section className={styles.card} aria-labelledby="day-sign">
              <h2 id="day-sign" className={styles.cardTitle}>
                {t('adminCash.day.signOff')}
              </h2>
              <p className={styles.muted}>{t('adminCash.day.signOffBody')}</p>
              <Textarea
                id="day-sign-note"
                label={t('adminCash.day.signOffNote')}
                optional
                rows={2}
                maxLength={300}
                placeholder={t('adminCash.day.signOffPlaceholder')}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
              <Button
                block
                iconStart="check"
                disabled={summary.open}
                loading={signOff.isPending}
                onClick={sign}
              >
                {t('adminCash.day.signOff')}
              </Button>
            </section>
          )}
        </>
      )}
    </div>
  );
}
