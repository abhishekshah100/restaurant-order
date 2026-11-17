'use client';

import type { InvoiceChargeLine, InvoiceDocument } from '@/api/contracts';
import { useContent } from '@/api/hooks';
import type { ManualDiscountReason } from '@/types/promotion';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './PaymentPrint.module.css';

/** What a tax invoice is called (service › region.taxInvoice). */
const INVOICE_TITLES = ['gst', 'vat', 'billOfSupply', 'bill'] as const;
const MANUAL_REASONS: readonly ManualDiscountReason[] = [
  'regular',
  'complaint',
  'staffMeal',
  'manager',
  'other',
];

/**
 * A tax invoice or credit note exactly as issued (GET …/invoices/:id › document): the registered
 * seller (GSTIN or PAN, SAC, FSSAI), its number and dates (the Nepali date in Nepal), place of
 * supply, the buyer, the items, discounts and every charge (CGST and SGST apart), the taxable
 * value and tax, the total. A credit note names the invoice it reduces and why. `copy` above 0
 * marks a reprint ("Copy of original – 2"). Drawn for the screen and the printed sheet alike.
 */
export function InvoiceDoc({ doc, copy }: { doc: InvoiceDocument; copy?: number }) {
  const t = useContent('common');
  const cart = useContent('cart');
  const service = useContent('service');
  const { money, clock } = useAdminWorkspace();
  const amount = (n: number) => money.format(n);
  const credit = doc.kind === 'creditNote';
  const titleKey = INVOICE_TITLES.find((k) => k === doc.titleKey);
  const title = credit
    ? t('adminInvoices.doc.creditNote')
    : titleKey
      ? service(`region.taxInvoice.${titleKey}`)
      : t('adminInvoices.doc.invoice');
  const taxLabel = t(`adminPayments.receipt.taxIdLabels.${doc.seller.taxIdKey}`);

  // A tax with parts (GST) shows its parts (CGST, SGST); the rest as they are.
  const chargeRows = doc.charges.lines.flatMap((line: InvoiceChargeLine) =>
    (line.parts ?? [line]).map((l) => ({
      label: cart(`priceSummary.lines.${l.labelKey}` as Parameters<typeof cart>[0], l.vars),
      value: amount(l.amount),
    })),
  );
  const discountLabel = (d: { name?: string; labelKey?: string }) => {
    if (d.labelKey === 'manual') {
      const reason = MANUAL_REASONS.find((r) => r === d.name);
      return cart('priceSummary.manual', {
        reason: reason ? cart(`priceSummary.manualReasons.${reason}`) : (d.name ?? ''),
      });
    }
    return d.name || t('adminInvoices.doc.discount');
  };

  return (
    <article className={styles.bill}>
      <header className={styles.head}>
        <p className={styles.brand}>{doc.seller.name}</p>
        {doc.seller.branch && doc.seller.branch !== doc.seller.name && (
          <p className={styles.branch}>{doc.seller.branch}</p>
        )}
        {doc.seller.address && <p className={styles.address}>{doc.seller.address}</p>}
        <p className={styles.contact}>
          {doc.seller.phone && (
            <span>{t('adminPayments.receipt.phone', { phone: doc.seller.phone })}</span>
          )}
          {doc.seller.taxId && (
            <span>
              {t('adminPayments.receipt.taxId', { label: taxLabel, id: doc.seller.taxId })}
            </span>
          )}
        </p>
        {(doc.seller.sacCode || doc.seller.fssai) && (
          <p className={styles.contact}>
            {doc.seller.sacCode && (
              <span>{t('adminPayments.receipt.sac', { code: doc.seller.sacCode })}</span>
            )}
            {doc.seller.fssai && (
              <span>{t('adminPayments.receipt.fssai', { number: doc.seller.fssai })}</span>
            )}
          </p>
        )}
        <h1 className={styles.title}>{title}</h1>
      </header>
      {copy !== undefined && copy > 0 && (
        <p className={styles.thanks}>{t('adminPayments.receipt.copy', { n: copy })}</p>
      )}

      <dl className={styles.meta}>
        <div>
          <dt>
            {credit ? t('adminInvoices.doc.creditNoteNo') : t('adminPayments.receipt.invoiceNo')}
          </dt>
          <dd>{doc.number}</dd>
        </div>
        <div>
          <dt>{t('adminPayments.receipt.date')}</dt>
          <dd>
            {t('adminPayments.receipt.when', {
              date: clock.date(doc.issuedAt),
              time: clock.time(doc.issuedAt),
            })}
          </dd>
        </div>
        {doc.date.bs && (
          <div>
            <dt>{t('adminPayments.receipt.dateBs')}</dt>
            <dd>{doc.date.bs}</dd>
          </div>
        )}
        <div>
          <dt>{t('adminPayments.receipt.billNo')}</dt>
          <dd>
            {doc.order.code}
            {doc.order.table !== undefined &&
              ` · ${t('adminInvoices.doc.table', { table: doc.order.table })}`}
          </dd>
        </div>
        {doc.placeOfSupply && (
          <div>
            <dt>{t('adminPayments.receipt.placeOfSupply')}</dt>
            <dd>{t('adminPayments.receipt.placeOfSupplyValue', doc.placeOfSupply)}</dd>
          </div>
        )}
        <div>
          <dt>
            {doc.buyer.business
              ? t('adminPayments.receipt.billTo')
              : t('adminPayments.receipt.guestLabel')}
          </dt>
          <dd>
            {doc.buyer.name}
            {doc.buyer.taxId &&
              ` · ${t('adminPayments.receipt.taxId', { label: taxLabel, id: doc.buyer.taxId })}`}
            {doc.buyer.address && ` · ${doc.buyer.address}`}
          </dd>
        </div>
        {doc.creditNote && (
          <>
            <div>
              <dt>{t('adminInvoices.doc.against')}</dt>
              <dd>
                {t('adminInvoices.doc.againstValue', {
                  number: doc.creditNote.invoiceNumber,
                  date: doc.creditNote.invoiceDate,
                })}
              </dd>
            </div>
            <div>
              <dt>{t('adminInvoices.doc.reason')}</dt>
              <dd>
                {t(
                  `adminInvoices.doc.reasons.${
                    (
                      [
                        'cancelled',
                        'itemsRemoved',
                        'complaint',
                        'wrongItem',
                        'overcharged',
                        'goodwill',
                      ] as const
                    ).find((r) => r === doc.creditNote?.reason) ?? 'other'
                  }`,
                )}
              </dd>
            </div>
          </>
        )}
      </dl>

      {doc.lines && doc.lines.length > 0 && (
        <table className={styles.items}>
          <thead>
            <tr>
              <th>{t('adminPayments.receipt.item')}</th>
              <th className={styles.num}>{t('adminPayments.receipt.qty')}</th>
              <th className={styles.num}>{t('adminPayments.receipt.amount')}</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((line, index) => (
              <tr key={`${line.name}-${index}`}>
                <td>
                  <span className={styles.itemName}>{line.name}</span>
                  {line.variant && <span className={styles.variant}>{line.variant}</span>}
                </td>
                <td className={styles.num}>{line.quantity}</td>
                <td className={styles.num}>{amount(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <dl className={styles.sums}>
        {doc.itemTotal !== undefined && (
          <div>
            <dt>{cart('priceSummary.itemTotal')}</dt>
            <dd>{amount(doc.itemTotal)}</dd>
          </div>
        )}
        {(doc.discounts ?? []).map((d, index) => (
          <div key={index}>
            <dt>{discountLabel(d)}</dt>
            <dd>{amount(-d.amount)}</dd>
          </div>
        ))}
        {doc.deliveryFee !== undefined && doc.deliveryFee > 0 && (
          <div>
            <dt>{cart('priceSummary.deliveryFee')}</dt>
            <dd>{amount(doc.deliveryFee)}</dd>
          </div>
        )}
        <div>
          <dt>{t('adminInvoices.doc.taxable')}</dt>
          <dd>{amount(doc.taxable)}</dd>
        </div>
        {chargeRows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
        {doc.charges.roundOff !== 0 && (
          <div>
            <dt>{cart('priceSummary.roundOff')}</dt>
            <dd>{amount(doc.charges.roundOff)}</dd>
          </div>
        )}
        {doc.waived !== undefined && doc.waived > 0 && (
          <div>
            <dt>{t('adminPayments.receipt.left')}</dt>
            <dd>{amount(-doc.waived)}</dd>
          </div>
        )}
        {doc.refunded !== undefined && doc.refunded > 0 && (
          <div>
            <dt>{t('adminPayments.receipt.refunded')}</dt>
            <dd>{amount(-doc.refunded)}</dd>
          </div>
        )}
      </dl>

      <div className={styles.grand}>
        <span>{credit ? t('adminInvoices.doc.credited') : t('adminPayments.receipt.total')}</span>
        <strong>{amount(doc.total)}</strong>
      </div>
      <p className={styles.muted}>
        {t('adminInvoices.doc.taxLine', { taxable: amount(doc.taxable), tax: amount(doc.tax) })}
      </p>

      <footer className={styles.foot}>
        {!credit && <p className={styles.thanks}>{t('adminPayments.receipt.thanks')}</p>}
        <p className={styles.printed}>
          {t('adminPayments.receipt.printed', { time: clock.dateTime(new Date()) })}
        </p>
      </footer>
    </article>
  );
}
