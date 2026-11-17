'use client';

import { useState } from 'react';
import type { DiscountRequest } from '@/api/contracts';
import { isBackendEnabled } from '@/api/backend';
import { ApiError, isApiError } from '@/api/client';
import { useContent } from '@/api/hooks';
import { useGiveDiscount, useRemoveDiscount } from '@/api/mutations';
import { Button, Icon } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { cx } from '@/lib/cx';
import type { Order } from '@/types/order';
import type { ManualDiscountReason, OrderDiscount } from '@/types/promotion';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { usePaymentText } from './usePaymentText';
import dialog from './PaymentDialogs.module.css';
import styles from './CollectExtras.module.css';

type Manual = Extract<OrderDiscount, { kind: 'manual' }>;

const REASONS: readonly ManualDiscountReason[] = [
  'regular',
  'complaint',
  'staffMeal',
  'manager',
  'other',
];

/** What can be typed for a value: digits and one point, two decimals at most. */
const decimalOnly = (text: string) => {
  const [whole = '', ...rest] = text.replace(/[^\d.]/g, '').split('.');
  return rest.length > 0 ? `${whole}.${rest.join('').slice(0, 2)}` : whole;
};

/** Percentages a tap away. */
const QUICK_PERCENTS = [5, 10, 15, 20] as const;

/**
 * Discounts staff give by hand on an order being paid (`discounts.give`): those on it, each
 * taken off with a tap, and a folded form for another, laid out like the dialog's "leave part
 * of the bill": off the whole bill or one item, a percentage or an amount (quick picks for the
 * usual percentages), and why. The server holds staff to their limit and prices the bill again
 * (the server's only: the mock has none).
 */
export function DiscountPanel({ orders }: { orders: Order[] }) {
  const { can } = useAdminWorkspace();
  const [chosen, setChosen] = useState<string | null>(null);
  if (!isBackendEnabled() || orders.length === 0 || !can('discounts.give')) return null;
  // A table's bill: one order at a time (a discount belongs to an order's bill).
  const order = orders.find((o) => o.id === chosen) ?? orders[0];
  return (
    <Panel
      key={order.id}
      order={order}
      orders={orders}
      onPick={orders.length > 1 ? setChosen : undefined}
    />
  );
}

