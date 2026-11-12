'use client';

import { useState } from 'react';
import type { DrawerCount } from '@/api/contracts';
import { useCashSession, useContent } from '@/api/hooks';
import { useCheckCashSession } from '@/api/mutations';
import { Button, Dialog, Icon, Textarea } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { differenceKind } from '@/lib/cashRegister';
import { cx } from '@/lib/cx';
import { usePaymentText } from '../payments/usePaymentText';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { CashEquation, MovementList } from './CashRegister';
import styles from './CashRegister.module.css';

/** Notes and coins as counted: "₹500 × 4   ₹2,000", and the total. */
function CountList({ label, count }: { label: string; count: DrawerCount }) {
  const t = useContent('common');
  const { money, region } = useAdminWorkspace();
  return (
    <div className={styles.countList}>
      <p className={styles.countTitle}>{label}</p>
      <ul>
        {count.map((c) => (
          <li key={c.value}>
            <span>
              {t('adminCash.session.countLine', {
                value: `${region.currency.symbol}${String(c.value)}`,
                quantity: c.quantity,
              })}
            </span>
            <span>{money.format(c.value * c.quantity)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One drawer in full: who opened and closed it and when; did the cash match (should be,
 * counted, difference) and what happened; for one that needed a check, the manager's check (Mark
 * as checked, with what they found) or who checked it; how the cash adds up; the notes and coins
 * counted at opening and closing; card and UPI; the cash added or taken out.
 */
export function CashSessionDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useContent('common');
  const { branch, clock, money, can } = useAdminWorkspace();
  const { methodName, amount } = usePaymentText();
  const { showToast } = useToast();
  const session = useCashSession(branch.id, id).data;
  const check = useCheckCashSession();
  const [note, setNote] = useState('');

  const markChecked = () => {
    if (!session) return;
    check.mutate(
      { branchId: branch.id, id: session.id, ...(note.trim() ? { note: note.trim() } : {}) },
      {
        onSuccess: () =>
          showToast(t('adminCash.session.checkedToast', { number: session.number }), {
            tone: 'success',
          }),
        onError: () => showToast(t('adminCash.session.checkFailed'), { tone: 'error' }),
      },
    );
  };

  let content;
  if (!session) {
    content = (
      <p className={styles.muted} aria-busy="true">
        {t('adminCash.loading')}
      </p>
    );
  } else {
    const closed = session.closedAt !== undefined;
    const difference = session.difference ?? 0;
    const kind = differenceKind(difference);
    content = (
      <div className={styles.form}>
        <dl className={styles.when}>
          <div>
            <dt>{t('adminCash.session.opened')}</dt>
            <dd>
              {[clock.dateTime(session.openedAt), session.openedBy].filter(Boolean).join(' · ')}
            </dd>
          </div>
          <div>
            <dt>{t('adminCash.session.closed')}</dt>
            <dd>
              {session.closedAt
                ? [clock.dateTime(session.closedAt), session.closedBy].filter(Boolean).join(' · ')
                : t('adminCash.session.stillOpen')}
            </dd>
          </div>
        </dl>

        {closed && session.totals && (
          <section className={styles.block} aria-labelledby="session-result">
            <h3 id="session-result" className={styles.blockTitle}>
              {t('adminCash.session.result')}
            </h3>
            <dl className={styles.compare}>
              <div>
                <dt>{t('adminCash.day.expected')}</dt>
                <dd>{money.format(session.totals.expected)}</dd>
              </div>
              <div>
                <dt>{t('adminCash.day.counted')}</dt>
                <dd>{money.format(session.counted ?? 0)}</dd>
              </div>
              <div className={styles[kind]}>
                <dt>{t('adminCash.day.difference')}</dt>
                <dd>
                  {kind === 'match'
                    ? t('adminCash.close.match')
                    : kind === 'short'
                      ? t('adminCash.close.short', { amount: money.format(-difference) })
                      : t('adminCash.close.over', { amount: money.format(difference) })}
                </dd>
              </div>
            </dl>
            {session.note && (
              <p className={styles.whyNote}>
                <strong>{t('adminCash.session.note')}: </strong>
                {session.note}
              </p>
            )}
          </section>
        )}

        {session.overLimit &&
          (session.checked ? (
            <p className={cx(styles.checkBox, styles.checkDone)}>
              <Icon name="checkc" size="sm" />
              <span>
                <strong>
                  {session.checked.by
                    ? t('adminCash.session.checked', {
                        name: session.checked.by,
                        time: clock.dateTime(session.checked.at),
                      })
                    : t('adminCash.session.checkedNoName', {
                        time: clock.dateTime(session.checked.at),
                      })}
                </strong>
                {session.checked.note && <span>{session.checked.note}</span>}
              </span>
            </p>
          ) : (
            <section
              className={cx(styles.checkBox, styles.checkTodo)}
              aria-labelledby="needs-check"
            >
              <p id="needs-check" className={styles.checkTitle}>
                <Icon name="alert" size="sm" />
                {t('adminCash.session.needsCheck')}
              </p>
              <p className={styles.muted}>
                {can('cash.review')
                  ? t('adminCash.session.needsCheckBody')
                  : t('adminCash.session.needsCheckWait')}
              </p>
              {can('cash.review') && (
                <>
                  <Textarea
                    id="cash-check-note"
                    label={t('adminCash.session.checkNote')}
                    optional
                    rows={2}
                    maxLength={300}
                    placeholder={t('adminCash.session.checkPlaceholder')}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                  <Button iconStart="check" loading={check.isPending} onClick={markChecked}>
                    {t('adminCash.session.markChecked')}
                  </Button>
                </>
              )}
            </section>
          ))}

        {session.totals && (
          <section className={styles.block} aria-labelledby="session-adds">
            <h3 id="session-adds" className={styles.blockTitle}>
              {t('adminCash.session.howItAddsUp')}
            </h3>
            <CashEquation session={session} />
          </section>
        )}

        {(session.openingCount?.length || session.closingCount?.length) && (
          <section className={styles.block} aria-labelledby="session-counts">
            <h3 id="session-counts" className={styles.blockTitle}>
              {t('adminCash.session.counts')}
            </h3>
            <div className={styles.counts}>
              {session.openingCount && session.openingCount.length > 0 && (
                <CountList
                  label={t('adminCash.session.openingCount')}
                  count={session.openingCount}
                />
              )}
              {session.closingCount && session.closingCount.length > 0 && (
                <CountList
                  label={t('adminCash.session.closingCount')}
                  count={session.closingCount}
                />
              )}
            </div>
          </section>
        )}

        {session.methods && session.methods.length > 0 && (
          <section className={styles.block} aria-labelledby="session-methods">
            <h3 id="session-methods" className={styles.blockTitle}>
              {t('adminCash.session.methods')}
            </h3>
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
                {session.methods.map((m) => (
                  <tr key={m.method}>
                    <th scope="row">{methodName(m.method)}</th>
                    <td>{amount(m.expected)}</td>
                    <td>
                      {m.counted !== undefined
                        ? amount(m.counted)
                        : t('adminCash.close.notChecked')}
                    </td>
                    <td
                      className={
                        m.difference !== undefined
                          ? styles[differenceKind(m.difference)]
                          : undefined
                      }
                    >
                      {m.difference !== undefined ? amount(m.difference) : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <MovementList session={session} />
      </div>
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={session ? t('adminCash.session.title', { number: session.number }) : ''}
    >
      {content}
    </Dialog>
  );
}
