'use client';

import { useState } from 'react';
import type { MoneySummary } from '@/api/contracts';
import { api } from '@/api/endpoints';
import { useContent } from '@/api/hooks';
import { Button } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useAdminToken } from '@/hooks/useAdminSession';
import { cx } from '@/lib/cx';
import { unlinkedRefunds } from '@/lib/salesReport';
import { downloadFile } from '@/lib/saveFile';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './Sales.module.css';

/** One line of a statement: what it is, how much, and how it reads (a step, a sum, the total). */
interface Line {
  key: string;
  label: string;
  amount: number;
  /** Taken off the line above (shown with a minus). */
  minus?: boolean;
  kind?: 'sum' | 'total' | 'sub';
  hint?: string;
}

/**
 * The money summary, as an accountant reads it: from the dishes at menu prices, less discounts,
 * to net sales, then each charge and tax to what was billed; beside it, the money that came in
 * and went back on these days, to what was kept. Every line is a figure from the report, so the
 * two sides tie to the headline numbers. Zero lines that never apply (a delivery fee in a branch
 * without delivery) are left out. Refunds staff gave are shown by dish, with what named no dish
 * on its own line, so they add up to the refunds in the headline. The sales register (every tax
 * invoice and credit note on these days, as a CSV file) is one tap away for the accountant.
 */
