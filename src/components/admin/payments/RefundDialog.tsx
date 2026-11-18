'use client';

import { useState } from 'react';
import { cx } from '@/lib/cx';
import { isApiError } from '@/api/client';
import { useContent } from '@/api/hooks';
import { useRefundOrder } from '@/api/mutations';
import { Button, Dialog, QuantityStepper, Textarea } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { MAX_REFUND_NOTE, REFUND_REASONS, ledgerOf, refundable } from '@/lib/adminPayments';
import { refundLineKey, refundNeedsItems, refundableLines, valueOfPicks } from '@/lib/refundItems';
import type { Order, RefundReason } from '@/types/order';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { AmountInput, RadioTiles, SumRows, parseAmount } from './PaymentFields';
import { usePaymentText } from './usePaymentText';
import styles from './PaymentDialogs.module.css';

/**
 * Give money back on an order that stands: why, the dishes it's for (needed for a complaint or a
 * wrong item, so reports can take it off sales by dish), how much — what those dishes came to,
 * everything that can be refunded, or part of it — a note for the day report, and where the
 * money goes: back to the online method through the payment partner, or in cash from the drawer.
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
  /** How many of each line it's for, by round and position. */
  const [counts, setCounts] = useState<Record<string, number>>({});

  const ledger = ledgerOf(order);
  const paid = ledger.filter((e) => e.kind === 'payment').reduce((s, e) => s + e.amount, 0);
  const refunded = ledger.filter((e) => e.kind === 'refund').reduce((s, e) => s + e.amount, 0);
  const available = refundable(order);
  const lines = refundableLines(order);
  const picks = lines.flatMap((line) => {
    const quantity = Math.min(counts[refundLineKey(line)] ?? 0, line.left);
    return quantity > 0 ? [{ round: line.round, position: line.position, quantity }] : [];
  });
  const needsDishes = refundNeedsItems(reason);
  // Naming dishes caps it at what they came to on the bill.
  const cap =
    picks.length > 0
      ? Math.min(available, valueOfPicks(order, picks, region.currency.minorUnit))
      : available;
  const customAmount = parseAmount(custom);
  const customError =
    mode === 'custom' &&
    custom !== '' &&
    (customAmount === null || customAmount <= 0 || customAmount > cap)
      ? t('adminPayments.refund.customError', { amount: format(cap) })
      : undefined;
  const amount = mode === 'full' ? cap : customError ? null : customAmount;
  // Back the way it was paid: the latest online payment, else cash.
  const online = ledger.findLast((e) => e.kind === 'payment' && e.channel === 'online');
  const ready =
    amount !== null && amount > 0 && amount <= cap && (!needsDishes || picks.length > 0);

  const submit = () => {
    if (!ready || amount === null) return;
    refund.mutate(
      {
        branchId: branch.id,
        orderId: order.id,
        body: {
          amount,
          reason,
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(picks.length > 0 ? { items: picks } : {}),
        },
      },
      {
        onSuccess: () => {
          showToast(t('adminPayments.refund.done', { amount: format(amount), order: order.id }), {
            tone: 'success',
          });
          onClose();
        },
        // Cash handed back comes out of the drawer: it must be open.
        onError: (error) =>
          showToast(
            isApiError(error, 'register_closed')
              ? t('adminCash.errors.closed')
              : t('adminPayments.failed'),
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
          </section>

          <fieldset className={cx(styles.block, styles.dishes)}>
            <legend className={styles.blockTitle}>{t('adminPayments.refund.dishes')}</legend>
            <p
              className={cx(
                styles.dishesHint,
                needsDishes && picks.length === 0 && styles.dishesNeeded,
              )}
            >
              {lines.length === 0
                ? t('adminPayments.refund.dishesNone')
                : needsDishes
                  ? t('adminPayments.refund.dishesNeeded')
                  : t('adminPayments.refund.dishesOptional')}
            </p>
            {lines.length > 0 && (
              <ul className={styles.dishList}>
                {lines.map((line) => {
                  const key = refundLineKey(line);
                  const name = line.item.variant
                    ? `${line.item.name} (${line.item.variant})`
                    : line.item.name;
                  return (
                    <li key={key} className={styles.dish}>
                      <span className={styles.dishName}>
                        {name}
                        <span className={styles.dishMeta}>
                          {t('adminPayments.refund.dishLeft', {
                            count: line.left,
                            price: format(line.item.unitPrice),
                          })}
                        </span>
                      </span>
                      <QuantityStepper
                        size="sm"
                        variant="outline"
                        min={0}
                        max={line.left}
                        value={Math.min(counts[key] ?? 0, line.left)}
                        itemName={name}
                        onChange={(next) => setCounts((now) => ({ ...now, [key]: next }))}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </fieldset>

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
                  label:
                    picks.length > 0
                      ? t('adminPayments.refund.amounts.dishes', { amount: format(cap) })
                      : t('adminPayments.refund.amounts.full', { amount: format(available) }),
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
