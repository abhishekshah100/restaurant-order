'use client';

import { Fragment, useState } from 'react';
import { useContent } from '@/api/hooks';
import { dueOn } from '@/lib/adminOrders';
import { changeDue } from '@/lib/adminPayments';
import { paidAmount } from '@/lib/lifecycle';
import { orderBill } from '@/lib/orders';
import type { AtTableMethodKey } from '@/types/branch';
import type { Order } from '@/types/order';
import { billRows } from '../../cart/PriceSummary';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { AmountInput, RadioTiles, SumRows, parseAmount } from './PaymentFields';
import { methodIcon, usePaymentText } from './usePaymentText';
import styles from './PaymentDialogs.module.css';

/**
 * What staff choose when they take what's due in person, for one order or a table: how the guest
 * paid (the branch's ways to pay staff) and, for cash, what was handed over and the change.
 */
export function useCollectChoice(orders: readonly Order[]) {
  const { region, money } = useAdminWorkspace();
  const methods = region.payments.atTable;
  const [method, setMethod] = useState<AtTableMethodKey>(methods[0]);
  const [received, setReceived] = useState('');
  const due = orders.reduce((sum, o) => sum + dueOn(o), 0);
  const receivedAmount = method === 'cash' ? parseAmount(received) : null;
  const change = receivedAmount !== null ? changeDue(receivedAmount, due, money.minorUnit) : null;
  const short = receivedAmount !== null && change === null;
  return {
    methods,
    method,
    setMethod,
    received,
    setReceived,
    receivedAmount,
    due,
    change,
    short,
    /** Something to take, and the cash handed over (when typed in) covers it. */
    ready: due > 0 && !short,
  };
}

export type CollectChoice = ReturnType<typeof useCollectChoice>;

/**
 * The one collect form staff see everywhere (an order, the Payments page, a table): the bill with
 * every charge on it (service charge, taxes, round off), what's paid and due, how they paid, and
 * for cash, the amount received and the change to return.
 */
export function CollectFields({
  orders,
  choice,
}: {
  orders: readonly Order[];
  choice: CollectChoice;
}) {
  const t = useContent('common');
  const cart = useContent('cart');
  const { region, money } = useAdminWorkspace();
  const { amount: format, methodName } = usePaymentText();
  const { methods, method, setMethod, received, setReceived, receivedAmount, due } = choice;
  const paidSoFar = orders.reduce((sum, o) => sum + paidAmount(o), 0);
  const several = orders.length > 1;

  // Cash handed over: the exact amount, then round notes above it.
  const quickCash = [
    due,
    ...[100, 500, 1000, 2000]
      .map((note) => Math.ceil(due / note) * note)
      .filter((v, i, all) => v > due && all.indexOf(v) === i),
  ].slice(0, 4);

  return (
    <div className={styles.form}>
      <section className={styles.block} aria-labelledby="collect-bill">
        <h3 id="collect-bill" className={styles.blockTitle}>
          {t('adminPayments.collect.bill')}
        </h3>
        {orders.map((order) => (
          <Fragment key={order.id}>
            {several && (
              <p className={styles.billOrder}>
                {t('adminPayments.collect.orderLine', {
                  order: order.id,
                  name: order.customerName,
                })}
              </p>
            )}
            <SumRows
              rows={[
                ...billRows(orderBill(order, region), { t: cart, money, tax: region.tax }).map(
                  ([label, value]) => ({ label, value }),
                ),
                {
                  label: several
                    ? t('adminPayments.receipt.orderTotal')
                    : t('adminPayments.receipt.total'),
                  value: format(order.total),
                  tone: 'total' as const,
                },
              ]}
            />
          </Fragment>
        ))}
        <SumRows
          rows={[
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

      <section className={styles.block}>
        <RadioTiles<AtTableMethodKey>
          name="collect-method"
          legend={t('adminPayments.collect.method')}
          value={method}
          onChange={setMethod}
          columns={methods.length > 4 ? 3 : (Math.max(2, methods.length) as 2 | 3 | 4)}
          choices={methods.map((m) => ({ id: m, label: methodName(m), icon: methodIcon(m) }))}
        />
      </section>

      {method === 'cash' && (
        <section className={styles.block}>
          <AmountInput
            id="collect-received"
            label={t('adminPayments.collect.cashReceived')}
            symbol={region.currency.symbol}
            value={received}
            onChange={setReceived}
            error={
              choice.short
                ? t('adminPayments.collect.short', { amount: format(due - (receivedAmount ?? 0)) })
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
          {choice.change !== null && (
            <p className={styles.change} role="status">
              <span>{t('adminPayments.collect.change')}</span>
              <strong>{format(choice.change)}</strong>
            </p>
          )}
        </section>
      )}
    </div>
  );
}
