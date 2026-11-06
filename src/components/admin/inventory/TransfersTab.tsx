'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useContent, useStockTransfers } from '@/api/hooks';
import { Button } from '@/components/ui';
import { cx } from '@/lib/cx';
import type { StockTransfer, TransferStatus } from '@/types/inventory';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { useInventoryText } from './useInventoryText';
import styles from './Inventory.module.css';

const SendTransferDialog = dynamic(
  () => import('./SendTransferDialog').then((m) => m.SendTransferDialog),
  { ssr: false },
);
const TransferDialog = dynamic(() => import('./TransferDialog').then((m) => m.TransferDialog), {
  ssr: false,
});

export function TransferStatusChip({ transfer }: { transfer: StockTransfer }) {
  const t = useContent('common');
  const tone: Record<TransferStatus, string> = {
    sent: transfer.direction === 'in' ? styles.out : styles.low,
    received: styles.ok,
    cancelled: '',
  };
  return (
    <span className={cx(styles.chip, tone[transfer.status])}>
      {t(`adminInventory.transfers.status.${transfer.status}.${transfer.direction}`)}
    </span>
  );
}

/**
 * Stock sent to and from the restaurant's other branches: what's on its way here (to receive)
 * first, then the rest, newest first. Managers send stock and receive what comes.
 */
export function TransfersTab() {
  const t = useContent('common');
  const { branch, can, clock } = useAdminWorkspace();
  const text = useInventoryText();
  const query = useStockTransfers(branch.id);
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const data = query.data;

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
  const waiting = (x: StockTransfer) => x.direction === 'in' && x.status === 'sent';
  const transfers = [...(data?.transfers ?? [])].sort(
    (a, b) => Number(waiting(b)) - Number(waiting(a)),
  );

  return (
    <>
      {can('inventory.manage') && (data?.branches.length ?? 0) > 0 && (
        <div className={styles.actions}>
          <Button iconStart="swap" onClick={() => setSending(true)}>
            {t('adminInventory.transfers.send')}
          </Button>
        </div>
      )}
      {!data ? (
        <p className={styles.muted} aria-busy="true">
          {t('adminInventory.loading')}
        </p>
      ) : transfers.length === 0 ? (
        <p className={styles.card}>
          {data.branches.length === 0
            ? t('adminInventory.transfers.oneBranch')
            : t('adminInventory.transfers.empty')}
        </p>
      ) : (
        <ul className={styles.list}>
          {transfers.map((x) => (
            <li key={x.id}>
              <button type="button" className={styles.row} onClick={() => setOpen(x.id)}>
                <span className={styles.rowMain}>
                  <span className={styles.rowName}>
                    {x.direction === 'out'
                      ? t('adminInventory.transfers.to', { number: x.number, name: x.to.name })
                      : t('adminInventory.transfers.from', { number: x.number, name: x.from.name })}
                  </span>
                  <span className={styles.muted}>
                    {[
                      clock.dateTime(x.endedAt ?? x.sentAt),
                      t.plural('adminInventory.transfers.items', x.lines.length),
                      x.note,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <span className={styles.rowSide}>
                  <TransferStatusChip transfer={x} />
                  <span className={styles.muted}>
                    {[
                      x.value !== undefined ? text.value(x.value) : null,
                      x.lostValue
                        ? t('adminInventory.transfers.lostWorth', {
                            amount: text.value(x.lostValue),
                          })
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {sending && data && (
        <SendTransferDialog branches={data.branches} onClose={() => setSending(false)} />
      )}
      {open && data && (
        <TransferDialog
          transfer={data.transfers.find((x) => x.id === open)}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
