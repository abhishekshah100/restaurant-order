'use client';

import { useState } from 'react';
import { isApiError } from '@/api/client';
import { useContent } from '@/api/hooks';
import { useTransferStep } from '@/api/mutations';
import { Button, Dialog, Input } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { cx } from '@/lib/cx';
import { parseQuantity } from '@/lib/inventory';
import type { StockTransfer } from '@/types/inventory';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { TransferStatusChip } from './TransfersTab';
import { useInventoryText } from './useInventoryText';
import styles from './Inventory.module.css';

/**
 * One transfer: what was sent, and what arrived. The receiving branch's manager confirms what
 * came (everything sent, unless they say less: the rest is lost on the way); the sender can call
 * it back while it's on its way, and the stock returns.
 */
export function TransferDialog({
  transfer: x,
  onClose,
}: {
  transfer: StockTransfer | undefined;
  onClose: () => void;
}) {
  const t = useContent('common');
  const { branch, can, clock } = useAdminWorkspace();
  const text = useInventoryText();
  const { showToast } = useToast();
  const step = useTransferStep();
  const [received, setReceived] = useState<Record<string, string>>({});
  const [tried, setTried] = useState(false);
  if (!x) return null;

  const receiving = x.direction === 'in' && x.status === 'sent' && can('inventory.manage');
  const cancelling = x.direction === 'out' && x.status === 'sent' && can('inventory.manage');
  const parsed = x.lines.map((l) => {
    const typed = received[l.ingredientId];
    const n = typed === undefined ? l.quantity : parseQuantity(typed);
    return { line: l, received: n, ok: n !== null && n >= 0 && n <= l.quantity };
  });

  const run = (name: 'receive' | 'cancel') => {
    if (name === 'receive') {
      setTried(true);
      if (!parsed.every((p) => p.ok)) return;
    }
    step.mutate(
      {
        branchId: branch.id,
        id: x.id,
        step: name,
        ...(name === 'receive'
          ? {
              lines: parsed.map((p) => ({
                ingredientId: p.line.ingredientId,
                received: p.received ?? 0,
              })),
            }
          : {}),
      },
      {
        onSuccess: () => {
          showToast(t(`adminInventory.transfers.done.${name}`), { tone: 'success' });
          onClose();
        },
        onError: (error) =>
          showToast(
            isApiError(error, 'transfer_closed')
              ? t('adminInventory.transfers.closed')
              : t('adminInventory.errors.failed'),
            { tone: 'error' },
          ),
      },
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={
        x.direction === 'out'
          ? t('adminInventory.transfers.to', { number: x.number, name: x.to.name })
          : t('adminInventory.transfers.from', { number: x.number, name: x.from.name })
      }
      description={[
        t('adminInventory.transfers.sentAt', { time: clock.dateTime(x.sentAt) }),
        x.sentBy && t('adminInventory.by', { name: x.sentBy }),
        x.note,
      ]
        .filter(Boolean)
        .join(' · ')}
      footer={
        receiving || cancelling ? (
          <div className={styles.actions}>
            {receiving && (
              <Button
                block
                iconStart="check"
                loading={step.isPending}
                onClick={() => run('receive')}
              >
                {t('adminInventory.transfers.receive')}
              </Button>
            )}
            {cancelling && (
              <Button
                variant="secondary"
                iconStart="x"
                loading={step.isPending}
                onClick={() => run('cancel')}
              >
                {t('adminInventory.transfers.cancel')}
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      <div className={styles.form}>
        <div className={styles.lineHead}>
          <TransferStatusChip transfer={x} />
          {x.endedAt && (
            <span className={styles.muted}>
              {[
                clock.dateTime(x.endedAt),
                x.receivedBy && t('adminInventory.by', { name: x.receivedBy }),
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
        </div>
        {receiving && <p className={styles.muted}>{t('adminInventory.transfers.receiveHint')}</p>}
        <ul className={styles.list}>
          {parsed.map(({ line, ok }) => (
            <li key={line.ingredientId} className={styles.countLine}>
              <div className={styles.rowMain}>
                <span className={styles.rowName}>{line.name}</span>
                <span className={styles.muted}>
                  {[
                    t('adminInventory.transfers.sentQuantity', {
                      quantity: text.quantity(line.quantity, line.unit),
                    }),
                    line.value !== undefined ? text.value(line.value) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
              {line.received !== undefined && (
                <span className={styles.rowSide}>
                  <span className={styles.quantity}>{text.quantity(line.received, line.unit)}</span>
                  {line.lost ? (
                    <span className={cx(styles.muted, styles.negative)}>
                      {[
                        t('adminInventory.transfers.lost', {
                          quantity: text.quantity(line.lost, line.unit),
                        }),
                        line.lostValue !== undefined ? text.value(line.lostValue) : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  ) : null}
                </span>
              )}
              {receiving && (
                <Input
                  id={`receive-${line.ingredientId}`}
                  label={t('adminInventory.transfers.arrived', { unit: text.unit(line.unit) })}
                  inputMode="decimal"
                  autoComplete="off"
                  value={received[line.ingredientId] ?? String(line.quantity)}
                  error={tried && !ok ? t('adminInventory.transfers.arrivedError') : undefined}
                  onChange={(event) =>
                    setReceived((all) => ({ ...all, [line.ingredientId]: event.target.value }))
                  }
                />
              )}
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}
