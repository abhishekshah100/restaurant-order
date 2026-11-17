'use client';

import { useState } from 'react';
import { api } from '@/api/endpoints';
import { isApiError } from '@/api/client';
import { useContent, useReceipt } from '@/api/hooks';
import { useConfirmPrices, useCreatePurchaseReturn } from '@/api/mutations';
import { Button, Dialog, Icon, Input, Textarea } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useAdminToken } from '@/hooks/useAdminSession';
import { cx } from '@/lib/cx';
import { newEntryId, parseCost, parseQuantity } from '@/lib/inventory';
import type { Receipt, ReturnReason } from '@/types/purchasing';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { Qty } from './Qty';
import { docNumber, usePurchasingText } from './usePurchasingText';
import styles from './Purchasing.module.css';

const REASONS: readonly ReturnReason[] = ['damaged', 'wrong_item', 'expired', 'excess', 'other'];

/** How much of a delivered line can still go back: what came, less refused and returned. */
const leftOf = (l: Receipt['lines'][number]) => l.quantity - l.rejected - l.returned;

/**
 * Sending items back: for each item that can still go back, how many (up to what's left) and
 * why (reason chips), and a note. Saved as one return; the supplier's credit follows.
 */
function ReturnForm({ receipt, onDone }: { receipt: Receipt; onDone: () => void }) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const text = usePurchasingText();
  const { showToast } = useToast();
  const create = useCreatePurchaseReturn();
  const [entryId] = useState(newEntryId);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, ReturnReason>>({});
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const chosen = receipt.lines.filter((l) => (parseQuantity(counts[l.id] ?? '') ?? 0) > 0);
  const tooMany = (l: Receipt['lines'][number]) =>
    (parseQuantity(counts[l.id] ?? '') ?? 0) > leftOf(l);
  const bad = chosen.some((l) => tooMany(l) || !reasons[l.id]);

  const submit = () => {
    setTried(true);
    if (chosen.length === 0 || bad) return;
    create.mutate(
      {
        branchId: branch.id,
        body: {
          entryId,
          receiptId: receipt.id,
          ...(note.trim() ? { note: note.trim() } : {}),
          lines: chosen.map((l) => ({
            receiptLineId: l.id,
            quantity: parseQuantity(counts[l.id] ?? '') ?? 0,
            reason: reasons[l.id] ?? 'other',
          })),
        },
      },
      {
        onSuccess: (saved) => {
          showToast(t('adminPurchasing.returns.done', { number: docNumber('RTN', saved.number) }), {
            tone: 'success',
          });
          onDone();
        },
        onError: (error) =>
          showToast(
            isApiError(error, 'return_exceeds')
              ? t('adminPurchasing.errors.returnExceeds')
              : t('adminInventory.errors.failed'),
            { tone: 'error' },
          ),
      },
    );
  };

  return (
    <section className={styles.billBox} aria-labelledby="return-title">
      <span id="return-title" className={styles.blockTitle}>
        {t('adminPurchasing.returns.title')}
      </span>
      <span className={styles.muted}>{t('adminPurchasing.returns.intro')}</span>
      <ul className={styles.items}>
        {receipt.lines
          .filter((l) => leftOf(l) > 0)
          .map((l) => {
            const n = parseQuantity(counts[l.id] ?? '') ?? 0;
            return (
              <li key={l.id} className={cx(styles.itemStack, n > 0 && styles.itemOn)}>
                <div className={styles.item}>
                  <span className={styles.itemText}>
                    <span className={styles.itemName}>{l.name}</span>
                    <span className={cx(styles.itemMeta, tooMany(l) && styles.lateText)}>
                      {t('adminPurchasing.returns.left', {
                        quantity: text.packs(leftOf(l), l.pack),
                      })}
                    </span>
                  </span>
                  <Qty
                    id={`return-${l.id}`}
                    label={t('adminPurchasing.returns.howMany', { item: l.name })}
                    less={t('adminPurchasing.orders.less', { item: l.name })}
                    more={t('adminPurchasing.orders.moreOf', { item: l.name })}
                    value={counts[l.id] ?? ''}
                    onChange={(v) => setCounts((all) => ({ ...all, [l.id]: v }))}
                  />
                </div>
                {n > 0 && (
                  <div className={cx(styles.reasons, styles.reasonsIn)}>
                    <span className={styles.reasonsLabel}>
                      {t('adminPurchasing.returns.why')}
                      {tried && !reasons[l.id] && (
                        <span className={styles.lateText}>
                          {' '}
                          · {t('adminPurchasing.returns.pickWhy')}
                        </span>
                      )}
                    </span>
                    {REASONS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        className={styles.dayChip}
                        aria-pressed={reasons[l.id] === r}
                        onClick={() => setReasons((all) => ({ ...all, [l.id]: r }))}
                      >
                        {t(`adminPurchasing.returns.reasons.${r}`)}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
      </ul>
      <Textarea
        id="return-note"
        label={t('adminInventory.entry.note')}
        optional
        rows={2}
        maxLength={300}
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <div className={styles.footButtons}>
        <Button variant="secondary" onClick={onDone}>
          {t('adminPurchasing.returns.cancel')}
        </Button>
        <Button iconStart="back" loading={create.isPending} onClick={submit}>
          {t('adminPurchasing.returns.confirm')}
        </Button>
      </div>
    </section>
  );
}

/**
 * Prices to confirm (counted at the door without them) or put right: each item's price per pack,
 * with what was expected; only what changed is saved.
 */
function PricesForm({ receipt, onDone }: { receipt: Receipt; onDone: () => void }) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const text = usePurchasingText();
  const { showToast } = useToast();
  const confirm = useConfirmPrices();
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      receipt.lines.map((l) => [l.id, l.price !== undefined ? String(l.price) : '']),
    ),
  );
  const changed = receipt.lines.filter(
    (l) => l.pricePending || (parseCost(prices[l.id] ?? '') ?? l.price) !== l.price,
  );
  const valid = changed.every((l) => parseCost(prices[l.id] ?? '') !== null);
  return (
    <section className={styles.billBox} aria-labelledby="prices-title">
      <span id="prices-title" className={styles.blockTitle}>
        {t('adminPurchasing.receipts.prices')}
      </span>
      <span className={styles.muted}>{t('adminPurchasing.receipts.pricesIntro')}</span>
      <ul className={styles.items}>
        {receipt.lines.map((l) => (
          <li key={l.id} className={styles.item}>
            <span className={styles.itemText}>
              <span className={styles.itemName}>
                {l.name}
                {l.pricePending && (
                  <span className={styles.lowBadge}>{t('adminPurchasing.receipts.toConfirm')}</span>
                )}
              </span>
              <span className={styles.itemMeta}>
                {[
                  text.pack(l.pack),
                  l.expectedPrice !== undefined &&
                    t('adminPurchasing.receipts.expectedPrice', {
                      price: text.money(l.expectedPrice),
                    }),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
            <Input
              id={`price-${l.id}`}
              label={t('adminPurchasing.receipts.pricePer', { pack: l.pack.name })}
              hideLabel
              inputMode="decimal"
              className={styles.priceInput}
              value={prices[l.id] ?? ''}
              onChange={(event) => setPrices((all) => ({ ...all, [l.id]: event.target.value }))}
            />
          </li>
        ))}
      </ul>
      <div className={styles.footButtons}>
        <Button variant="secondary" onClick={onDone}>
          {t('adminPurchasing.returns.cancel')}
        </Button>
        <Button
          iconStart="check"
          disabled={changed.length === 0 || !valid}
          loading={confirm.isPending}
          onClick={() =>
            confirm.mutate(
              {
                branchId: branch.id,
                id: receipt.id,
                lines: changed.map((l) => ({
                  lineId: l.id,
                  price: parseCost(prices[l.id] ?? '') ?? 0,
                })),
              },
              {
                onSuccess: () => {
                  showToast(t('adminPurchasing.receipts.pricesSaved'), { tone: 'success' });
                  onDone();
                },
                onError: () => showToast(t('adminInventory.errors.failed'), { tone: 'error' }),
              },
            )
          }
        >
          {t('adminPurchasing.receipts.confirmPrices')}
        </Button>
      </div>
    </section>
  );
}

/**
 * One delivery: from whom, against which order, when and who took it in, the bill's number and
 * photo; each item with what came, what was refused (and why) and sent back, its price (flagged
 * when far above what was expected, or still to confirm); the total. Managers confirm or correct
 * prices (opened by itself while some are to confirm) and send items back.
 */
export function ReceiptDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useContent('common');
  const { branch, can, clock } = useAdminWorkspace();
  const token = useAdminToken();
  const text = usePurchasingText();
  const receipt = useReceipt(branch.id, id).data;
  const manage = can('purchase.manage');
  const [mode, setMode] = useState<'view' | 'prices' | 'return' | null>(null);
  const pending = receipt?.lines.some((l) => l.pricePending) ?? false;
  // Prices still to confirm: that's the job, so it opens on it.
  const shown = mode ?? (pending && manage ? 'prices' : 'view');
  const canReturn = receipt?.lines.some((l) => leftOf(l) > 0) ?? false;

  const viewPhoto = async (key: string) => {
    if (!token) return;
    const blob = await api.purchaseProof(token, branch.id, key);
    window.open(URL.createObjectURL(blob), '_blank', 'noopener');
  };

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      className={styles.orderDialog}
      title={
        receipt
          ? t('adminPurchasing.receipts.title', { number: docNumber('GRN', receipt.number) })
          : t('adminInventory.loading')
      }
      {...(receipt && manage && shown === 'view' && (canReturn || receipt.lines.length > 0)
        ? {
            footer: (
              <div className={styles.footButtons}>
                <Button variant="secondary" iconStart="tag" onClick={() => setMode('prices')}>
                  {t('adminPurchasing.receipts.correctPrices')}
                </Button>
                {canReturn && (
                  <Button variant="secondary" iconStart="back" onClick={() => setMode('return')}>
                    {t('adminPurchasing.returns.start')}
                  </Button>
                )}
              </div>
            ),
          }
        : {})}
    >
      {!receipt ? (
        <p className={styles.muted} aria-busy="true">
          {t('adminInventory.loading')}
        </p>
      ) : (
        <div className={styles.orderView}>
          <div className={styles.orderHead}>
            <div className={styles.orderHeadText}>
              <span className={styles.orderSupplierBig}>{receipt.supplier.name}</span>
              <span className={styles.muted}>
                {[
                  clock.dateTime(receipt.receivedAt),
                  receipt.receivedBy && t('adminInventory.by', { name: receipt.receivedBy }),
                  receipt.order && docNumber('PO', receipt.order.number),
                  receipt.invoiceNumber &&
                    t('adminPurchasing.receipts.invoiceNo', { number: receipt.invoiceNumber }),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </div>
            {receipt.proofKey && (
              <Button
                size="sm"
                variant="secondary"
                iconStart="camera"
                onClick={() => void viewPhoto(receipt.proofKey ?? '')}
              >
                {t('adminPurchasing.receipts.photo')}
              </Button>
            )}
          </div>

          {shown === 'prices' && (
            <PricesForm
              key={receipt.lines.map((l) => l.price).join()}
              receipt={receipt}
              onDone={() => setMode('view')}
            />
          )}
          {shown === 'return' && <ReturnForm receipt={receipt} onDone={() => setMode('view')} />}

          {shown === 'view' && (
            <>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t('adminPurchasing.orders.cols.item')}</th>
                    <th className={styles.num}>{t('adminPurchasing.orders.cols.came')}</th>
                    {receipt.total !== undefined && (
                      <th className={styles.num}>{t('adminPurchasing.receipts.priceCol')}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {receipt.lines.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <span className={styles.rowTitle}>{l.name}</span>
                        {l.rejected > 0 && (
                          <span className={cx(styles.rowMeta, styles.lateText)}>
                            {t('adminPurchasing.receipts.refused', {
                              quantity: text.packs(l.rejected, l.pack),
                              reason: l.rejectReason ?? '—',
                            })}
                          </span>
                        )}
                        {l.returned > 0 && (
                          <span className={styles.rowMeta}>
                            {t('adminPurchasing.receipts.returned', {
                              quantity: text.packs(l.returned, l.pack),
                            })}
                          </span>
                        )}
                      </td>
                      <td className={styles.num}>{text.packs(l.quantity, l.pack)}</td>
                      {receipt.total !== undefined && (
                        <td className={styles.num}>
                          {l.price !== undefined ? text.perPack(l.price, l.pack) : '—'}
                          {l.flagged && (
                            <span className={styles.badge} data-tone="err">
                              {t('adminPurchasing.receipts.flagged', {
                                expected: text.money(l.expectedPrice ?? 0),
                              })}
                            </span>
                          )}
                          {l.pricePending && (
                            <span className={styles.badge} data-tone="warn">
                              {t('adminPurchasing.receipts.toConfirm')}
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {receipt.total !== undefined && (
                <dl className={styles.sums}>
                  {(receipt.tax ?? 0) > 0 && (
                    <>
                      <div>
                        <dt>{t('adminPurchasing.orders.subtotal')}</dt>
                        <dd>{text.money(receipt.total)}</dd>
                      </div>
                      <div>
                        <dt>{t('adminPurchasing.orders.taxTotal')}</dt>
                        <dd>{text.money(receipt.tax ?? 0)}</dd>
                      </div>
                    </>
                  )}
                  <div className={styles.grand}>
                    <dt>{t('adminPurchasing.orders.grand')}</dt>
                    <dd>{text.money(receipt.total + (receipt.tax ?? 0))}</dd>
                  </div>
                </dl>
              )}
              {receipt.note && (
                <p className={styles.note}>
                  <Icon name="msg" size="xs" />
                  {receipt.note}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </Dialog>
  );
}
