'use client';

import { useState } from 'react';
import { isApiError } from '@/api/client';
import { useContent } from '@/api/hooks';
import { useRecordDeposit } from '@/api/mutations';
import { Button, Dialog } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { depositAsked } from '@/lib/reservations';
import type { Reservation, ReservationRules } from '@/types/admin';
import type { AtTableMethodKey } from '@/types/branch';
import { AmountInput, parseAmount } from '../payments/PaymentFields';
import { ProofPicker } from '../payments/ProofPicker';
import { useProofPhotos } from '../payments/useProofPhotos';
import { usePaymentText } from '../payments/usePaymentText';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import payments from '../payments/PaymentDialogs.module.css';
import styles from './ReservationExtras.module.css';

/** The photos' row in useProofPhotos (one deposit at a time). */
const PROOF_ROW = 'deposit';

/**
 * The guest's advance for a booking: how much (the branch's asked amount to start with), how
 * they paid, and for UPI or card proof photos. Cash goes into the open cash register.
 */
export function DepositDialog({
  reservation: r,
  rules,
  onClose,
}: {
  reservation: Reservation;
  rules?: ReservationRules;
  onClose: () => void;
}) {
  const t = useContent('common');
  const { branch, region, money } = useAdminWorkspace();
  const { methodName } = usePaymentText();
  const { showToast } = useToast();
  const record = useRecordDeposit();
  const proofs = useProofPhotos(branch.id);
  const asked = depositAsked(rules, r.partySize, 0);
  const [amountText, setAmount] = useState(asked > 0 ? String(asked) : '');
  const methods = region.payments.atTable;
  const [method, setMethod] = useState<AtTableMethodKey>(
    methods.includes('cash') ? 'cash' : methods[0],
  );
  const amount = parseAmount(amountText);
  const photos = method === 'cash' ? [] : proofs.keysOf(PROOF_ROW);
  const ready = amount !== null && amount > 0 && !proofs.unsettled([PROOF_ROW]);

  const submit = () => {
    if (!ready || amount === null) return;
    record.mutate(
      {
        branchId: branch.id,
        id: r.id,
        body: { amount, method, ...(photos.length > 0 ? { proofs: photos } : {}) },
      },
      {
        onSuccess: () => {
          showToast(t('adminReservations.deposit.done', { amount: money.format(amount) }), {
            tone: 'success',
          });
          onClose();
        },
        onError: (error) =>
          showToast(
            isApiError(error, 'register_closed')
              ? t('adminReservations.deposit.registerClosed')
              : isApiError(error, 'deposit_exists')
                ? t('adminReservations.deposit.exists')
                : t('adminReservations.deposit.failed'),
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
      title={t('adminReservations.deposit.dialogTitle', { id: r.id })}
      footer={
        <Button
          block
          iconStart="check"
          disabled={!ready}
          loading={record.isPending}
          onClick={submit}
        >
          {t('adminReservations.deposit.confirm', { amount: money.format(amount ?? 0) })}
        </Button>
      }
    >
      <div className={styles.form}>
        <AmountInput
          id="deposit-amount"
          label={t('adminReservations.deposit.amount')}
          symbol={region.currency.symbol}
          value={amountText}
          onChange={setAmount}
          hint={
            asked > 0 && rules
              ? t('adminReservations.deposit.asked', {
                  amount: money.format(asked),
                  people: r.partySize,
                  each: money.format(rules.depositPerPerson),
                })
              : undefined
          }
        />
        <div role="radiogroup" aria-labelledby="deposit-method" className={styles.block}>
          <p id="deposit-method" className={styles.label}>
            {t('adminReservations.deposit.method')}
          </p>
          <div className={payments.quick}>
            {methods.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={method === m}
                className={payments.quickButton}
                onClick={() => {
                  if (m === 'cash') proofs.drop(PROOF_ROW);
                  setMethod(m);
                }}
              >
                {methodName(m)}
              </button>
            ))}
          </div>
        </div>
        {method !== 'cash' && (
          <ProofPicker
            id="deposit-proofs"
            photos={proofs.photosOf(PROOF_ROW)}
            onAdd={(files) => proofs.add(PROOF_ROW, files)}
            onRemove={(photo) => proofs.remove(PROOF_ROW, photo)}
          />
        )}
      </div>
    </Dialog>
  );
}
