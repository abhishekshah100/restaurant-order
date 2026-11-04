'use client';

import { useState } from 'react';
import { isApiError } from '@/api/client';
import { useCashDay, useContent } from '@/api/hooks';
import { useSignOffCashDay } from '@/api/mutations';
import { Button, Textarea } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { differenceKind } from '@/lib/cashRegister';
import { cx } from '@/lib/cx';
import { SumRows } from '../payments/PaymentFields';
import { usePaymentText } from '../payments/usePaymentText';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { SessionRow } from './SessionRow';
import styles from './CashRegister.module.css';

/**
 * Day end: a day at the register (the branch's calendar day, today by default). Its cash from
 * the floats to the count, card and UPI against what was counted, the sessions (those needing
 * review marked), and the sign-off: a manager accepts the day once its sessions are closed.
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

      {!summary ? (
        <p className={styles.muted} aria-busy={!query.isError}>
          {query.isError ? t('adminCash.failed') : t('adminCash.loading')}
        </p>
      ) : summary.sessions.length === 0 ? (
        <p className={styles.card}>{t('adminCash.day.status.empty')}</p>
      ) : (
        <>
          <p
            className={cx(
              styles.dayStatus,
              summary.signOff ? styles.match : summary.open ? undefined : styles.over,
            )}
            role="status"
          >
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
            {summary.signOff?.note ? ` · ${summary.signOff.note}` : ''}
          </p>
          {summary.needsReview > 0 && (
            <p className={cx(styles.chip, styles.short)}>
              {t.plural('adminCash.day.needsReview', summary.needsReview)}
            </p>
          )}

          <section className={styles.card} aria-labelledby="day-cash">
            <h2 id="day-cash" className={styles.cardTitle}>
              {t('adminCash.day.cashTitle')}
            </h2>
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
                {
                  label: t('adminCash.current.expected'),
                  value: money.format(summary.cash.expected),
                  tone: 'total',
                },
                {
                  label: t('adminCash.close.countedRow'),
                  value: money.format(summary.cash.counted),
                },
                {
                  label: t('adminCash.close.difference'),
                  value: money.format(summary.cash.difference),
                  tone: summary.cash.difference === 0 ? 'ok' : 'due',
                },
              ]}
            />
          </section>

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
