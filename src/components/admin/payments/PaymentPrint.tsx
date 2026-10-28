'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useContent } from '@/api/hooks';
import { useAdminName } from '@/hooks/useAdminSession';
import { dueOn } from '@/lib/adminOrders';
import { daySummary, ledgerEntries, ledgerOf, type DueGroup } from '@/lib/adminPayments';
import { paidAmount } from '@/lib/lifecycle';
import { orderBill } from '@/lib/orders';
import type { Order } from '@/types/order';
import { billRows } from '../../cart/PriceSummary';
import { useAdminWorkspace, type AdminWorkspace } from '../shell/AdminWorkspace';
import { usePaymentText, usePaymentWords } from './usePaymentText';
import styles from './PaymentPrint.module.css';

/** Set on <html> while a bill or the day report prints: everything else on the page is hidden. */
const PRINTING = 'printing-payments';

type Printable =
  | { kind: 'bill'; orders: Order[] }
  | { kind: 'report'; orders: Order[]; due: DueGroup[]; period: string };

/** The branch a bill is printed for, and how it writes money and times. */
export type PrintPlace = Pick<AdminWorkspace, 'region' | 'money' | 'clock'>;

const PrintPlaceContext = createContext<PrintPlace | null>(null);

function usePrintPlace(): PrintPlace {
  const place = useContext(PrintPlaceContext);
  if (!place) throw new Error('A printed bill needs its branch (PrintPlaceContext)');
  return place;
}

/**
 * Printing from the Payments page: `bill(orders)` prints the bill for an order or a table (a
 * receipt once it's paid: what was paid, how and when); `report(orders, due, period)` prints
 * the day report for the days in `period` (the day's money, by method, every payment and refund,
 * what's still to collect). The page is put in the document, the browser's print dialog opens,
 * and it's taken away after. The page has no margin, so browsers leave out their own header and
 * footer (date, title, address); the sheet keeps its own.
 */
export function usePaymentPrint() {
  return usePrintDoc(useAdminWorkspace());
}

/**
 * The same printed bill for a guest's order (the order page's "Get invoice"): staff and guests
 * get one bill, drawn for the branch the order is from.
 */
export function useBillPrint(place: PrintPlace) {
  const { bill, sheet } = usePrintDoc(place);
  return { bill, sheet };
}

function usePrintDoc(place: PrintPlace) {
  const t = useContent('common');
  const [doc, setDoc] = useState<Printable | null>(null);

  useEffect(() => {
    if (!doc) return;
    const root = document.documentElement;
    // The tab's title names a saved PDF ("Bill BLR-001"); the page's comes back after.
    const pageTitle = document.title;
    const done = () => {
      root.classList.remove(PRINTING);
      document.title = pageTitle;
      setDoc(null);
    };
    document.title =
      doc.kind === 'bill'
        ? t('adminPayments.receipt.fileName', { orders: doc.orders.map((o) => o.id).join(', ') })
        : t('adminPayments.report.fileName', { period: doc.period });
    root.classList.add(PRINTING);
    window.addEventListener('afterprint', done, { once: true });
    const id = window.setTimeout(() => window.print(), 50);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('afterprint', done);
      root.classList.remove(PRINTING);
      document.title = pageTitle;
    };
  }, [doc, t]);

  const sheet =
    doc &&
    createPortal(
      <PrintPlaceContext.Provider value={place}>
        <div className={styles.sheet} data-print-sheet="">
          {doc.kind === 'bill' ? (
            <BillDoc orders={doc.orders} />
          ) : (
            <ReportDoc orders={doc.orders} due={doc.due} period={doc.period} />
          )}
        </div>
      </PrintPlaceContext.Provider>,
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
  const { region } = usePrintPlace();
  return (
    <header className={styles.head}>
      <p className={styles.brand}>{t('meta.applicationName')}</p>
      <p className={styles.branch}>{region.shortName}</p>
      {region.address && <p className={styles.address}>{region.address}</p>}
      {(region.phone || region.tax.taxId) && (
        <p className={styles.contact}>
          {region.phone && <span>{t('adminPayments.receipt.phone', { phone: region.phone })}</span>}
          {region.tax.taxId && (
            <span>
              {t('adminPayments.receipt.taxId', {
                label: t(`adminPayments.receipt.taxIdLabels.${region.tax.taxIdKey}`),
                id: region.tax.taxId,
              })}
            </span>
          )}
        </p>
      )}
      <h1 className={styles.title}>{title}</h1>
    </header>
  );
}

/** What a printed bill is called: a receipt once paid; in India without GST a "Bill of supply". */
function useBillTitle(due: number): string {
  const t = useContent('common');
  const { region } = usePrintPlace();
  if (due <= 0) return t('adminPayments.receipt.receiptTitle');
  return region.tax.invoiceKey === 'billOfSupply'
    ? t('adminPayments.receipt.titleNoTax')
    : t('adminPayments.receipt.title');
}

