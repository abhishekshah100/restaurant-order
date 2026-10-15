'use client';

import { useState } from 'react';
import { useContent } from '@/api/hooks';
import { useCollectPayment, useCollectTablePayment } from '@/api/mutations';
import { Button, Dialog, QuantityStepper } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { dueOn } from '@/lib/adminOrders';
import { TIP_PERCENTS, changeDue, splitShares, tipFor } from '@/lib/adminPayments';
import { paidAmount } from '@/lib/lifecycle';
import type { AtTableMethodKey } from '@/types/branch';
import type { Order } from '@/types/order';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { AmountInput, RadioTiles, SumRows, parseAmount } from './PaymentFields';
import { methodIcon, usePaymentText } from './usePaymentText';
import styles from './PaymentDialogs.module.css';

/** What's being paid: one order, or everything due at a table. */
export type CollectTarget =
  { kind: 'order'; order: Order } | { kind: 'table'; table: number; orders: Order[] };

type AmountMode = 'full' | 'split' | 'custom';
type TipChoice = `${(typeof TIP_PERCENTS)[number]}` | 'custom';

/** The most people a bill is split between here. */
const MAX_WAYS = 20;

/**
 * Collect payment in person, for one order or a whole table: the bill and what's due; for an
 * order, the full bill, an even split (one share at a time: the dialog stays open on the rest)
 * or another amount; how it was paid (the branch's ways to pay staff); a tip; and for cash, what
 * was handed over and the change to give.
 */
export function CollectDialog({
  target,
  onClose,
  onPrint,
}: {
  target: CollectTarget | null;
  onClose: () => void;
  onPrint: (target: CollectTarget) => void;
}) {
  if (!target) return null;
  const key = target.kind === 'order' ? target.order.id : `table-${target.table}`;
  return <CollectForm key={key} target={target} onClose={onClose} onPrint={onPrint} />;
}

