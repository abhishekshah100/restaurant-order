'use client';

import { Fragment, useState } from 'react';
import { useContent } from '@/api/hooks';
import type { CollectTableRequest } from '@/api/contracts';
import { Icon } from '@/components/ui';
import { dueOn } from '@/lib/adminOrders';
import { WAIVE_REASONS, changeDue } from '@/lib/adminPayments';
import { cx } from '@/lib/cx';
import { paidAmount } from '@/lib/lifecycle';
import { orderBill } from '@/lib/orders';
import type { AtTableMethodKey } from '@/types/branch';
import type { Order, WaiveReason } from '@/types/order';
import { billRows } from '../../cart/PriceSummary';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { AmountInput, RadioTiles, SumRows, parseAmount } from './PaymentFields';
import { methodIcon, usePaymentText } from './usePaymentText';
import styles from './PaymentDialogs.module.css';

/**
 * What staff choose when they take what's due in person, for one order or a table: how the guest
 * paid (the branch's ways to pay staff), any part of the bill left (with why), and for cash, what
 * was handed over and the change.
 */
export function useCollectChoice(orders: readonly Order[]) {
  const { region, money } = useAdminWorkspace();
  const methods = region.payments.atTable;
  // Cash first: most guests at a table pay that way.
  const [method, setMethod] = useState<AtTableMethodKey>(
    methods.includes('cash') ? 'cash' : methods[0],
  );
  const [received, setReceived] = useState('');
  const [leaving, setLeaving] = useState(false);
  const [leave, setLeave] = useState('');
  const [leaveReason, setLeaveReason] = useState<WaiveReason | null>(null);
  const [keepChange, setKeepChange] = useState(false);
  const due = orders.reduce((sum, o) => sum + dueOn(o), 0);

  // Part of the bill left: an amount (none while the field is empty) up to what's due, and why.
  const typed = leaving ? parseAmount(leave) : null;
  const leaveAmount = typed !== null && typed > 0 ? typed : null;
  const leaveTooMuch = leaveAmount !== null && leaveAmount > due;
  const leaveReady = leaveAmount === null || (!leaveTooMuch && leaveReason !== null);
  const left = leaveAmount !== null && !leaveTooMuch ? leaveAmount : 0;
  const toCollect = Math.max(0, due - left);

  const receivedAmount = method === 'cash' ? parseAmount(received) : null;
  const change =
    receivedAmount !== null ? changeDue(receivedAmount, toCollect, money.minorUnit) : null;
  const short = receivedAmount !== null && change === null;
  // Cash handed over falls short: leaving the difference settles it.
  const shortBy = short && receivedAmount !== null ? toCollect - receivedAmount : 0;
  // The guest lets the restaurant keep the change: it's recorded as a tip on the payment.
  const tip = method === 'cash' && keepChange && change !== null && change > 0 ? change : 0;
  // Cash needs what was handed over, unless the whole bill is left.
  const cashReady = method !== 'cash' || toCollect === 0 || (receivedAmount !== null && !short);

  const stopLeaving = () => {
    setLeaving(false);
    setLeave('');
    setLeaveReason(null);
  };

  /**
   * One tap to leave `amount` (with `reason` unless one's chosen): for cash, what's handed over
   * becomes the rest exactly, unless the waiter already typed something else.
   */
  const leaveOf = (amount: number, reason?: WaiveReason) => {
    setLeaving(true);
    setLeave(String(amount));
    if (reason && leaveReason === null) setLeaveReason(reason);
    if (method === 'cash' && (receivedAmount === null || receivedAmount === toCollect)) {
      setReceived(String(Math.ceil(Math.max(0, due - amount))));
    }
  };

  return {
    methods,
    method,
    setMethod,
    received,
    setReceived,
    receivedAmount,
    leaving,
    startLeaving: () => setLeaving(true),
    stopLeaving,
    leaveOf,
    leave,
    setLeave,
    leaveReason,
    setLeaveReason,
    leaveAmount,
    leaveTooMuch,
    due,
    /** What's taken: what's due less anything left. */
    toCollect,
    left,
    change,
    short,
    shortBy,
    keepChange,
    setKeepChange,
    tip,
    /** The guest handed over less than the bill: leave the rest of it, as no change. */
    leaveShort: () => {
      if (receivedAmount !== null) leaveOf(due - receivedAmount, 'noChange');
    },
    /** Something to take, any part left has a reason, and cash handed over covers the rest. */
    ready: due > 0 && leaveReady && cashReady,
    /** The request for POST …/payment (an order's or a table's). */
    body: {
      method,
      ...(left > 0 && leaveReason ? { waive: { amount: left, reason: leaveReason } } : {}),
      ...(tip > 0 ? { tip } : {}),
    } satisfies CollectTableRequest,
  };
}