/**
 * A bill for one order or a table: who and where, each order's items and every charge on it
 * (service charge, taxes, round off, as the guest's bill lists them), the total, what was paid
 * and what's due, and the payments taken.
 */
function BillDoc({ orders }: { orders: Order[] }) {
  const t = useContent('common');
  const cart = useContent('cart');
  const { clock, region, money } = usePrintPlace();
  const { amount, methodName, where } = usePaymentWords(money);
  const due = orders.reduce((s, o) => s + dueOn(o), 0);
  const total = orders.reduce((s, o) => s + o.total, 0);
  const payments = orders.flatMap((o) => ledgerOf(o).map((e) => ({ ...e, order: o })));
  const paid = orders.reduce((s, o) => s + paidAmount(o), 0);
  const refunded = payments.filter((e) => e.kind === 'refund').reduce((s, e) => s + e.amount, 0);
  const title = useBillTitle(due);
  const first = orders[0];
  const guests = [...new Set(orders.map((o) => o.customerName))].join(', ');
  const now = new Date();

  return (
    <article className={styles.bill}>
      <PrintHead title={title} />

      <dl className={styles.meta}>
        <div>
          <dt>{t('adminPayments.receipt.billNo')}</dt>
          <dd>{orders.map((o) => o.id).join(', ')}</dd>
        </div>
        <div>
          <dt>{t('adminPayments.receipt.date')}</dt>
          <dd>
            {t('adminPayments.receipt.when', {
              date: clock.date(first.placedAt),
              time: clock.time(first.placedAt),
            })}
          </dd>
        </div>
        <div>
          <dt>{t('adminPayments.receipt.servedAt')}</dt>
          <dd>{where(first)}</dd>
        </div>
        <div>
          <dt>{t('adminPayments.receipt.guestLabel')}</dt>
          <dd>{guests}</dd>
        </div>
      </dl>

      {orders.map((order) => {
        const charges = billRows(orderBill(order, region), { t: cart, money, tax: region.tax });
        return (
          <section key={order.id} className={styles.order}>
            {orders.length > 1 && (
              <p className={styles.orderHead}>
                <strong>{t('adminPayments.receipt.order', { order: order.id })}</strong>
                <span>{clock.dateTime(order.placedAt)}</span>
              </p>
            )}
            <table className={styles.items}>
              <thead>
                <tr>
                  <th>{t('adminPayments.receipt.item')}</th>
                  <th className={styles.qty}>{t('adminPayments.receipt.qty')}</th>
                  <th className={styles.num}>{t('adminPayments.receipt.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, index) => (
                  <tr key={`${item.dishSlug}-${index}`}>
                    <td>
                      <span className={styles.itemName}>{item.name}</span>
                      {item.variant && <span className={styles.variant}>{item.variant}</span>}
                    </td>
                    <td className={styles.qty}>{item.quantity}</td>
                    <td className={styles.num}>{amount(item.unitPrice * item.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className={styles.sums}>
              {charges.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
              {orders.length > 1 && (
                <div className={styles.subtotal}>
                  <dt>{t('adminPayments.receipt.orderTotal')}</dt>
                  <dd>{amount(order.total)}</dd>
                </div>
              )}
            </dl>
          </section>
        );
      })}

      <div className={styles.grand}>
        <span>{t('adminPayments.receipt.total')}</span>
        <strong>{amount(total)}</strong>
      </div>

      {(paid > 0 || refunded > 0) && (
        <dl className={styles.sums}>
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
          <div className={styles.due}>
            <dt>{t('adminPayments.receipt.due')}</dt>
            <dd>{amount(due)}</dd>
          </div>
        </dl>
      )}

      {payments.length > 0 && (
        <section className={styles.payments}>
          <p className={styles.label}>{t('adminPayments.receipt.payments')}</p>
          <table className={styles.items}>
            <tbody>
              {payments.map((e) => (
                <tr key={e.id}>
                  <td>
                    {methodName(e.method)}
                    <span className={styles.variant}>
                      {clock.dateTime(e.at)}
                      {e.transactionRef && ` · ${e.transactionRef}`}
                    </span>
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

      <footer className={styles.foot}>
        <p className={styles.thanks}>{t('adminPayments.receipt.thanks')}</p>
        <p className={styles.printed}>
          {t('adminPayments.receipt.printed', { time: clock.dateTime(now) })}
        </p>
      </footer>
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
        {t('adminPayments.report.printed', { time: clock.dateTime(now), name: name ?? '' })}
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
                <td>{clock.dateTime(e.at)}</td>
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
