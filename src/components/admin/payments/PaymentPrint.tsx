'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useContent } from '@/api/hooks';
import { useAdminName } from '@/hooks/useAdminSession';
import { dueOn } from '@/lib/adminOrders';
import { daySummary, ledgerEntries, ledgerOf, type DueGroup } from '@/lib/adminPayments';
import { paidAmount } from '@/lib/lifecycle';
import type { Order } from '@/types/order';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { usePaymentText } from './usePaymentText';
import styles from './PaymentPrint.module.css';

/** Set on <html> while a bill or the day report prints: everything else on the page is hidden. */
const PRINTING = 'printing-payments';

type Printable =
  | { kind: 'bill'; orders: Order[] }
  | { kind: 'report'; orders: Order[]; due: DueGroup[]; period: string };

/**
 * Printing from the Payments page: `bill(orders)` prints the bill for an order or a table (a
 * receipt once it's paid: what was paid, how and when); `report(orders, due, period)` prints the
 * day report for the days written in `period` (the day's money, by method, every payment and refund, what's still to collect). The
 * page is put in the document, the browser's print dialog opens, and it's taken away after.
 */
export function usePaymentPrint() {
  const [doc, setDoc] = useState<Printable | null>(null);

  useEffect(() => {
    if (!doc) return;
    const root = document.documentElement;
    const done = () => {
      root.classList.remove(PRINTING);
      setDoc(null);
    };
    root.classList.add(PRINTING);
    window.addEventListener('afterprint', done, { once: true });
    const id = window.setTimeout(() => window.print(), 50);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('afterprint', done);
      root.classList.remove(PRINTING);
    };
  }, [doc]);

  const sheet =
    doc &&
    createPortal(
      <div className={styles.sheet} data-print-sheet="">
        {doc.kind === 'bill' ? (
          <BillDoc orders={doc.orders} />
        ) : (
          <ReportDoc orders={doc.orders} due={doc.due} period={doc.period} />
        )}
      </div>,
      document.body,
    );

  return {
    bill: (orders: Order[]) => setDoc({ kind: 'bill', orders }),
    report: (orders: Order[], due: DueGroup[], period: string) =>
      setDoc({ kind: 'report', orders, due, period }),
    sheet,
  };
}

function PrintHead({ title }: { title: string }) {
  const t = useContent('common');
  const { branch, region } = useAdminWorkspace();
  return (
    <header className={styles.head}>
      <p className={styles.brand}>{t('meta.applicationName')}</p>
      <p className={styles.branch}>{branch.shortName}</p>
      {region.address && <p className={styles.muted}>{region.address}</p>}
      <h1 className={styles.title}>{title}</h1>
    </header>
  );
}

