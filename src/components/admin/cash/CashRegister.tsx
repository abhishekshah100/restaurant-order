'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { isBackendEnabled } from '@/api/backend';
import type { CashSession } from '@/api/contracts';
import { isApiError } from '@/api/client';
import { useCashRegister, useContent } from '@/api/hooks';
import { useOpenRegister } from '@/api/mutations';
import { useNow } from '@/hooks/useNow';
import { Button, Icon } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { cx } from '@/lib/cx';
import { SumRows } from '../payments/PaymentFields';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { CashAmountField, useCashAmount } from './CashAmountField';
import { CashDayEnd } from './CashDayEnd';
import { CashReports } from './CashReports';
import { SessionRow } from './SessionRow';
import styles from './CashRegister.module.css';

const CashMoveDialog = dynamic(() => import('./CashMoveDialog').then((m) => m.CashMoveDialog), {
  ssr: false,
});
const CloseRegisterDialog = dynamic(
  () => import('./CloseRegisterDialog').then((m) => m.CloseRegisterDialog),
  { ssr: false },
);
const CashSessionDialog = dynamic(
  () => import('./CashSessionDialog').then((m) => m.CashSessionDialog),
  { ssr: false },
);

/** A session's sums (float, cash taken and handed back, paid in and out, expected, counted). */
export function CashTotalsRows({ session }: { session: CashSession }) {
  const t = useContent('common');
  const { money } = useAdminWorkspace();
  const totals = session.totals;
  if (!totals) return <p className={styles.muted}>{t('adminCash.current.blind')}</p>;
  return (
    <SumRows
      rows={[
        { label: t('adminCash.current.float'), value: money.format(session.float) },
        {
          label: totals.tips
            ? `${t('adminCash.current.taken')} (${t('adminCash.current.tips', { amount: money.format(totals.tips) })})`
            : t('adminCash.current.taken'),
          value: money.format(totals.taken),
        },
        { label: t('adminCash.current.refunded'), value: money.format(-totals.refunded) },
        { label: t('adminCash.current.paidIn'), value: money.format(totals.paidIn) },
        { label: t('adminCash.current.paidOut'), value: money.format(-totals.paidOut) },
        {
          label: t('adminCash.current.expected'),
          value: money.format(totals.expected),
          tone: 'total',
        },
        ...(session.counted !== undefined
          ? [
              { label: t('adminCash.close.countedRow'), value: money.format(session.counted) },
              {
                label: t('adminCash.close.difference'),
                value: money.format(session.difference ?? 0),
                tone: (session.difference ?? 0) === 0 ? ('ok' as const) : ('due' as const),
              },
            ]
          : []),
      ]}
    />
  );
}

