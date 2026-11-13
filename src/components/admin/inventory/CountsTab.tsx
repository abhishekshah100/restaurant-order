'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useContent, useStockCounts } from '@/api/hooks';
import { Button } from '@/components/ui';
import { cx } from '@/lib/cx';
import type { CountStatus, StockCount } from '@/types/inventory';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { useInventoryText } from './useInventoryText';
import { useCountSheet } from './CountSheet';
import styles from './Inventory.module.css';

const StartCountDialog = dynamic(
  () => import('./StartCountDialog').then((m) => m.StartCountDialog),
  { ssr: false },
);
const CountDialog = dynamic(() => import('./CountDialog').then((m) => m.CountDialog), {
  ssr: false,
});

const OPEN: readonly CountStatus[] = ['counting', 'submitted'];

/** "Counting", "To apply", "Applied" or "Cancelled", coloured. */
export function CountStatusChip({ status }: { status: CountStatus }) {
  const t = useContent('common');
  const tone = { counting: styles.low, submitted: styles.out, applied: styles.ok, cancelled: '' };
  return (
    <span className={cx(styles.chip, tone[status])}>
      {t(`adminInventory.counts.status.${status}`)}
    </span>
  );
}

/**
 * Stock counts, newest first: those still open (counting, or waiting for a manager to apply)
 * and those done. Staff who count start one (or carry on with the open one); each opens to count
 * it, or for managers to see its differences and apply it.
 */
export function CountsTab() {
  const t = useContent('common');
  const { branch, can } = useAdminWorkspace();
  const text = useInventoryText();
  const query = useStockCounts(branch.id);
  const [starting, setStarting] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const counts = query.data?.counts;
  const mayCount = can('inventory.count', 'inventory.manage');
  const sheet = useCountSheet();

  if (query.isError) {
    return (
      <div className={styles.card}>
        <p>{t('adminInventory.failed')}</p>
        <Button variant="secondary" onClick={() => void query.refetch()}>
          {t('adminInventory.retry')}
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className={styles.actions}>
        {mayCount && (
          <Button iconStart="checkc" onClick={() => setStarting(true)}>
            {t('adminInventory.counts.start')}
          </Button>
        )}
        {sheet.ready && (
          <Button variant="secondary" iconStart="receipt" onClick={sheet.print}>
            {t('adminInventory.sheet.print')}
          </Button>
        )}
      </div>
      {sheet.sheet}
      <p className={styles.muted}>{t('adminInventory.counts.hint')}</p>
      {!counts ? (
        <p className={styles.muted} aria-busy="true">
          {t('adminInventory.loading')}
        </p>
      ) : counts.length === 0 ? (
        <p className={styles.card}>{t('adminInventory.counts.empty')}</p>
      ) : (
        <ul className={styles.list}>
          {counts.map((c) => (
            <li key={c.id}>
              <CountRow count={c} onOpen={() => setOpen(c.id)} format={text.signedWhole} />
            </li>
          ))}
        </ul>
      )}
      {starting && (
        <StartCountDialog
          onClose={() => setStarting(false)}
          onStarted={(id) => {
            setStarting(false);
            setOpen(id);
          }}
        />
      )}
      {open && <CountDialog id={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function CountRow({
  count: c,
  onOpen,
  format,
}: {
  count: Omit<StockCount, 'lines'>;
  onOpen: () => void;
  format: (n: number) => string;
}) {
  const t = useContent('common');
  const { clock } = useAdminWorkspace();
  const when = c.appliedAt ?? c.submittedAt ?? c.startedAt;
  return (
    <button type="button" className={styles.row} onClick={onOpen}>
      <span className={styles.rowMain}>
        <span className={styles.rowName}>
          {t('adminInventory.counts.number', { number: c.number })}
        </span>
        <span className={styles.muted}>
          {[
            t(`adminInventory.counts.scopes.${c.scope}`),
            clock.dateTime(when),
            (c.appliedBy ?? c.submittedBy ?? c.startedBy) &&
              t('adminInventory.by', { name: c.appliedBy ?? c.submittedBy ?? c.startedBy ?? '' }),
            c.note,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
      <span className={styles.rowSide}>
        <CountStatusChip status={c.status} />
        <span className={styles.muted}>
          {OPEN.includes(c.status)
            ? t('adminInventory.counts.progress', { counted: c.counted, total: c.total })
            : c.differenceValue !== undefined && c.status === 'applied'
              ? format(c.differenceValue)
              : ''}
        </span>
      </span>
    </button>
  );
}
