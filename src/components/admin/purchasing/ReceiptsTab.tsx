'use client';

import { useState } from 'react';
import { useContent, usePriceChanges, usePurchaseReturns, useReceipts } from '@/api/hooks';
import { cx } from '@/lib/cx';
import { shiftDay, type DayRange } from '@/lib/dayRange';
import styles from '../inventory/Inventory.module.css';
import { DateRangeFilter } from '../DateRangeFilter';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { docNumber, usePurchasingText } from './usePurchasingText';

/**
 * Deliveries by day: what came from whom (one opens its page: prices, returns, the invoice); for
 * managers, the prices that need a look first; and what went back to suppliers.
 */
export function ReceiptsTab({ today, onOpen }: { today: string; onOpen: (id: string) => void }) {
  const t = useContent('common');
  const { branch, can, clock } = useAdminWorkspace();
  const text = usePurchasingText();
  const [range, setRange] = useState<DayRange>({ from: shiftDay(today, -6), to: today });
  const receipts = useReceipts(branch.id, range).data?.receipts;
  const returns = usePurchaseReturns(branch.id, range).data?.returns ?? [];
  const changes = usePriceChanges(branch.id, can('purchase.manage')).data?.changes ?? [];

  return (
    <>
      {changes.length > 0 && (
        <section className={styles.block} aria-labelledby="price-changes">
          <h2 id="price-changes" className={styles.blockTitle}>
            {t('adminPurchasing.receipts.priceChanges')}
          </h2>
          <ul className={styles.list}>
            {changes.map((c) => (
              <li key={c.lineId}>
                <button type="button" className={styles.row} onClick={() => onOpen(c.receiptId)}>
                  <span className={styles.rowMain}>
                    <span className={styles.rowName}>{[c.name, c.supplier].join(' · ')}</span>
                    <span className={styles.muted}>
                      {[docNumber('GRN', c.receiptNumber), clock.date(c.receivedAt)].join(' · ')}
                    </span>
                  </span>
                  <span className={styles.rowSide}>
                    <span className={styles.quantity}>{text.perPack(c.price, c.pack)}</span>
                    <span className={cx(styles.chip, c.pricePending ? styles.low : styles.out)}>
                      {c.pricePending
                        ? t('adminPurchasing.receipts.toConfirm')
                        : t('adminPurchasing.receipts.flagged', {
                            expected: text.money(c.expectedPrice ?? 0),
                          })}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <DateRangeFilter id="receipts" range={range} today={today} onChange={setRange} />
      <section className={styles.block} aria-labelledby="receipts-title">
        <h2 id="receipts-title" className={styles.blockTitle}>
          {t('adminPurchasing.receipts.list')}
        </h2>
        {!receipts ? (
          <p className={styles.muted}>{t('adminInventory.loading')}</p>
        ) : receipts.length === 0 ? (
          <p className={styles.muted}>{t('adminPurchasing.receipts.none')}</p>
        ) : (
          <ul className={styles.list}>
            {receipts.map((r) => (
              <li key={r.id}>
                <button type="button" className={styles.row} onClick={() => onOpen(r.id)}>
                  <span className={styles.rowMain}>
                    <span className={styles.rowName}>
                      {[docNumber('GRN', r.number), r.supplier.name].join(' · ')}
                    </span>
                    <span className={styles.muted}>
                      {[
                        clock.dateTime(r.receivedAt),
                        r.order && docNumber('PO', r.order.number),
                        r.receivedBy && t('adminInventory.by', { name: r.receivedBy }),
                        t.plural('adminPurchasing.orders.lineCount', r.lines.length),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <span className={styles.rowSide}>
                    {r.total !== undefined && (
                      <span className={styles.quantity}>{text.value(r.total)}</span>
                    )}
                    {r.lines.some((l) => l.pricePending) && (
                      <span className={cx(styles.chip, styles.low)}>
                        {t('adminPurchasing.receipts.toConfirm')}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {returns.length > 0 && (
        <section className={styles.block} aria-labelledby="returns-title">
          <h2 id="returns-title" className={styles.blockTitle}>
            {t('adminPurchasing.returns.list')}
          </h2>
          <ul className={styles.list}>
            {returns.map((r) => (
              <li key={r.id}>
                <button type="button" className={styles.row} onClick={() => onOpen(r.receipt.id)}>
                  <span className={styles.rowMain}>
                    <span className={styles.rowName}>
                      {[docNumber('RTN', r.number), r.supplier.name].join(' · ')}
                    </span>
                    <span className={styles.muted}>
                      {[
                        clock.dateTime(r.at),
                        docNumber('GRN', r.receipt.number),
                        r.lines
                          .map((l) => `${l.name} ${text.packs(l.quantity, l.pack)}`)
                          .join(', '),
                      ].join(' · ')}
                    </span>
                  </span>
                  {r.total !== undefined && (
                    <span className={styles.quantity}>
                      {t('adminPurchasing.returns.credit', { amount: text.value(r.total) })}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
