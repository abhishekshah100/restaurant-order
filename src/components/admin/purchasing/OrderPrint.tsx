'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useContent } from '@/api/hooks';
import type { PurchaseOrder } from '@/types/purchasing';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { docNumber, usePurchasingText } from './usePurchasingText';
import styles from './OrderPrint.module.css';

/** Set on <html> while the order prints: everything else on the page is hidden. */
const PRINTING = 'printing-po';

/**
 * Printing a purchase order: `print(order)` lays it out on an A4 sheet (the restaurant and
 * branch, the order's number and dates, the supplier, each item with how many and, for staff who
 * see prices, its price and amount, the totals, the note), opens the browser's print dialog with
 * only the sheet showing, and takes the sheet away afterwards.
 */
export function useOrderPrint() {
  const t = useContent('common');
  const { brand, branch, clock } = useAdminWorkspace();
  const text = usePurchasingText();
  const [order, setOrder] = useState<PurchaseOrder | null>(null);

  useEffect(() => {
    if (!order) return;
    const root = document.documentElement;
    const done = () => {
      root.classList.remove(PRINTING);
      setOrder(null);
    };
    root.classList.add(PRINTING);
    window.addEventListener('afterprint', done, { once: true });
    // After the sheet has rendered.
    const id = window.setTimeout(() => window.print(), 50);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('afterprint', done);
      root.classList.remove(PRINTING);
    };
  }, [order]);

  const prices = order?.total !== undefined;
  const sheet =
    order &&
    createPortal(
      <article className={styles.sheet} data-print-sheet="">
        <header className={styles.head}>
          <div>
            <p className={styles.brand}>{brand}</p>
            {branch.name !== brand && <p className={styles.muted}>{branch.name}</p>}
          </div>
          <div className={styles.titleBox}>
            <h1 className={styles.title}>{t('adminPurchasing.print.title')}</h1>
            <p className={styles.number}>{docNumber('PO', order.number)}</p>
          </div>
        </header>

        <dl className={styles.facts}>
          <div>
            <dt>{t('adminPurchasing.print.to')}</dt>
            <dd>
              <strong>{order.supplier.name}</strong>
              {order.supplier.phone && <span>{order.supplier.phone}</span>}
              {order.supplier.email && <span>{order.supplier.email}</span>}
            </dd>
          </div>
          <div>
            <dt>{t('adminPurchasing.print.date')}</dt>
            <dd>{clock.date(order.createdAt)}</dd>
          </div>
          {order.expectedOn && (
            <div>
              <dt>{t('adminPurchasing.print.deliverBy')}</dt>
              <dd>{clock.day(order.expectedOn)}</dd>
            </div>
          )}
          {order.createdBy && (
            <div>
              <dt>{t('adminPurchasing.print.by')}</dt>
              <dd>{order.createdBy}</dd>
            </div>
          )}
        </dl>

        <table className={styles.items}>
          <thead>
            <tr>
              <th className={styles.n}>{t('adminPurchasing.print.n')}</th>
              <th>{t('adminPurchasing.orders.cols.item')}</th>
              <th className={styles.num}>{t('adminPurchasing.print.qty')}</th>
              {prices && <th className={styles.num}>{t('adminPurchasing.print.price')}</th>}
              {prices && <th className={styles.num}>{t('adminPurchasing.orders.cols.total')}</th>}
            </tr>
          </thead>
          <tbody>
            {order.lines.map((l, index) => (
              <tr key={l.id}>
                <td className={styles.n}>{index + 1}</td>
                <td>{l.name}</td>
                <td className={styles.num}>{text.packs(l.quantity, l.pack)}</td>
                {prices && (
                  <td className={styles.num}>
                    {l.price !== undefined ? text.perPack(l.price, l.pack) : '—'}
                  </td>
                )}
                {prices && (
                  <td className={styles.num}>
                    {l.total !== undefined ? text.money(l.total) : '—'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {prices && order.total !== undefined && (
          <dl className={styles.sums}>
            {(order.tax ?? 0) > 0 && (
              <>
                <div>
                  <dt>{t('adminPurchasing.orders.subtotal')}</dt>
                  <dd>{text.money(order.total)}</dd>
                </div>
                <div>
                  <dt>{t('adminPurchasing.orders.taxTotal')}</dt>
                  <dd>{text.money(order.tax ?? 0)}</dd>
                </div>
              </>
            )}
            <div className={styles.grand}>
              <dt>{t('adminPurchasing.orders.grand')}</dt>
              <dd>{text.money(order.total + (order.tax ?? 0))}</dd>
            </div>
          </dl>
        )}

        {order.note && (
          <p className={styles.note}>
            <strong>{t('adminPurchasing.orders.noteLabel')}:</strong> {order.note}
          </p>
        )}
        <p className={styles.foot}>
          {t('adminPurchasing.print.printed', { time: clock.dateTime(new Date()) })}
        </p>
      </article>,
      document.body,
    );

  return { print: (next: PurchaseOrder) => setOrder(next), sheet };
}