export function MoneyStatement({
  money,
  staffRefunds,
  range,
}: {
  money: MoneySummary;
  /** Every refund staff gave on these days (the headline's Refunds). */
  staffRefunds: number;
  range: { from: string; to: string };
}) {
  const t = useContent('common');
  const { money: format, branch } = useAdminWorkspace();
  const token = useAdminToken();
  const { showToast } = useToast();
  const [registerBusy, setRegisterBusy] = useState(false);
  const unlinked = unlinkedRefunds(staffRefunds, money.refundsByDish);

  /** The sales register for these days as a CSV file. */
  const downloadRegister = async () => {
    if (!token || registerBusy) return;
    setRegisterBusy(true);
    try {
      const text = await api.salesRegister(token, branch.id, range);
      downloadFile(
        new Blob([text], { type: 'text/csv' }),
        `sales-register-${branch.id}-${range.from}-${range.to}.csv`,
      );
    } catch {
      showToast(t('adminSales.money.registerFailed'), { tone: 'error' });
    } finally {
      setRegisterBusy(false);
    }
  };
  // An accountant's statement: every line to the paisa, so the lines visibly add up.
  const amount = (value: number) => format.formatMinor(format.toMinor(value));
  const cart = useContent('cart');
  const reason = (key: string) =>
    t(`adminPayments.entry.reasons.${key}` as Parameters<typeof t>[0]) || key;

  const bills: Line[] = [
    { key: 'items', label: t('adminSales.money.itemSales'), amount: money.itemSales },
    { key: 'offers', label: t('adminSales.money.offers'), amount: money.offers, minus: true },
    {
      key: 'promo',
      label: t('adminSales.money.promoCodes'),
      amount: money.promoCodes,
      minus: true,
    },
    {
      key: 'staff',
      label: t('adminSales.money.staffDiscounts'),
      amount: money.staffDiscounts,
      minus: true,
    },
    { key: 'net', label: t('adminSales.money.netSales'), amount: money.netSales, kind: 'sum' },
    ...(money.serviceCharge > 0
      ? [
          {
            key: 'service',
            label: t('adminSales.money.serviceCharge'),
            amount: money.serviceCharge,
          },
        ]
      : []),
    ...money.taxes.map((tax) => ({
      key: `tax-${tax.labelKey}-${tax.rate}`,
      label: cart(`priceSummary.lines.${tax.labelKey}` as Parameters<typeof cart>[0], {
        rate: tax.rate,
      }),
      amount: tax.amount,
    })),
    ...(money.deliveryFees > 0
      ? [{ key: 'fees', label: t('adminSales.money.deliveryFees'), amount: money.deliveryFees }]
      : []),
    ...(money.roundOff !== 0
      ? [{ key: 'round', label: t('adminSales.money.roundOff'), amount: money.roundOff }]
      : []),
    ...(money.other !== 0
      ? [{ key: 'other', label: t('adminSales.money.other'), amount: money.other }]
      : []),
    { key: 'billed', label: t('adminSales.money.billed'), amount: money.billed, kind: 'total' },
  ];

  const moneyIn: Line[] = [
    { key: 'received', label: t('adminSales.money.received'), amount: money.received },
    ...money.refundsByReason.map((r) => ({
      key: `refund-${r.reason}`,
      label: t('adminSales.money.refundFor', { reason: reason(r.reason) }),
      amount: r.amount,
      minus: true,
      kind: 'sub' as const,
      hint: t.plural('adminSales.money.refundCount', r.count),
    })),
    {
      key: 'net',
      label: t('adminSales.money.netReceived'),
      amount: money.netReceived,
      kind: 'total',
    },
  ];

  return (
    <section className={cx(styles.card, styles.full)} aria-labelledby="sales-money">
      <div className={styles.cardHead}>
        <div>
          <h2 id="sales-money" className={styles.cardTitle}>
            {t('adminSales.money.title')}
          </h2>
          <p className={styles.cardHint}>{t('adminSales.money.hint')}</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          iconStart="receipt"
          loading={registerBusy}
          aria-label={t('adminSales.money.registerLabel')}
          onClick={() => void downloadRegister()}
        >
          {t('adminSales.money.register')}
        </Button>
      </div>
      <div className={styles.statements}>
        <Statement title={t('adminSales.money.bills')} lines={bills} amount={amount} />
        <div className={styles.statementSide}>
          <Statement title={t('adminSales.money.moneyIn')} lines={moneyIn} amount={amount} />
          {money.waived > 0 && (
            <p className={styles.statementNote}>
              {t('adminSales.money.waived', { amount: amount(money.waived) })}
            </p>
          )}
          <div className={styles.refundDishes}>
            <h3 className={styles.subTitle}>{t('adminSales.money.refundsByDish')}</h3>
            {money.refundsByDish.length === 0 && unlinked === 0 ? (
              <p className={styles.cardHint}>{t('adminSales.money.noDishRefunds')}</p>
            ) : (
              <ul className={styles.refundList}>
                {money.refundsByDish.map((r) => (
                  <li key={r.name}>
                    <span>
                      {t('adminSales.money.refundLine', { count: r.quantity, name: r.name })}
                    </span>
                    <span className={styles.statementAmount}>{amount(r.amount)}</span>
                  </li>
                ))}
                {unlinked > 0 && (
                  <li className={styles.refundUnlinked}>
                    <span>
                      {t('adminSales.money.unlinked')}
                      <span className={styles.rowHint}>{t('adminSales.money.unlinkedHint')}</span>
                    </span>
                    <span className={styles.statementAmount}>{amount(unlinked)}</span>
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      </div>
      <p className={styles.statementNote}>{t('adminSales.money.note')}</p>
    </section>
  );
}

/** A statement as a table: a caption, then label and amount per line. */
function Statement({
  title,
  lines,
  amount,
}: {
  title: string;
  lines: readonly Line[];
  amount: (value: number) => string;
}) {
  return (
    <table className={styles.statement}>
      <caption className={styles.subTitle}>{title}</caption>
      <tbody>
        {lines.map((line) => (
          <tr
            key={line.key}
            className={cx(
              line.kind === 'sum' && styles.rowSum,
              line.kind === 'total' && styles.rowTotal,
              line.kind === 'sub' && styles.rowSub,
              !line.kind && line.amount === 0 && styles.rowZero,
            )}
          >
            <th scope="row">
              {line.label}
              {line.hint && <span className={styles.rowHint}>{line.hint}</span>}
            </th>
            <td className={styles.statementAmount}>
              {line.minus && line.amount > 0 ? `− ${amount(line.amount)}` : amount(line.amount)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