/** What was paid in and out of a session, oldest first. */
export function MovementList({ session }: { session: CashSession }) {
  const t = useContent('common');
  const { money, clock } = useAdminWorkspace();
  return (
    <section className={styles.block} aria-labelledby={`moves-${session.id}`}>
      <h3 id={`moves-${session.id}`} className={styles.blockTitle}>
        {t('adminCash.movements.title')}
      </h3>
      {session.movements.length === 0 ? (
        <p className={styles.muted}>{t('adminCash.movements.none')}</p>
      ) : (
        <ul className={styles.moves}>
          {session.movements.map((m) => (
            <li key={m.id} className={styles.move}>
              <span
                className={cx(styles.moveIcon, m.kind === 'out' && styles.out)}
                aria-hidden="true"
              >
                <Icon name={m.kind === 'in' ? 'plus' : 'minus'} size="xs" />
              </span>
              <span className={styles.moveBody}>
                <span className={styles.moveTitle}>{t(`adminCash.reasons.${m.reason}`)}</span>
                <span className={styles.muted}>
                  {[clock.time(m.at), m.by && t('adminCash.movements.by', { name: m.by }), m.note]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <span className={styles.moveAmount}>
                {money.format(m.kind === 'in' ? m.amount : -m.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Closed: the float to open with (the last count by default), as a total or note by note. */
function OpenRegister({ lastCounted }: { lastCounted?: number }) {
  const t = useContent('common');
  const { branch, money } = useAdminWorkspace();
  const { showToast } = useToast();
  const open = useOpenRegister();
  const cash = useCashAmount(lastCounted !== undefined ? String(lastCounted) : '');
  const submit = () => {
    if (cash.amount === null) return;
    open.mutate(
      {
        branchId: branch.id,
        body: { float: cash.amount, ...(cash.counted ? { count: cash.counted } : {}) },
      },
      {
        onSuccess: (session) =>
          showToast(t('adminCash.open.done', { amount: money.format(session.float) }), {
            tone: 'success',
          }),
        onError: (error) =>
          showToast(
            isApiError(error, 'register_open')
              ? t('adminCash.open.exists')
              : t('adminCash.errors.failed'),
            { tone: 'error' },
          ),
      },
    );
  };
  return (
    <section className={styles.card} aria-labelledby="cash-open-title">
      <h2 id="cash-open-title" className={styles.cardTitle}>
        {t('adminCash.open.title')}
      </h2>
      <p className={styles.muted}>{t('adminCash.open.body')}</p>
      <CashAmountField
        id="cash-open"
        label={t('adminCash.open.float')}
        hint={
          lastCounted !== undefined
            ? t('adminCash.open.floatHint', { amount: money.format(lastCounted) })
            : undefined
        }
        cash={cash}
      />
      <Button
        iconStart="check"
        disabled={cash.amount === null}
        loading={open.isPending}
        onClick={submit}
      >
        {t('adminCash.open.confirm')}
      </Button>
    </section>
  );
}

/**
 * /admin/dashboard/cash/: the branch's cash drawer. Closed, it opens with a float; open, it
 * shows who opened it, its sums (for staff who see reports: the close count is blind), cash paid
 * in and out, and closes with a count. Under it, the recent sessions. Backend only.
 */
export function CashRegister() {
  const t = useContent('common');
  const { branch, clock, money, can } = useAdminWorkspace();
  const backend = isBackendEnabled();
  const query = useCashRegister(branch.id, backend);
  const runs = can('cash.manage');
  const [tab, setTab] = useState<'register' | 'day' | 'reports'>('register');
  const [moving, setMoving] = useState<'in' | 'out' | null>(null);
  const [closing, setClosing] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const today = clock.dayKey(useNow() ?? new Date());

  let body;
  if (!backend) {
    body = <p className={styles.card}>{t('adminCash.backendOnly')}</p>;
  } else if (query.isError) {
    body = (
      <div className={styles.card}>
        <p>{t('adminCash.failed')}</p>
        <Button variant="secondary" onClick={() => void query.refetch()}>
          {t('adminCash.retry')}
        </Button>
      </div>
    );
  } else if (!query.data) {
    body = (
      <p className={styles.muted} aria-busy="true">
        {t('adminCash.loading')}
      </p>
    );
  } else {
    const { current, recent, lastCounted } = query.data;
    body = (
      <>
        {current ? (
          <section className={styles.card} aria-labelledby="cash-current-title">
            <div className={styles.cardHead}>
              <h2 id="cash-current-title" className={styles.cardTitle}>
                {t('adminCash.register', { number: current.number })}
              </h2>
              <span className={cx(styles.chip, styles.isOpen)}>{t('adminCash.status.open')}</span>
            </div>
            <p className={styles.muted}>
              {current.openedBy
                ? t('adminCash.openedBy', {
                    time: clock.dateTime(current.openedAt),
                    name: current.openedBy,
                  })
                : t('adminCash.opened', { time: clock.dateTime(current.openedAt) })}
            </p>
            {current.totals ? (
              <CashTotalsRows session={current} />
            ) : (
              <>
                <SumRows
                  rows={[
                    { label: t('adminCash.current.float'), value: money.format(current.float) },
                  ]}
                />
                <p className={styles.muted}>{t('adminCash.current.blind')}</p>
              </>
            )}
            {runs && (
              <div className={styles.cardActions}>
                <Button variant="secondary" iconStart="plus" onClick={() => setMoving('in')}>
                  {t('adminCash.actions.payIn')}
                </Button>
                <Button variant="secondary" iconStart="minus" onClick={() => setMoving('out')}>
                  {t('adminCash.actions.payOut')}
                </Button>
                <Button iconStart="lock" onClick={() => setClosing(true)}>
                  {t('adminCash.actions.close')}
                </Button>
              </div>
            )}
            <MovementList session={current} />
          </section>
        ) : runs ? (
          <OpenRegister lastCounted={lastCounted} />
        ) : (
          <p className={styles.card}>{t('adminCash.status.closed')}</p>
        )}

        <section className={styles.block} aria-labelledby="cash-history-title">
          <h2 id="cash-history-title" className={styles.blockTitle}>
            {t('adminCash.history.title')}
          </h2>
          {recent.length === 0 ? (
            <p className={styles.muted}>{t('adminCash.history.none')}</p>
          ) : (
            <ul className={styles.history}>
              {recent.map((s) => (
                <li key={s.id}>
                  <SessionRow session={s} onOpen={() => setViewing(s.id)} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {moving && <CashMoveDialog kind={moving} onClose={() => setMoving(null)} />}
        {closing && current && (
          <CloseRegisterDialog session={current} onClose={() => setClosing(false)} />
        )}
        {viewing && <CashSessionDialog id={viewing} onClose={() => setViewing(null)} />}
      </>
    );
  }

  const tabs = ['register', 'day', 'reports'] as const;
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('adminCash.title')}</h1>
        <p className={styles.muted}>{t('adminCash.subtitle')}</p>
      </header>
      {backend && (
        <div className={styles.tabs} role="tablist" aria-label={t('adminCash.tabs.label')}>
          {tabs.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={styles.tab}
              onClick={() => setTab(id)}
            >
              {t(`adminCash.tabs.${id}`)}
            </button>
          ))}
        </div>
      )}
      {tab === 'register' || !backend ? (
        body
      ) : tab === 'day' ? (
        <CashDayEnd today={today} onOpenSession={setViewing} />
      ) : (
        <CashReports today={today} limit={query.data?.differenceLimit ?? 0} />
      )}
      {tab !== 'register' && viewing && (
        <CashSessionDialog id={viewing} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}
