'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ClientDetail, ClientPayment, PlatformSettings } from '@/api/contracts';
import { useContent } from '@/api/hooks';
import { rupees } from '@/lib/platform';
import styles from './Receipt.module.css';

/** The class on <html> while a receipt prints: everything else hides (Receipt.module.css). */
const PRINTING = 'printing-receipt';

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { dateStyle: 'long' });

/** "RCPT-00012" */
export const receiptNumber = (n: number) => `RCPT-${String(n).padStart(5, '0')}`;

/**
 * A payment's receipt on paper (A4 or a PDF from the print dialog): who it's from (the platform's
 * business, address and PAN / VAT), its number and date, who paid, what for (the package and the
 * term it paid for), how, and how much. Opens the print dialog as it shows; `onDone` after.
 */
export function ReceiptSheet({
  client,
  payment,
  business,
  onDone,
}: {
  client: ClientDetail;
  payment: ClientPayment;
  business: PlatformSettings;
  onDone: () => void;
}) {
  const t = useContent('common');

  useEffect(() => {
    const root = document.documentElement;
    const done = () => {
      root.classList.remove(PRINTING);
      onDone();
    };
    root.classList.add(PRINTING);
    window.addEventListener('afterprint', done, { once: true });
    const id = window.setTimeout(() => window.print(), 300);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('afterprint', done);
      root.classList.remove(PRINTING);
    };
  }, [onDone]);

  const what = [
    t('platform.receipt.package', { plan: client.plan.name }),
    payment.period
      ? t('platform.receipt.period', { from: day(payment.period.from), to: day(payment.period.to) })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return createPortal(
    <article className={styles.sheet} data-print-sheet="">
      <header className={styles.head}>
        <div>
          <h1 className={styles.business}>{business.businessName}</h1>
          {business.businessAddress && <p>{business.businessAddress}</p>}
          {business.businessTaxId && (
            <p>{t('platform.receipt.taxId', { id: business.businessTaxId })}</p>
          )}
          {(business.supportPhone || business.supportEmail) && (
            <p>{[business.supportPhone, business.supportEmail].filter(Boolean).join(' · ')}</p>
          )}
        </div>
        <div className={styles.meta}>
          <h2>{t('platform.receipt.title')}</h2>
          <p>{receiptNumber(payment.number)}</p>
          <p>{day(payment.paidOn)}</p>
        </div>
      </header>

      <section className={styles.to}>
        <h3>{t('platform.receipt.from')}</h3>
        <p className={styles.strong}>{client.name}</p>
        {client.contact.name && <p>{client.contact.name}</p>}
        {client.contact.phone && <p>{client.contact.phone}</p>}
        {client.contact.taxNumber && (
          <p>{t('platform.receipt.taxId', { id: client.contact.taxNumber })}</p>
        )}
      </section>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t('platform.receipt.for')}</th>
            <th>{t('platform.receipt.method')}</th>
            <th className={styles.amount}>{t('platform.receipt.amount')}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              {what}
              {payment.note && <span className={styles.note}>{payment.note}</span>}
            </td>
            <td>{t(`platform.payments.methods.${payment.method}`)}</td>
            <td className={styles.amount}>{rupees(payment.amount)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}>{t('platform.receipt.total')}</td>
            <td className={styles.amount}>{rupees(payment.amount)}</td>
          </tr>
        </tfoot>
      </table>

      <footer className={styles.foot}>
        <p>{t('platform.receipt.received', { amount: rupees(payment.amount), by: payment.by })}</p>
        {business.receiptNote && <p>{business.receiptNote}</p>}
      </footer>
    </article>,
    document.body,
  );
}
