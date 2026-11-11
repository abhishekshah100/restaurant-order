'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { useContent } from '@/api/hooks';
import { useAdminName } from '@/hooks/useAdminSession';
import { dueOn } from '@/lib/adminOrders';
import type { PaymentHistoryResponse } from '@/api/contracts';
import { ledgerOf, type DueGroup, type LedgerLine } from '@/lib/adminPayments';
import { brandName } from '@/lib/branchParts';
import { paidAmount } from '@/lib/lifecycle';
import { orderBill } from '@/lib/orders';
import { canShareFile, downloadFile, needsTap, shareFile } from '@/lib/saveFile';
import type { Order } from '@/types/order';
import { Button, Dialog } from '@/components/ui';
import { billRows } from '../../cart/PriceSummary';
import { useAdminWorkspace, type AdminWorkspace } from '../shell/AdminWorkspace';
import { usePaymentText, usePaymentWords } from './usePaymentText';
import styles from './PaymentPrint.module.css';

/** Set on <html> while a bill or the day report prints: everything else on the page is hidden. */
const PRINTING = 'printing-payments';

type Printable =
  | { kind: 'bill'; orders: Order[] }
  | { kind: 'report'; money: DayMoney; lines: LedgerLine[]; due: DueGroup[]; period: string };

/** The day's money as the server sums it (each payment on the day it was taken). */
export type DayMoney = PaymentHistoryResponse['summary'];

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
 * receipt once it's paid: what was paid, how and when); `report(money, lines, due, period)`
 * prints the day report for `period` (the day's money as it was taken, by method, every payment
 * and refund, what's still to collect). The page is put in the document and the browser's print dialog
 * opens in the same click; it's taken away at the next tap or key press. The page has no margin, so browsers leave out their own header and
 * footer (date, title, address); the sheet keeps its own.
 */
export function usePaymentPrint() {
  return usePrintDoc(useAdminWorkspace());
}

/**
 * The same bill for a guest's order (the order page's "Get invoice"), as a PDF file to keep:
 * staff and guests get one bill, drawn for the branch the order is from. A file rather than the
 * print dialog: phones (and the browsers inside chat apps) print badly or not at all, but all of
 * them download. On a phone the file goes to its share sheet (Save to Files, Print, WhatsApp),
 * so the guest never leaves the page; if making it took too long for the phone to allow that, a
 * small "Your invoice is ready" sheet asks for one more tap. On a computer it downloads.
 * `download(orders)` resolves once the file is handed over; it throws if it can't be made.
 */
export function useBillDownload(place: PrintPlace) {
  const t = useContent('common');
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [busy, setBusy] = useState(false);
  /** A file made, waiting for a tap to open the share sheet. */
  const [ready, setReady] = useState<File | null>(null);
  const holder = useRef<HTMLDivElement>(null);

  /** The file to the phone's share sheet, or downloaded; a fresh tap is asked for if needed. */
  const handOver = async (file: File) => {
    if (!canShareFile(file)) {
      downloadFile(file, file.name);
      return;
    }
    try {
      await shareFile(file);
      setReady(null);
    } catch (error) {
      if (needsTap(error)) setReady(file);
      else downloadFile(file, file.name);
    }
  };

  const download = async (next: Order[]) => {
    setBusy(true);
    try {
      flushSync(() => setOrders(next));
      const node = holder.current;
      if (!node) throw new Error('The bill could not be drawn');
      // Downloaded only when a bill is asked for (about 300 kB together).
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
        // Its fonts loaded, or the drawing falls back to another (older browsers lack this).
        document.fonts?.ready,
      ]);
      const canvas = await html2canvas(node, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });
      // One page as long as the bill, like a till roll: its width in CSS pixels, its height to scale.
      const width = node.offsetWidth;
      const height = (canvas.height / canvas.width) * width;
      const pdf = new jsPDF({
        unit: 'px',
        format: [width, height],
        orientation: height > width ? 'portrait' : 'landscape',
        hotfixes: ['px_scaling'],
      });
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, width, height);
      const name = t('adminPayments.receipt.fileName', {
        orders: next.map((o) => o.id).join(', '),
      });
      const file = new File([pdf.output('blob')], `${name}.pdf`, { type: 'application/pdf' });
      // Not pdf.save(): on an iPhone it replaces the page with the PDF.
      await handOver(file);
    } finally {
      setOrders(null);
      setBusy(false);
    }
  };

  const sheet = (
    <>
      {orders &&
        createPortal(
          <PrintPlaceContext.Provider value={place}>
            <div ref={holder} className={styles.capture} aria-hidden="true">
              <BillDoc orders={orders} />
            </div>
          </PrintPlaceContext.Provider>,
          document.body,
        )}
      {ready && (
        <Dialog
          open
          onClose={() => setReady(null)}
          presentation="adaptive"
          title={t('adminPayments.receipt.ready.title')}
          description={t('adminPayments.receipt.ready.body')}
          footer={
            <Button block iconStart="receipt" onClick={() => void handOver(ready)}>
              {t('adminPayments.receipt.ready.save')}
            </Button>
          }
        >
          <p className="t-small c2">{ready.name}</p>
        </Dialog>
      )}
    </>
  );

  return { download, busy, sheet };
}

