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

/** Closed: start the day by counting the drawer (note by note), or one tap for the last count. */
function OpenRegister({ lastCounted }: { lastCounted?: number }) {
  const t = useContent('common');
  const { branch, money } = useAdminWorkspace();
  const { showToast } = useToast();
  const open = useOpenRegister();
  const cash = useCashAmount();
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
    <section className={cx(styles.card, styles.startCard)} aria-labelledby="cash-open-title">
      <div className={styles.startHead}>
        <span className={styles.startIcon} aria-hidden="true">
          <Icon name="cash" size="md" />
        </span>
        <div>
          <h2 id="cash-open-title" className={styles.cardTitle}>
            {t('adminCash.open.title')}
          </h2>
          <p className={styles.muted}>{t('adminCash.open.body')}</p>
        </div>
      </div>
      <CashAmountField
        id="cash-open"
        label={t('adminCash.open.float')}
        cash={cash}
        suggestion={
          lastCounted !== undefined
            ? {
                label: t('adminCash.open.useLast', { amount: money.format(lastCounted) }),
                amount: lastCounted,
              }
            : undefined
        }
      />
      <Button
        block
        iconStart="check"
        disabled={cash.amount === null}
        loading={open.isPending}
        onClick={submit}
      >
        {cash.amount !== null
          ? t('adminCash.open.confirmAmount', { amount: money.format(cash.amount) })
          : t('adminCash.open.confirm')}
      </Button>
    </section>
  );
}

/** How the drawer's cash adds up: start + bills − given back + added − taken out = should be. */
export function CashEquation({ session }: { session: CashSession }) {
  const t = useContent('common');
  const { money } = useAdminWorkspace();
  const totals = session.totals;
  if (!totals) return null;
  const terms: { key: string; sign: '' | '+' | '−'; label: string; value: number }[] = [
    { key: 'float', sign: '', label: t('adminCash.current.float'), value: session.float },
    { key: 'taken', sign: '+', label: t('adminCash.current.taken'), value: totals.taken },
    { key: 'refunded', sign: '−', label: t('adminCash.current.refunded'), value: totals.refunded },
    { key: 'paidIn', sign: '+', label: t('adminCash.current.paidIn'), value: totals.paidIn },
    { key: 'paidOut', sign: '−', label: t('adminCash.current.paidOut'), value: totals.paidOut },
  ];
  return (
    <ol className={styles.equation} aria-label={t('adminCash.current.equation')}>
      {terms
        .filter((term) => term.key === 'float' || term.key === 'taken' || term.value > 0)
        .map((term) => (
          <li key={term.key} className={styles.term}>
            {term.sign && (
              <span className={styles.sign} aria-hidden="true">
                {term.sign}
              </span>
            )}
            <span className={styles.termBody}>
              <span className={styles.termLabel}>{term.label}</span>
              <span className={styles.termValue}>{money.format(term.value)}</span>
            </span>
          </li>
        ))}
    </ol>
  );
}

/**
 * /admin/dashboard/cash/: the branch's cash drawer. Closed: Start the day (count the cash, or
 * the last count in one tap) and open it. Open: who opened it and when (and a warning when it was
 * left open from an earlier day), what should be in it with how that adds up (for staff who see
 * reports: the close count is blind for the rest), Add cash, Take cash out and Close & count, and
 * the cash added or taken out. Under it, the earlier drawers. End of day and Reports are tabs.
 * Backend only.
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
    const stale = current && clock.dayKey(current.openedAt) < today;
    body = (
      <>
        {current ? (
          <section
            className={cx(styles.card, styles.drawerCard)}
            aria-labelledby="cash-current-title"
          >
            <div className={styles.drawerHead}>
              <span className={styles.liveDot} aria-hidden="true" />
              <div className={styles.drawerWho}>
                <h2 id="cash-current-title" className={styles.cardTitle}>
                  {t('adminCash.register', { number: current.number })}
                  <span className={cx(styles.chip, styles.isOpen)}>
                    {t('adminCash.status.open')}
                  </span>
                </h2>
                <p className={styles.muted}>
                  {current.openedBy
                    ? t('adminCash.openedBy', {
                        time: clock.dateTime(current.openedAt),
                        name: current.openedBy,
                      })
                    : t('adminCash.opened', { time: clock.dateTime(current.openedAt) })}
                </p>
              </div>
            </div>

            {stale && (
              <p className={styles.stale} role="alert">
                <Icon name="alert" size="sm" />
                {t('adminCash.stale', { date: clock.date(current.openedAt) })}
              </p>
            )}

            {current.totals ? (
              <div className={styles.expectedBox}>
                <p className={styles.expectedLabel}>{t('adminCash.current.expected')}</p>
                <p className={styles.expectedValue}>{money.format(current.totals.expected)}</p>
                <CashEquation session={current} />
              </div>
            ) : (
              <p className={styles.blindNote}>
                <Icon name="lock" size="xs" />
                {t('adminCash.current.blind')}
              </p>
            )}

            {runs && (
              <div className={styles.tiles}>
                <button type="button" className={styles.tile} onClick={() => setMoving('in')}>
                  <span className={cx(styles.tileIcon, styles.tileIn)} aria-hidden="true">
                    <Icon name="plus" size="sm" />
                  </span>
                  <span className={styles.tileText}>
                    <strong>{t('adminCash.actions.payIn')}</strong>
                    <span>{t('adminCash.actions.payInHint')}</span>
                  </span>
                </button>
                <button type="button" className={styles.tile} onClick={() => setMoving('out')}>
                  <span className={cx(styles.tileIcon, styles.tileOut)} aria-hidden="true">
                    <Icon name="minus" size="sm" />
                  </span>
                  <span className={styles.tileText}>
                    <strong>{t('adminCash.actions.payOut')}</strong>
                    <span>{t('adminCash.actions.payOutHint')}</span>
                  </span>
                </button>
                <button
                  type="button"
                  className={cx(styles.tile, styles.tileMain)}
                  onClick={() => setClosing(true)}
                >
                  <span className={styles.tileIcon} aria-hidden="true">
                    <Icon name="lock" size="sm" />
                  </span>
                  <span className={styles.tileText}>
                    <strong>{t('adminCash.actions.close')}</strong>
                    <span>{t('adminCash.actions.closeHint')}</span>
                  </span>
                </button>
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