function CollectForm({
  target,
  onClose,
  onPrint,
}: {
  target: CollectTarget;
  onClose: () => void;
  onPrint: (target: CollectTarget) => void;
}) {
  const t = useContent('common');
  const { branch, region, money, clock } = useAdminWorkspace();
  const { amount: format, methodName } = usePaymentText();
  const { showToast } = useToast();
  const collect = useCollectPayment();
  const collectTable = useCollectTablePayment();
  const methods = region.payments.atTable;
  const { minorUnit } = money;

  const [mode, setMode] = useState<AmountMode>('full');
  const [ways, setWays] = useState(2);
  const [custom, setCustom] = useState('');
  const [method, setMethod] = useState<AtTableMethodKey>(methods[0]);
  const [tipChoice, setTipChoice] = useState<TipChoice>('0');
  const [tipText, setTipText] = useState('');
  const [received, setReceived] = useState('');

  const orders = target.kind === 'order' ? [target.order] : target.orders;
  const due = orders.reduce((sum, o) => sum + dueOn(o), 0);
  const paidSoFar = orders.reduce((sum, o) => sum + paidAmount(o), 0);

  // How much is taken now.
  const customAmount = parseAmount(custom);
  const customError =
    mode === 'custom' &&
    custom !== '' &&
    (customAmount === null || customAmount <= 0 || customAmount > due)
      ? t('adminPayments.collect.customError', { amount: format(due) })
      : undefined;
  const shares = splitShares(due, ways, minorUnit);
  const amount =
    mode === 'split' ? shares[0] : mode === 'custom' ? (customError ? null : customAmount) : due;

  // The tip on top.
  const tipAmount =
    amount === null
      ? 0
      : tipChoice === 'custom'
        ? (parseAmount(tipText) ?? 0)
        : tipFor(amount, Number(tipChoice), minorUnit);
  const owed = (amount ?? 0) + tipAmount;

  // Cash: what was handed over, and the change.
  const cash = method === 'cash';
  const receivedAmount = parseAmount(received);
  const change =
    cash && receivedAmount !== null ? changeDue(receivedAmount, owed, minorUnit) : null;
  const short = cash && receivedAmount !== null && change === null;

  const busy = collect.isPending || collectTable.isPending;
  const ready = amount !== null && amount > 0 && !short;
  const failed = () => showToast(t('adminPayments.failed'), { tone: 'error' });

  // The promise form: once nothing is due the page refreshes and closes this dialog, perhaps
  // before the answer is handled, and a mutate() callback would then never run.
  const submit = () => {
    if (!ready || amount === null) return;
    const tip = tipAmount > 0 ? tipAmount : undefined;
    if (target.kind === 'table') {
      collectTable
        .mutateAsync({ branchId: branch.id, table: target.table, body: { method, tip } })
        .then(() => {
          showToast(
            t('adminPayments.collect.doneTable', { table: target.table, amount: format(due) }),
            { tone: 'success' },
          );
          onClose();
        }, failed);
      return;
    }
    collect
      .mutateAsync({
        branchId: branch.id,
        orderId: target.order.id,
        body: { method, tip, ...(mode === 'full' ? {} : { amount }) },
      })
      .then((order) => {
        const left = dueOn(order);
        if (left === 0) {
          showToast(
            t('adminPayments.collect.doneOrder', { amount: format(amount), order: order.id }),
            { tone: 'success' },
          );
          onClose();
          return;
        }
        // A share of a split bill: stay open on the rest, one person fewer.
        showToast(
          t('adminPayments.collect.doneShare', { amount: format(amount), left: format(left) }),
          { tone: 'success' },
        );
        if (mode === 'split') {
          if (ways - 1 <= 1) setMode('full');
          else setWays(ways - 1);
        } else {
          setCustom('');
        }
        setReceived('');
        setTipChoice('0');
        setTipText('');
      }, failed);
  };

  const title =
    target.kind === 'order'
      ? t('adminPayments.collect.titleOrder')
      : t('adminPayments.collect.titleTable', { table: target.table });
  const description =
    target.kind === 'order'
      ? t('adminPayments.collect.subtitleOrder', {
          order: target.order.id,
          name: target.order.customerName,
        })
      : t.plural('adminPayments.collect.subtitleTable', target.orders.length);

  // Cash handed over: the exact amount, then round notes above it.
  const quickCash = [
    owed,
    ...[100, 500, 1000, 2000]
      .map((note) => Math.ceil(owed / note) * note)
      .filter((v, i, all) => v > owed && all.indexOf(v) === i),
  ].slice(0, 4);

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={title}
      description={description}
      className={styles.dialog}
      footer={
        <div className={styles.footer}>
          <Button
            variant="secondary"
            iconStart="receipt"
            onClick={() => onPrint(target)}
            className={styles.footerSecondary}
          >
            {t('adminPayments.due.printBill')}
          </Button>
          <Button block iconStart="check" loading={busy} disabled={!ready} onClick={submit}>
            {tipAmount > 0
              ? t('adminPayments.collect.confirmTip', {
                  amount: format(amount ?? 0),
                  tip: format(tipAmount),
                })
              : t('adminPayments.collect.confirm', { amount: format(amount ?? 0) })}
          </Button>
        </div>
      }
    >
      <div className={styles.form}>
        <section className={styles.block} aria-labelledby="collect-bill">
          <h3 id="collect-bill" className={styles.blockTitle}>
            {t('adminPayments.collect.bill')}
          </h3>
          <SumRows
            rows={[
              ...orders.map((o) => ({
                label: `${t('adminPayments.collect.orderLine', { order: o.id, name: o.customerName })} · ${clock.time(o.placedAt)}`,
                value: format(o.total),
              })),
              ...(paidSoFar > 0
                ? [
                    {
                      label: t('adminPayments.collect.paidSoFar'),
                      value: format(-paidSoFar),
                      tone: 'ok' as const,
                    },
                  ]
                : []),
              { label: t('adminPayments.collect.due'), value: format(due), tone: 'due' as const },
            ]}
          />
        </section>

        {target.kind === 'order' ? (
          <section className={styles.block}>
            <RadioTiles<AmountMode>
              name="collect-amount"
              legend={t('adminPayments.collect.amount')}
              value={mode}
              onChange={setMode}
              choices={[
                { id: 'full', label: t('adminPayments.collect.amounts.full'), icon: 'receipt' },
                { id: 'split', label: t('adminPayments.collect.amounts.split'), icon: 'user' },
                { id: 'custom', label: t('adminPayments.collect.amounts.custom'), icon: 'pencil' },
              ]}
            />
            {mode === 'split' && (
              <div className={styles.split}>
                <span className={styles.splitLabel} id="collect-ways">
                  {t('adminPayments.collect.people')}
                </span>
                <QuantityStepper
                  value={ways}
                  min={2}
                  max={MAX_WAYS}
                  onChange={setWays}
                  size="sm"
                  itemName={t('adminPayments.collect.people')}
                />
                <p className={styles.splitShare}>
                  {t('adminPayments.collect.share', { amount: format(shares[0]) })}
                </p>
                <p className={styles.splitNote}>
                  {t('adminPayments.collect.shareOf', {
                    amount: format(shares[0]),
                    left: format(due - shares[0]),
                  })}
                </p>
              </div>
            )}
            {mode === 'custom' && (
              <AmountInput
                id="collect-custom"
                label={t('adminPayments.collect.customAmount')}
                symbol={region.currency.symbol}
                value={custom}
                onChange={setCustom}
                hint={t('adminPayments.collect.customHint', { amount: format(due) })}
                error={customError}
              />
            )}
          </section>
        ) : (
          orders.length > 1 && <p className={styles.note}>{t('adminPayments.collect.tableNote')}</p>
        )}

        <section className={styles.block}>
          <RadioTiles<AtTableMethodKey>
            name="collect-method"
            legend={t('adminPayments.collect.method')}
            value={method}
            onChange={setMethod}
            columns={methods.length > 4 ? 3 : (methods.length as 2 | 3 | 4)}
            choices={methods.map((m) => ({ id: m, label: methodName(m), icon: methodIcon(m) }))}
          />
        </section>

        <section className={styles.block}>
          <RadioTiles<TipChoice>
            name="collect-tip"
            legend={t('adminPayments.collect.tip')}
            value={tipChoice}
            onChange={setTipChoice}
            columns={4}
            choices={[
              ...TIP_PERCENTS.map((p) => ({
                id: `${p}` as TipChoice,
                label:
                  p === 0
                    ? t('adminPayments.collect.tipNone')
                    : t('adminPayments.collect.tipPercent', { percent: p }),
                sub: p > 0 && amount ? format(tipFor(amount, p, minorUnit)) : undefined,
              })),
              { id: 'custom' as const, label: t('adminPayments.collect.tipCustom') },
            ]}
          />
          {tipChoice === 'custom' && (
            <AmountInput
              id="collect-tip-amount"
              label={t('adminPayments.collect.tipAmount')}
              symbol={region.currency.symbol}
              value={tipText}
              onChange={setTipText}
            />
          )}
        </section>

        {cash && (
          <section className={styles.block}>
            <AmountInput
              id="collect-received"
              label={t('adminPayments.collect.cashReceived')}
              symbol={region.currency.symbol}
              value={received}
              onChange={setReceived}
              error={
                short
                  ? t('adminPayments.collect.short', {
                      amount: format(owed - (receivedAmount ?? 0)),
                    })
                  : undefined
              }
            />
            <div
              className={styles.quick}
              role="group"
              aria-label={t('adminPayments.collect.cashReceived')}
            >
              {quickCash.map((value, index) => (
                <button
                  key={value}
                  type="button"
                  className={styles.quickButton}
                  aria-pressed={receivedAmount === value}
                  onClick={() => setReceived(String(value))}
                >
                  {index === 0 ? t('adminPayments.collect.exact') : format(value)}
                </button>
              ))}
            </div>
            {change !== null && (
              <p className={styles.change} role="status">
                <span>{t('adminPayments.collect.change')}</span>
                <strong>{format(change)}</strong>
              </p>
            )}
          </section>
        )}
      </div>
    </Dialog>
  );
}