function usePrintDoc(place: PrintPlace) {
  const t = useContent('common');
  const [doc, setDoc] = useState<Printable | null>(null);

  // Put away once the person is back on the page: their next tap or key press. Not on
  // `afterprint`: phones print in the background and fire it at once, before the print preview
  // has read the page, which then printed the whole page or nothing.
  useEffect(() => {
    if (!doc) return;
    const done = () => {
      document.documentElement.classList.remove(PRINTING);
      setDoc(null);
    };
    const listen = window.setTimeout(() => {
      window.addEventListener('pointerdown', done, { once: true, capture: true });
      window.addEventListener('keydown', done, { once: true, capture: true });
    }, 0);
    return () => {
      window.clearTimeout(listen);
      window.removeEventListener('pointerdown', done, { capture: true });
      window.removeEventListener('keydown', done, { capture: true });
    };
  }, [doc]);
  // Leaving the page while a sheet is out: nothing stays hidden.
  useEffect(() => () => document.documentElement.classList.remove(PRINTING), []);

  /**
   * Draws the sheet at once and opens the print dialog in the same tap or click: phones (iPhone
   * Safari above all) only print from the person's own action, not from a timer or an effect.
   */
  const print = (next: Printable) => {
    const root = document.documentElement;
    flushSync(() => setDoc(next));
    root.classList.add(PRINTING);
    // The tab's title names a saved PDF ("Bill BLR-001"); the page's comes back after.
    const pageTitle = document.title;
    document.title =
      next.kind === 'bill'
        ? t('adminPayments.receipt.fileName', { orders: next.orders.map((o) => o.id).join(', ') })
        : t('adminPayments.report.fileName', { period: next.period });
    window.addEventListener('afterprint', () => (document.title = pageTitle), { once: true });
    window.print();
  };

  const sheet =
    doc &&
    createPortal(
      <PrintPlaceContext.Provider value={place}>
        <div className={styles.sheet} data-print-sheet="">
          {doc.kind === 'bill' ? (
            <BillDoc orders={doc.orders} />
          ) : (
            <ReportDoc money={doc.money} lines={doc.lines} due={doc.due} period={doc.period} />
          )}
        </div>
      </PrintPlaceContext.Provider>,
      document.body,
    );

  return {
    bill: (orders: Order[]) => print({ kind: 'bill', orders }),
    report: (money: DayMoney, lines: LedgerLine[], due: DueGroup[], period: string) =>
      print({ kind: 'report', money, lines, due, period }),
    sheet,
  };
}

function PrintHead({ title }: { title: string }) {
  const t = useContent('common');
  const { region } = usePrintPlace();
  return (
    <header className={styles.head}>
      <p className={styles.brand}>{brandName(region.name)}</p>
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
  // Left off the bill settles it but was never paid.
  const left = payments.reduce((s, e) => s + (e.waived ?? 0), 0);
  const paid = orders.reduce((s, o) => s + paidAmount(o), 0) - left;
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
                {/* Only what's charged: what the kitchen couldn't make is off the bill. */}
                {order.items
                  .filter((item) => item.quantity > 0)
                  .map((item, index) => (
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

      {(paid > 0 || left > 0 || refunded > 0) && (
        <dl className={styles.sums}>
          {paid > 0 && (
            <div>
              <dt>{t('adminPayments.receipt.paid')}</dt>
              <dd>{amount(paid)}</dd>
            </div>
          )}
          {left > 0 && (
            <div>
              <dt>{t('adminPayments.receipt.left')}</dt>
              <dd>{amount(-left)}</dd>
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
                      {e.waived && e.waiveReason
                        ? ` · ${t('adminPayments.entry.left', {
                            amount: amount(e.waived),
                            reason: t(`adminPayments.entry.waiveReasons.${e.waiveReason}`),
                          })}`
                        : ''}
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
function ReportDoc({
  money: day,
  lines,
  due,
  period,
}: {
  money: DayMoney;
  lines: LedgerLine[];
  due: DueGroup[];
  period: string;
}) {
  const t = useContent('common');
  const { branch, clock } = useAdminWorkspace();
  const { amount, methodName, where } = usePaymentText();
  const name = useAdminName();
  // Oldest first, as the day went.
  const entries = [...lines].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const toCollect = due.reduce((total, g) => total + g.due, 0);
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
            [t('adminPayments.today.left'), amount(day.waived)],
            [t('adminPayments.today.toCollect'), amount(toCollect)],
            [t('adminPayments.methods.drawer'), amount(day.cashTaken)],
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
                  {e.waived ? ` (${t('adminPayments.receipt.left')} ${amount(e.waived)})` : ''}
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
