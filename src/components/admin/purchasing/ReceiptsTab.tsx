'use client';

import { useState } from 'react';
import { useContent, usePriceChanges, usePurchaseReturns, useReceipts } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { cx } from '@/lib/cx';
import { shiftDay, type DayRange } from '@/lib/dayRange';
import type { Receipt } from '@/types/purchasing';
import { DateRangeFilter } from '../DateRangeFilter';
import { InfoTip } from '../inventory/InfoTip';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { docNumber, usePurchasingText } from './usePurchasingText';
import styles from './Purchasing.module.css';

/** Quick ranges: the last week, the last month. */
const PRESETS = [7, 30] as const;

/**
 * Purchasing › Deliveries: for managers, the delivered prices that need a look first (to confirm,
 * or far above what was expected); then the deliveries on the days picked (the last week to
 * start), each with what came, from whom, its total and badges (price to confirm, refused,
 * returned, bill photo); then what went back to suppliers. Each opens the delivery.
 */
export function ReceiptsTab({ today, onOpen }: { today: string; onOpen: (id: string) => void }) {
  const t = useContent('common');
  const { branch, can, clock } = useAdminWorkspace();
  const text = usePurchasingText();
  const [range, setRange] = useState<DayRange>({ from: shiftDay(today, -6), to: today });
  const receipts = useReceipts(branch.id, range).data?.receipts;
  const returns = usePurchaseReturns(branch.id, range).data?.returns ?? [];
  const changes = usePriceChanges(branch.id, can('purchase.manage')).data?.changes ?? [];
  const toCheck = changes.filter((c) => c.pricePending || c.flagged);

  const badges = (r: Receipt) => {
    const refused = r.lines.filter((l) => l.rejected > 0).length;
    const returned = r.lines.some((l) => l.returned > 0);
    const pending = r.lines.some((l) => l.pricePending);
    const flagged = r.lines.some((l) => l.flagged);
    return (
      <span className={styles.badges}>
        {pending && (
          <span className={styles.badge} data-tone="warn">
            {t('adminPurchasing.receipts.toConfirm')}
          </span>
        )}
        {flagged && !pending && (
          <span className={styles.badge} data-tone="err">
            {t('adminPurchasing.receipts.priceUp')}
          </span>
        )}
        {refused > 0 && (
          <span className={styles.badge} data-tone="err">
            {t.plural('adminPurchasing.receipts.refusedCount', refused)}
          </span>
        )}
        {returned && (
          <span className={styles.badge} data-tone="info">
            {t('adminPurchasing.receipts.someReturned')}
          </span>
        )}
        {r.proofKey && (
          <span className={styles.badge} data-tone="ok">
            <Icon name="camera" size="xs" />
            {t('adminPurchasing.receipts.hasPhoto')}
          </span>
        )}
      </span>
    );
  };

  return (
    <div className={styles.today}>
      {toCheck.length > 0 && (
        <section className={styles.actionCard} data-tone="warn" aria-labelledby="price-changes">
          <header className={styles.cardHead}>
            <span className={styles.cardIcon} aria-hidden="true">
              <Icon name="tag" size="sm" />
            </span>
            <span className={styles.cardText}>
              <h2 id="price-changes" className={styles.cardTitle}>
                {t('adminPurchasing.today.prices.title')}
                <span className={styles.cardCount}>{toCheck.length}</span>
                <InfoTip label={t('adminInventory.tips.label')}>
                  {t('adminPurchasing.tips.prices')}
                </InfoTip>
              </h2>
              <span className={styles.muted}>{t('adminPurchasing.today.prices.hint')}</span>
            </span>
          </header>
          <ul className={styles.rows}>
            {toCheck.map((c) => (
              <li key={c.lineId} className={styles.row}>
                <button
                  type="button"
                  className={styles.rowMain}
                  onClick={() => onOpen(c.receiptId)}
                >
                  <span className={styles.rowTitle}>{c.name}</span>
                  <span className={styles.rowMeta}>
                    {[c.supplier, docNumber('GRN', c.receiptNumber), clock.date(c.receivedAt)].join(
                      ' · ',
                    )}
                  </span>
                </button>
                <span className={styles.priceSide}>
                  <strong>{text.perPack(c.price, c.pack)}</strong>
                  <span className={styles.badge} data-tone={c.pricePending ? 'warn' : 'err'}>
                    {c.pricePending
                      ? t('adminPurchasing.receipts.toConfirm')
                      : t('adminPurchasing.receipts.flagged', {
                          expected: text.money(c.expectedPrice ?? 0),
                        })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <DateRangeFilter
        id="receipts"
        range={range}
        today={today}
        onChange={setRange}
        presets={PRESETS.map((days) => ({
          days,
          label: t.plural('adminPurchasing.receipts.lastDays', days),
        }))}
      />

      <section aria-labelledby="receipts-title" className={styles.editorBlock}>
        <h2 id="receipts-title" className={styles.blockTitle}>
          {t('adminPurchasing.receipts.list')}
        </h2>
        {!receipts ? (
          <p className={styles.muted} aria-busy="true">
            {t('adminInventory.loading')}
          </p>
        ) : receipts.length === 0 ? (
          <div className={styles.empty}>
            <Icon name="bag" size="md" />
            <p>{t('adminPurchasing.receipts.none')}</p>
          </div>
        ) : (
          <ul className={styles.deliveries}>
            {receipts.map((r) => (
              <li key={r.id}>
                <button type="button" className={styles.delivery} onClick={() => onOpen(r.id)}>
                  <span className={styles.pickIcon} aria-hidden="true">
                    <Icon name="bag" size="sm" />
                  </span>
                  <span className={styles.rowMain}>
                    <span className={styles.rowTitle}>{r.supplier.name}</span>
                    <span className={styles.rowMeta}>
                      {[
                        clock.dateTime(r.receivedAt),
                        docNumber('GRN', r.number),
                        r.order && docNumber('PO', r.order.number),
                        t.plural('adminPurchasing.orders.lineCount', r.lines.length),
                        r.receivedBy && t('adminInventory.by', { name: r.receivedBy }),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    {badges(r)}
                  </span>
                  {r.total !== undefined && (
                    <span className={styles.deliveryTotal}>
                      {text.money(r.total + (r.tax ?? 0))}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {returns.length > 0 && (
        <section aria-labelledby="returns-title" className={styles.editorBlock}>
          <h2 id="returns-title" className={styles.blockTitle}>
            {t('adminPurchasing.returns.list')}
            <InfoTip label={t('adminInventory.tips.label')}>
              {t('adminPurchasing.tips.returns')}
            </InfoTip>
          </h2>
          <ul className={styles.deliveries}>
            {returns.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className={cx(styles.delivery, styles.returnRow)}
                  onClick={() => onOpen(r.receipt.id)}
                >
                  <span className={styles.pickIcon} aria-hidden="true">
                    <Icon name="back" size="sm" />
                  </span>
                  <span className={styles.rowMain}>
                    <span className={styles.rowTitle}>
                      {t('adminPurchasing.returns.toSupplier', { name: r.supplier.name })}
                    </span>
                    <span className={styles.rowMeta}>
                      {[
                        clock.dateTime(r.at),
                        docNumber('RTN', r.number),
                        r.lines
                          .map(
                            (l) =>
                              `${l.name} ${text.packs(l.quantity, l.pack)} (${t(
                                `adminPurchasing.returns.reasons.${l.reason}`,
                              )})`,
                          )
                          .join(', '),
                      ].join(' · ')}
                    </span>
                  </span>
                  {r.total !== undefined && (
                    <span className={styles.deliveryTotal}>
                      {t('adminPurchasing.returns.credit', { amount: text.money(r.total) })}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