/** A bill for one order or a table: items, totals, what was paid and what's due. */
function BillDoc({ orders }: { orders: Order[] }) {
  const t = useContent('common');
  const { clock } = useAdminWorkspace();
  const { amount, methodName, where } = usePaymentText();
  const due = orders.reduce((s, o) => s + dueOn(o), 0);
  const total = orders.reduce((s, o) => s + o.total, 0);
  const payments = orders.flatMap((o) => ledgerOf(o).map((e) => ({ ...e, order: o })));
  const paid = orders.reduce((s, o) => s + paidAmount(o), 0);
  const refunded = payments.filter((e) => e.kind === 'refund').reduce((s, e) => s + e.amount, 0);
  const now = new Date();

  return (
    <article className={styles.bill}>
      <PrintHead
        title={due > 0 ? t('adminPayments.receipt.title') : t('adminPayments.receipt.receiptTitle')}
      />
      <p className={styles.muted}>{clock.date(now)}</p>
      {orders.map((order) => {
        const discount = (order.discounts ?? []).reduce((s, d) => s + d.amount, 0);
        return (
          <section key={order.id} className={styles.order}>
            <p className={styles.orderHead}>
              <strong>{t('adminPayments.receipt.order', { order: order.id })}</strong>
              <span>
                {where(order)} · {clock.time(order.placedAt)}
              </span>
            </p>
            <p className={styles.muted}>
              {t('adminPayments.receipt.guest', { name: order.customerName })}
            </p>
            <table className={styles.items}>
              <tbody>
                {order.items.map((item, index) => (
                  <tr key={`${item.dishSlug}-${index}`}>
                    <td className={styles.qty}>{item.quantity}×</td>
                    <td>
                      {item.name}
                      {item.variant && <span className={styles.muted}> · {item.variant}</span>}
                    </td>
                    <td className={styles.num}>{amount(item.unitPrice * item.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className={styles.sums}>
              <div>
                <dt>{t('adminPayments.receipt.itemTotal')}</dt>
                <dd>{amount(order.itemTotal)}</dd>
              </div>
              {discount > 0 && (
                <div>
                  <dt>{t('adminPayments.receipt.discounts')}</dt>
                  <dd>{amount(-discount)}</dd>
                </div>
              )}
              <div className={styles.strong}>
                <dt>{t('adminPayments.receipt.total')}</dt>
                <dd>{amount(order.total)}</dd>
              </div>
            </dl>
          </section>
        );
      })}

      <dl className={styles.sums}>
        {orders.length > 1 && (
          <div className={styles.strong}>
            <dt>{t('adminPayments.receipt.total')}</dt>
            <dd>{amount(total)}</dd>
          </div>
        )}
        {paid > 0 && (
          <div>
            <dt>{t('adminPayments.receipt.paid')}</dt>
            <dd>{amount(paid)}</dd>
          </div>
        )}
        {refunded > 0 && (
          <div>
            <dt>{t('adminPayments.receipt.refunded')}</dt>
            <dd>{amount(-refunded)}</dd>
          </div>
        )}
        <div className={styles.grand}>
          <dt>{t('adminPayments.receipt.due')}</dt>
          <dd>{amount(due)}</dd>
        </div>
      </dl>

      {payments.length > 0 && (
        <section className={styles.order}>
          <p className={styles.orderHead}>
            <strong>{t('adminPayments.receipt.payments')}</strong>
          </p>
          <table className={styles.items}>
            <tbody>
              {payments.map((e) => (
                <tr key={e.id}>
                  <td>
                    {clock.time(e.at)} · {methodName(e.method)}
                    {e.transactionRef && (
                      <span className={styles.muted}> · {e.transactionRef}</span>
                    )}
                  </td>
                  <td className={styles.num}>
                    {amount(e.kind === 'refund' ? -e.amount : e.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <p className={styles.thanks}>{t('adminPayments.receipt.thanks')}</p>
      <p className={styles.muted}>
        {t('adminPayments.receipt.printed', { time: `${clock.date(now)}, ${clock.time(now)}` })}
      </p>
    </article>
  );
}

/** The day report: the day's money, by method, every payment and refund, and what's still due. */
function ReportDoc({ orders, due, period }: { orders: Order[]; due: DueGroup[]; period: string }) {
  const t = useContent('common');
  const { branch, clock } = useAdminWorkspace();
  const { amount, methodName, where } = usePaymentText();
  const name = useAdminName();
  const day = daySummary(orders);
  const entries = [...ledgerEntries(orders)].reverse();
  const now = new Date();
  const col = (key: Parameters<typeof t>[0]) => t(key);

  return (
    <article className={styles.report}>
      <PrintHead title={t('adminPayments.report.title')} />
      <p className={styles.muted}>
        {t('adminPayments.report.branch', { branch: branch.shortName, date: period })}
      </p>
      <p className={styles.muted}>
        {t('adminPayments.report.printed', { time: clock.time(now), name: name ?? '' })}
      </p>

      <h2 className={styles.section}>{t('adminPayments.report.summary')}</h2>
      <dl className={styles.grid}>
        {(
          [
            [t('adminPayments.today.net'), amount(day.net)],
            [t('adminPayments.today.online'), amount(day.online)],
            [t('adminPayments.today.inPerson'), amount(day.inPerson)],
            [t('adminPayments.today.refunds'), amount(day.refunds)],
            [t('adminPayments.today.tips'), amount(day.tips)],
            [t('adminPayments.today.average'), amount(day.averageBill)],
            [t('adminPayments.today.toCollect'), amount(day.toCollect)],
            [t('adminPayments.methods.drawer'), amount(day.cashInDrawer)],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <h2 className={styles.section}>{t('adminPayments.report.byMethod')}</h2>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{col('adminPayments.report.columns.method')}</th>
            <th className={styles.num}>{col('adminPayments.report.columns.count')}</th>
            <th className={styles.num}>{col('adminPayments.report.columns.amount')}</th>
            <th className={styles.num}>{col('adminPayments.report.columns.refunds')}</th>
            <th className={styles.num}>{col('adminPayments.report.columns.tip')}</th>
          </tr>
        </thead>
        <tbody>
          {day.byMethod.map((m) => (
            <tr key={m.method}>
              <td>{methodName(m.method)}</td>
              <td className={styles.num}>{m.count}</td>
              <td className={styles.num}>{amount(m.amount)}</td>
              <td className={styles.num}>{amount(m.refunds)}</td>
              <td className={styles.num}>{amount(m.tips)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className={styles.section}>{t('adminPayments.report.transactions')}</h2>
      {entries.length > 0 ? (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{col('adminPayments.report.columns.time')}</th>
              <th>{col('adminPayments.report.columns.order')}</th>
              <th>{col('adminPayments.report.columns.where')}</th>
              <th>{col('adminPayments.report.columns.method')}</th>
              <th>{col('adminPayments.report.columns.by')}</th>
              <th className={styles.num}>{col('adminPayments.report.columns.amount')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td>{clock.time(e.at)}</td>
                <td>{t('adminPayments.orderId', { order: e.order.id })}</td>
                <td>{where(e.order)}</td>
                <td>
                  {methodName(e.method)}
                  {e.kind === 'refund' &&
                    ` · ${t('adminPayments.entry.refund')}${e.reason ? ` (${t(`adminPayments.entry.reasons.${e.reason}`)})` : ''}`}
                </td>
                <td>{e.by ?? ''}</td>
                <td className={styles.num}>
                  {amount(e.kind === 'refund' ? -e.amount : e.amount)}
                  {e.tip ? ` +${amount(e.tip)}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className={styles.muted}>{t('adminPayments.report.none')}</p>
      )}

      <h2 className={styles.section}>{t('adminPayments.report.outstanding')}</h2>
      {due.length > 0 ? (
        <table className={styles.table}>
          <tbody>
            {due.map((g) => (
              <tr key={g.key}>
                <td>
                  {g.kind === 'table'
                    ? t('adminPayments.due.table', { table: g.table })
                    : t('adminPayments.collect.orderLine', {
                        order: g.order.id,
                        name: g.order.customerName,
                      })}
                </td>
                <td>
                  {(g.kind === 'table' ? g.orders : [g.order])
                    .map((o) => t('adminPayments.orderId', { order: o.id }))
                    .join(', ')}
                </td>
                <td className={styles.num}>{amount(g.due)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className={styles.muted}>{t('adminPayments.report.none')}</p>
      )}
    </article>
  );
}