export type CollectChoice = ReturnType<typeof useCollectChoice>;

/**
 * The one collect form staff see everywhere (an order, the Payments page, a table), built to fit
 * a phone without scrolling: what to collect up top (the bill's breakdown a tap away), how they
 * paid, for cash the amount handed over with the change, and part of the bill to leave — one tap
 * when the guest hands over less, or a round amount to take instead.
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
  const [showBill, setShowBill] = useState(false);
  const { methods, method, setMethod, received, setReceived, receivedAmount, due, toCollect } =
    choice;
  const paidSoFar = orders.reduce((sum, o) => sum + paidAmount(o), 0);
  const billTotal = orders.reduce((sum, o) => sum + o.total, 0);
  const several = orders.length > 1;

  // Cash handed over: the exact amount, then round notes above it.
  const exact = Math.ceil(toCollect);
  const quickCash = [
    exact,
    ...[100, 500, 1000, 2000]
      .map((note) => Math.ceil(toCollect / note) * note)
      .filter((v, i, all) => v > exact && all.indexOf(v) === i),
  ].slice(0, 4);

  // Round amounts to take instead (₹471 → ₹470, ₹450, ₹400), each leaving the rest.
  const roundTakes = [10, 50, 100]
    .map((unit) => Math.floor(due / unit) * unit)
    .filter((take, i, all) => take > 0 && take < due && all.indexOf(take) === i)
    .slice(0, 3);

  const summary = [
    t('adminPayments.collect.summary.bill', { amount: format(billTotal) }),
    paidSoFar > 0 && t('adminPayments.collect.summary.paid', { amount: format(paidSoFar) }),
    choice.left > 0 && t('adminPayments.collect.summary.left', { amount: format(choice.left) }),
  ].filter(Boolean);

  return (
    <div className={styles.form}>
      <section className={styles.hero} aria-labelledby="collect-amount">
        <div className={styles.heroTop}>
          <p id="collect-amount" className={styles.heroLabel}>
            {t('adminPayments.collect.toCollect')}
          </p>
          <button
            type="button"
            className={styles.billToggle}
            aria-expanded={showBill}
            aria-controls="collect-bill"
            onClick={() => setShowBill((open) => !open)}
          >
            <Icon name="receipt" size="xs" />
            {showBill ? t('adminPayments.collect.hideBill') : t('adminPayments.collect.viewBill')}
            <Icon name="chevd" size="xs" className={cx(styles.billChev, showBill && styles.open)} />
          </button>
        </div>
        <p className={styles.heroAmount} aria-live="polite">
          {format(toCollect)}
        </p>
        <p className={styles.heroMeta}>{summary.join(' · ')}</p>

        {showBill && (
          <div id="collect-bill" className={styles.bill}>
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
            {(paidSoFar > 0 || choice.left > 0) && (
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
                  ...(choice.left > 0
                    ? [
                        {
                          label: t('adminPayments.collect.leftRow'),
                          value: format(-choice.left),
                          tone: 'muted' as const,
                        },
                      ]
                    : []),
                  {
                    label: t('adminPayments.collect.toCollect'),
                    value: format(toCollect),
                    tone: 'total' as const,
                  },
                ]}
              />
            )}
          </div>
        )}
      </section>

      <RadioTiles<AtTableMethodKey>
        name="collect-method"
        legend={t('adminPayments.collect.method')}
        value={method}
        onChange={setMethod}
        compact
        columns={methods.length >= 4 ? 4 : (Math.max(2, methods.length) as 2 | 3)}
        choices={methods.map((m) => ({ id: m, label: methodName(m), icon: methodIcon(m) }))}
      />

      {method === 'cash' && toCollect > 0 && (
        <section className={styles.block}>
          <AmountInput
            id="collect-received"
            label={t('adminPayments.collect.cashReceived')}
            symbol={region.currency.symbol}
            value={received}
            onChange={setReceived}
            hint={receivedAmount === null ? t('adminPayments.collect.cashHint') : undefined}
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
          {choice.short && (
            // Handed over less than the bill: one tap leaves the rest, as no change.
            <div className={styles.shortPanel} role="status">
              <span>{t('adminPayments.collect.short', { amount: format(choice.shortBy) })}</span>
              <button type="button" className={styles.shortLeave} onClick={choice.leaveShort}>
                {t('adminPayments.collect.leaveShort', { amount: format(choice.shortBy) })}
              </button>
            </div>
          )}
          {choice.change !== null &&
            choice.change > 0 &&
            (choice.tip > 0 ? (
              // The guest let the restaurant keep the change: a tip on the payment.
              <div className={cx(styles.change, styles.kept)} role="status">
                <span>{t('adminPayments.collect.tipKept', { amount: format(choice.tip) })}</span>
                <button
                  type="button"
                  className={styles.changeLink}
                  onClick={() => choice.setKeepChange(false)}
                >
                  {t('adminPayments.collect.giveChange')}
                </button>
              </div>
            ) : (
              <div className={styles.change} role="status">
                <span className={styles.changeAmount}>
                  {t('adminPayments.collect.change')}
                  <strong>{format(choice.change)}</strong>
                </span>
                <button
                  type="button"
                  className={styles.keepTip}
                  onClick={() => choice.setKeepChange(true)}
                >
                  {t('adminPayments.collect.keepTip', { amount: format(choice.change) })}
                </button>
              </div>
            ))}
        </section>
      )}

      {choice.leaving ? (
        <section className={styles.leaveCard} aria-labelledby="collect-leave-title">
          <div className={styles.leaveHead}>
            <h3 id="collect-leave-title" className={styles.leaveTitle}>
              {t('adminPayments.collect.leave')}
            </h3>
            <button type="button" className={styles.leaveCancel} onClick={choice.stopLeaving}>
              {t('adminPayments.collect.leaveCancel')}
            </button>
          </div>
          {roundTakes.length > 0 && (
            <div
              className={styles.takes}
              role="group"
              aria-label={t('adminPayments.collect.takeInstead')}
            >
              {roundTakes.map((take) => (
                <button
                  key={take}
                  type="button"
                  className={styles.take}
                  aria-pressed={choice.leaveAmount === due - take}
                  onClick={() => choice.leaveOf(due - take, 'noChange')}
                >
                  <strong>{t('adminPayments.collect.take', { amount: format(take) })}</strong>
                  <span>
                    {t('adminPayments.collect.summary.left', { amount: format(due - take) })}
                  </span>
                </button>
              ))}
            </div>
          )}
          <AmountInput
            id="collect-leave"
            label={t('adminPayments.collect.leaveAmount')}
            symbol={region.currency.symbol}
            value={choice.leave}
            onChange={choice.setLeave}
            compact
            error={
              choice.leaveTooMuch
                ? t('adminPayments.collect.leaveTooMuch', { amount: format(due) })
                : undefined
            }
            hint={
              toCollect === 0 && choice.left > 0 ? t('adminPayments.collect.leaveAll') : undefined
            }
          />
          <div className={styles.reasons} role="radiogroup" aria-labelledby="collect-leave-why">
            <p id="collect-leave-why" className={styles.reasonsLabel}>
              {t('adminPayments.collect.leaveReason')}
              {choice.leaveAmount !== null && choice.leaveReason === null && (
                <span className={styles.reasonsHint}>
                  {t('adminPayments.collect.leaveReasonHint')}
                </span>
              )}
            </p>
            <div className={styles.quick}>
              {WAIVE_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={choice.leaveReason === r}
                  className={styles.quickButton}
                  onClick={() => choice.setLeaveReason(r)}
                >
                  {t(`adminPayments.entry.waiveReasons.${r}`)}
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <button type="button" className={styles.leaveOpen} onClick={choice.startLeaving}>
          <Icon name="minus" size="xs" />
          {t('adminPayments.collect.leave')}
        </button>
      )}
    </div>
  );
}