function Panel({
  order,
  orders,
  onPick,
}: {
  order: Order;
  orders: Order[];
  /** Several orders at the table: which one the discount is for. */
  onPick?: (id: string) => void;
}) {
  const t = useContent('common');
  const cart = useContent('cart');
  const { branch, region } = useAdminWorkspace();
  const { amount: format } = usePaymentText();
  const { showToast } = useToast();
  const give = useGiveDiscount();
  const remove = useRemoveDiscount();
  const [open, setOpen] = useState(false);
  const [onItem, setOnItem] = useState(false);
  const [itemKey, setItemKey] = useState('');
  const [kind, setKind] = useState<'percent' | 'amount'>('percent');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState<ManualDiscountReason>('regular');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);

  // Every order's (a table's bill: each says which order it's on).
  const given = orders.flatMap((o) =>
    (o.discounts ?? [])
      .filter((d): d is Manual => d.kind === 'manual')
      .map((d) => ({ ...d, orderId: o.id })),
  );
  // Each item still on the bill, by its round and line ("2:0").
  const items = (order.rounds ?? [])
    .filter((r) => r.status !== 'cancelled')
    .flatMap((r) =>
      r.items.flatMap((item, position) =>
        item.quantity > 0
          ? [{ key: `${r.number}:${position}`, round: r.number, position, item }]
          : [],
      ),
    );
  const item = onItem ? (items.find((i) => i.key === itemKey) ?? items[0]) : undefined;
  const number = Number(value);
  const valueError =
    !value || !Number.isFinite(number) || number <= 0 || (kind === 'percent' && number > 100)
      ? t('adminPayments.discount.errors.value')
      : undefined;

  const close = () => {
    setOpen(false);
    setValue('');
    setNote('');
    setTried(false);
  };

  const failed = (error: unknown) => {
    const limit =
      error instanceof ApiError
        ? ((error.body as { limit?: number } | undefined)?.limit ?? undefined)
        : undefined;
    showToast(
      isApiError(error, 'discount_limit')
        ? t('adminPayments.discount.errors.limit', { limit: limit ?? 0 })
        : isApiError(error, 'bill_paid')
          ? t('adminPayments.discount.errors.paid')
          : isApiError(error, 'invalid_request')
            ? t('adminPayments.discount.errors.nothing')
            : t('adminPayments.discount.errors.failed'),
      { tone: 'error' },
    );
  };

  const submit = () => {
    setTried(true);
    if (valueError) return;
    const body: DiscountRequest = {
      scope: item ? 'item' : 'bill',
      ...(item ? { round: item.round, position: item.position } : {}),
      ...(kind === 'percent' ? { percent: number } : { amount: number }),
      reason,
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    give.mutateAsync({ branchId: branch.id, orderId: order.id, body }).then(() => {
      showToast(t('adminPayments.discount.given'), { tone: 'success' });
      close();
    }, failed);
  };

  const reasonWords = (d: Manual) =>
    cart('priceSummary.manual', { reason: cart(`priceSummary.manualReasons.${d.reason}`) });

  return (
    <div className={styles.panel}>
      {given.length > 0 && (
        <ul className={styles.given} aria-label={t('adminPayments.discount.title')}>
          {given.map((d) => (
            <li key={d.id} className={styles.givenRow}>
              <Icon name="tag" size="xs" className={styles.givenIcon} />
              <span className={styles.givenText}>
                <span className={styles.givenLabel}>
                  {reasonWords(d)}
                  {d.percent !== undefined && ` · ${d.percent}%`}
                </span>
                <span className={styles.givenMeta}>
                  {[orders.length > 1 && `#${d.orderId}`, d.item?.name, d.by]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <span className={styles.givenAmount}>{format(-d.amount)}</span>
              <button
                type="button"
                className={styles.takeOff}
                disabled={remove.isPending}
                onClick={() =>
                  remove
                    .mutateAsync({ branchId: branch.id, orderId: d.orderId, discountId: d.id })
                    .then(
                      () => showToast(t('adminPayments.discount.removed'), { tone: 'success' }),
                      failed,
                    )
                }
              >
                {t('adminPayments.discount.remove')}
              </button>
            </li>
          ))}
        </ul>
      )}

      {!open ? (
        <button type="button" className={dialog.leaveOpen} onClick={() => setOpen(true)}>
          <Icon name="tag" size="xs" />
          {t('adminPayments.discount.give')}
        </button>
      ) : (
        <section className={dialog.leaveCard} aria-labelledby="discount-title">
          <div className={dialog.leaveHead}>
            <h3 id="discount-title" className={dialog.leaveTitle}>
              {t('adminPayments.discount.give')}
            </h3>
            <button type="button" className={dialog.leaveCancel} onClick={close}>
              {t('adminPayments.discount.cancel')}
            </button>
          </div>

          {onPick && (
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t('adminPayments.discount.forOrder')}</span>
              <select
                className={styles.itemPicker}
                value={order.id}
                onChange={(event) => onPick(event.target.value)}
              >
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {t('adminPayments.discount.orderOption', {
                      order: o.id,
                      name: o.customerName,
                      total: format(o.total),
                    })}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className={styles.row} role="radiogroup" aria-labelledby="discount-on">
            <p id="discount-on" className={styles.label}>
              {t('adminPayments.discount.on')}
            </p>
            <div className={dialog.quick}>
              <button
                type="button"
                role="radio"
                aria-checked={!onItem}
                className={dialog.quickButton}
                onClick={() => setOnItem(false)}
              >
                {t('adminPayments.discount.wholeBill')}
              </button>
              {items.length > 0 && (
                <button
                  type="button"
                  role="radio"
                  aria-checked={onItem}
                  className={dialog.quickButton}
                  onClick={() => setOnItem(true)}
                >
                  {t('adminPayments.discount.oneItem')}
                </button>
              )}
            </div>
            {onItem && (
              <select
                className={styles.itemPicker}
                aria-label={t('adminPayments.discount.oneItem')}
                value={item?.key ?? ''}
                onChange={(event) => setItemKey(event.target.value)}
              >
                {items.map((i) => (
                  <option key={i.key} value={i.key}>
                    {t('adminPayments.discount.item', { name: i.item.name, round: i.round })}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className={styles.row}>
            <div className={styles.valueRow}>
              <div
                className={styles.unit}
                role="radiogroup"
                aria-label={t('adminPayments.discount.kind')}
              >
                {(['percent', 'amount'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={kind === k}
                    aria-label={t(`adminPayments.discount.${k}`)}
                    className={styles.unitButton}
                    onClick={() => setKind(k)}
                  >
                    {k === 'percent' ? '%' : region.currency.symbol}
                  </button>
                ))}
              </div>
              {/* Decimals allowed: 12.5%, ₹49.50. */}
              <label className={styles.field}>
                <span className={styles.fieldLabel}>{t('adminPayments.discount.value')}</span>
                <span className={cx(styles.valueBox, tried && valueError && styles.invalidInput)}>
                  <span className={styles.valueSymbol} aria-hidden="true">
                    {kind === 'percent' ? '%' : region.currency.symbol}
                  </span>
                  <input
                    id="discount-value"
                    className={styles.valueInput}
                    inputMode="decimal"
                    autoComplete="off"
                    maxLength={9}
                    value={value}
                    aria-invalid={tried && valueError ? true : undefined}
                    onChange={(event) => setValue(decimalOnly(event.target.value))}
                  />
                </span>
                {tried && valueError && <span className={styles.fieldError}>{valueError}</span>}
              </label>
            </div>
            {kind === 'percent' && (
              <div className={dialog.quick}>
                {QUICK_PERCENTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={value === String(p)}
                    className={dialog.quickButton}
                    onClick={() => setValue(String(p))}
                  >
                    {p}%
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={styles.row} role="radiogroup" aria-labelledby="discount-why">
            <p id="discount-why" className={styles.label}>
              {t('adminPayments.discount.reason')}
            </p>
            <div className={dialog.quick}>
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={reason === r}
                  className={dialog.quickButton}
                  onClick={() => setReason(r)}
                >
                  {t(`adminPayments.discount.reasons.${r}`)}
                </button>
              ))}
            </div>
          </div>

          <input
            className={styles.noteInput}
            aria-label={t('adminPayments.discount.note')}
            placeholder={t('adminPayments.discount.notePlaceholder')}
            maxLength={200}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <p className={styles.hint}>{t('adminPayments.discount.hint')}</p>

          <Button block iconStart="tag" loading={give.isPending} onClick={submit}>
            {t('adminPayments.discount.confirm')}
          </Button>
        </section>
      )}
    </div>
  );
}
