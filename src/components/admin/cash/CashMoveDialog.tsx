'use client';

import { useState } from 'react';
import type { CashMovementReason } from '@/api/contracts';
import { isApiError } from '@/api/client';
import { useContent } from '@/api/hooks';
import { useMoveCash } from '@/api/mutations';
import { Button, Dialog, Textarea } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { MOVEMENT_REASONS } from '@/lib/cashRegister';
import { AmountInput, parseAmount } from '../payments/PaymentFields';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import payments from '../payments/PaymentDialogs.module.css';
import styles from './CashRegister.module.css';

/** Cash put into the drawer or taken out that isn't an order's: how much, why, a note. */
export function CashMoveDialog({ kind, onClose }: { kind: 'in' | 'out'; onClose: () => void }) {
  const t = useContent('common');
  const { branch, region, money } = useAdminWorkspace();
  const { showToast } = useToast();
  const move = useMoveCash();
  const [amountText, setAmount] = useState('');
  const [reason, setReason] = useState<CashMovementReason | null>(null);
  const [note, setNote] = useState('');
  const amount = parseAmount(amountText);
  const ready = amount !== null && amount > 0 && reason !== null;
  const formatted = money.format(amount ?? 0);

  const submit = () => {
    if (!ready) return;
    move.mutate(
      {
        branchId: branch.id,
        body: { kind, amount, reason, ...(note.trim() ? { note: note.trim() } : {}) },
      },
      {
        onSuccess: () => {
          showToast(
            t(kind === 'in' ? 'adminCash.move.doneIn' : 'adminCash.move.doneOut', {
              amount: formatted,
            }),
            { tone: 'success' },
          );
          onClose();
        },
        onError: (error) =>
          showToast(
            isApiError(error, 'register_closed')
              ? t('adminCash.errors.closed')
              : t('adminCash.errors.failed'),
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
      title={t(kind === 'in' ? 'adminCash.move.titleIn' : 'adminCash.move.titleOut')}
      footer={
        <Button
          block
          iconStart={kind === 'in' ? 'plus' : 'minus'}
          disabled={!ready}
          loading={move.isPending}
          onClick={submit}
        >
          {t(kind === 'in' ? 'adminCash.move.confirmIn' : 'adminCash.move.confirmOut', {
            amount: formatted,
          })}
        </Button>
      }
    >
      <div className={styles.form}>
        <AmountInput
          id="cash-move-amount"
          label={t('adminCash.move.amount')}
          symbol={region.currency.symbol}
          value={amountText}
          onChange={setAmount}
        />
        <div role="radiogroup" aria-labelledby="cash-move-why" className={styles.reasons}>
          <p id="cash-move-why" className={styles.label}>
            {t('adminCash.move.reason')}
          </p>
          <div className={payments.quick}>
            {MOVEMENT_REASONS[kind].map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={reason === r}
                className={payments.quickButton}
                onClick={() => setReason(r)}
              >
                {t(`adminCash.reasons.${r}`)}
              </button>
            ))}
          </div>
        </div>
        <Textarea
          id="cash-move-note"
          label={t('adminCash.move.note')}
          optional
          rows={2}
          maxLength={200}
          placeholder={t('adminCash.move.notePlaceholder')}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
    </Dialog>
  );
}
