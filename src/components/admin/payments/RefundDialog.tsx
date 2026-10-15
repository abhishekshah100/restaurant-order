'use client';

import { useState } from 'react';
import { useContent } from '@/api/hooks';
import { useRefundOrder } from '@/api/mutations';
import { Button, Dialog, Textarea } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { MAX_REFUND_NOTE, REFUND_REASONS, ledgerOf, refundable } from '@/lib/adminPayments';
import type { Order, RefundReason } from '@/types/order';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { AmountInput, RadioTiles, SumRows, parseAmount } from './PaymentFields';
import { usePaymentText } from './usePaymentText';
import styles from './PaymentDialogs.module.css';

/**
 * Give money back on an order that stands: everything that can be refunded or part of it, why
 * (and a note for the day report), and where the money goes — back to the online method through
 * the payment partner, or in cash from the drawer now.
 */
export function RefundDialog({ order, onClose }: { order: Order | null; onClose: () => void }) {
  if (!order) return null;
  return <RefundForm key={order.id} order={order} onClose={onClose} />;
}

function RefundForm({ order, onClose }: { order: Order; onClose: () => void }) {
  const t = useContent('common');
  const { branch, region } = useAdminWorkspace();
  const { amount: format, methodName } = usePaymentText();
  const { showToast } = useToast();
  const refund = useRefundOrder();
  const [mode, setMode] = useState<'full' | 'custom'>('full');
  const [custom, setCustom] = useState('');
  const [reason, setReason] = useState<RefundReason>('complaint');
  const [note, setNote] = useState('');

  const ledger = ledgerOf(order);
  const paid = ledger.filter((e) => e.kind === 'payment').reduce((s, e) => s + e.amount, 0);
  const refunded = ledger.filter((e) => e.kind === 'refund').reduce((s, e) => s + e.amount, 0);
  const available = refundable(order);
  const customAmount = parseAmount(custom);
  const customError =
    mode === 'custom' &&
    custom !== '' &&
    (customAmount === null || customAmount <= 0 || customAmount > available)
      ? t('adminPayments.refund.customError', { amount: format(available) })
      : undefined;
  const amount = mode === 'full' ? available : customError ? null : customAmount;
  // Back the way it was paid: the latest online payment, else cash.
  const online = ledger.findLast((e) => e.kind === 'payment' && e.channel === 'online');
  const ready = amount !== null && amount > 0 && amount <= available;

  const submit = () => {
    if (!ready || amount === null) return;
    refund.mutate(
      {
        branchId: branch.id,
        orderId: order.id,
        body: { amount, reason, ...(note.trim() ? { note: note.trim() } : {}) },
      },
      {
        onSuccess: () => {
          showToast(t('adminPayments.refund.done', { amount: format(amount), order: order.id }), {
            tone: 'success',
          });
          onClose();
        },
        onError: () => showToast(t('adminPayments.failed'), { tone: 'error' }),
      },
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminPayments.refund.title', { order: order.id })}
      description={t('adminPayments.refund.subtitle', {
        name: order.customerName,
        paid: format(paid),
      })}
      className={styles.dialog}
      footer={
        <Button
          block
          iconStart="refresh"
          className={styles.danger}
          loading={refund.isPending}
          disabled={!ready}
          onClick={submit}
        >
          {t('adminPayments.refund.confirm', { amount: format(amount ?? 0) })}
        </Button>
      }
    >
      {available <= 0 ? (
        <p className={styles.note}>{t('adminPayments.refund.nothing')}</p>
      ) : (
        <div className={styles.form}>
          <section className={styles.block}>
            <SumRows
              rows={[
                { label: t('adminPayments.refund.paid'), value: format(paid) },
                ...(refunded > 0
                  ? [
                      {
                        label: t('adminPayments.refund.refunded'),
                        value: format(-refunded),
                        tone: 'muted' as const,
                      },
                    ]
                  : []),
                {
                  label: t('adminPayments.refund.available'),
                  value: format(available),
                  tone: 'total' as const,
                },
              ]}
            />
          </section>

          <section className={styles.block}>
            <RadioTiles<'full' | 'custom'>
              name="refund-amount"
              legend={t('adminPayments.refund.amount')}
              value={mode}
              onChange={setMode}
              columns={2}
              choices={[
                {
                  id: 'full',
                  label: t('adminPayments.refund.amounts.full', { amount: format(available) }),
                },
                { id: 'custom', label: t('adminPayments.refund.amounts.custom') },
              ]}
            />
            {mode === 'custom' && (
              <AmountInput
                id="refund-custom"
                label={t('adminPayments.refund.customAmount')}
                symbol={region.currency.symbol}
                value={custom}
                onChange={setCustom}
                error={customError}
              />
            )}
          </section>

          <section className={styles.block}>
            <RadioTiles<RefundReason>
              name="refund-reason"
              legend={t('adminPayments.refund.reason')}
              value={reason}
              onChange={setReason}
              columns={3}
              choices={REFUND_REASONS.map((r) => ({
                id: r,
                label: t(`adminPayments.entry.reasons.${r}`),
              }))}
            />
            <Textarea
              id="refund-note"
              label={t('adminPayments.refund.note')}
              optional
              placeholder={t('adminPayments.refund.notePlaceholder')}
              maxLength={MAX_REFUND_NOTE}
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </section>

          <p className={styles.where} role="note">
            {online
              ? t('adminPayments.refund.online', { method: methodName(online.method) })
              : t('adminPayments.refund.inPerson', { amount: format(amount ?? 0) })}
          </p>
        </div>
      )}
    </Dialog>
  );
}
