'use client';

import { useState } from 'react';
import { api } from '@/api/endpoints';
import { isApiError } from '@/api/client';
import { useContent, useReceipt } from '@/api/hooks';
import { useConfirmPrices, useCreatePurchaseReturn } from '@/api/mutations';
import { Button, Dialog, Input, Textarea } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useAdminToken } from '@/hooks/useAdminSession';
import { cx } from '@/lib/cx';
import { newEntryId, parseCost, parseQuantity } from '@/lib/inventory';
import type { Receipt, ReturnReason } from '@/types/purchasing';
import styles from '../inventory/Inventory.module.css';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { docNumber, usePurchasingText } from './usePurchasingText';

const REASONS: readonly ReturnReason[] = ['damaged', 'wrong_item', 'expired', 'excess', 'other'];

/** Lines of a delivery sent back: how many of each (up to what's left), and why. */
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
  const left = (l: Receipt['lines'][number]) => l.quantity - l.rejected - l.returned;
  const chosen = receipt.lines.filter((l) => (parseQuantity(counts[l.id] ?? '') ?? 0) > 0);
  const bad = chosen.some(
    (l) => (parseQuantity(counts[l.id] ?? '') ?? 0) > left(l) || !reasons[l.id],
  );

  const submit = () =>
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

  return (
    <section className={styles.block} aria-labelledby="return-title">
      <h3 id="return-title" className={styles.blockTitle}>
        {t('adminPurchasing.returns.title')}
      </h3>
      {receipt.lines
        .filter((l) => left(l) > 0)
        .map((l) => (
          <div key={l.id} className={styles.line}>
            <span className={styles.rowName}>
              {[
                l.name,
                t('adminPurchasing.returns.left', { quantity: text.packs(left(l), l.pack) }),
              ].join(' · ')}
            </span>
            <Input
              id={`return-${l.id}`}
              label={t('adminPurchasing.returns.quantity')}
              inputMode="decimal"
              value={counts[l.id] ?? ''}
              onChange={(event) => setCounts((all) => ({ ...all, [l.id]: event.target.value }))}
            />
            {(parseQuantity(counts[l.id] ?? '') ?? 0) > 0 && (
              <div
                className={styles.reasons}
                role="radiogroup"
                aria-label={t('adminInventory.entry.reason')}
              >
                {REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={reasons[l.id] === r}
                    className={styles.reason}
                    onClick={() => setReasons((all) => ({ ...all, [l.id]: r }))}
                  >
                    {t(`adminPurchasing.returns.reasons.${r}`)}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      <Textarea
        id="return-note"
        label={t('adminInventory.entry.note')}
        optional
        rows={2}
        maxLength={300}
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <Button
        iconStart="arrow"
        disabled={chosen.length === 0 || bad}
        loading={create.isPending}
        onClick={submit}
      >
        {t('adminPurchasing.returns.confirm')}
      </Button>
    </section>
  );
}

/** Prices to confirm (received at the door) or put right, saved together. */
function PricesForm({ receipt }: { receipt: Receipt }) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
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
    <section className={styles.block} aria-labelledby="prices-title">
      <h3 id="prices-title" className={styles.blockTitle}>
        {t('adminPurchasing.receipts.prices')}
      </h3>
      <div className={styles.fieldRow}>
        {receipt.lines.map((l) => (
          <Input
            key={l.id}
            id={`price-${l.id}`}
            label={`${l.name}${l.pricePending ? ` · ${t('adminPurchasing.receipts.toConfirm')}` : ''}`}
            inputMode="decimal"
            value={prices[l.id] ?? ''}
            onChange={(event) => setPrices((all) => ({ ...all, [l.id]: event.target.value }))}
          />
        ))}
      </div>
      <Button
        variant="secondary"
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
              onSuccess: () =>
                showToast(t('adminPurchasing.receipts.pricesSaved'), { tone: 'success' }),
              onError: () => showToast(t('adminInventory.errors.failed'), { tone: 'error' }),
            },
          )
        }
      >
        {t('adminPurchasing.receipts.confirmPrices')}
      </Button>
    </section>
  );
}

/**
 * One delivery: what came, what was refused, what went back; its prices (flagged when far above
 * what was expected, or still to confirm); its invoice photo. Managers confirm prices and send
 * goods back from here.
 */
export function ReceiptDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useContent('common');
  const { branch, can, clock } = useAdminWorkspace();
  const token = useAdminToken();
  const text = usePurchasingText();
  const receipt = useReceipt(branch.id, id).data;
  const [returning, setReturning] = useState(false);

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
      title={
        receipt
          ? t('adminPurchasing.receipts.title', { number: docNumber('GRN', receipt.number) })
          : t('adminInventory.loading')
      }
    >
      {!receipt ? (
        <p className={styles.muted} aria-busy="true">
          {t('adminInventory.loading')}
        </p>
      ) : (
        <div className={styles.form}>
          <p className={styles.muted}>
            {[
              receipt.supplier.name,
              receipt.order && docNumber('PO', receipt.order.number),
              clock.dateTime(receipt.receivedAt),
              receipt.receivedBy && t('adminInventory.by', { name: receipt.receivedBy }),
              receipt.invoiceNumber &&
                t('adminPurchasing.receipts.invoiceNo', { number: receipt.invoiceNumber }),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <ul className={styles.list}>
            {receipt.lines.map((l) => (
              <li key={l.id} className={styles.row}>
                <span className={styles.rowMain}>
                  <span className={styles.rowName}>{l.name}</span>
                  <span className={styles.muted}>
                    {[
                      text.packs(l.quantity, l.pack),
                      l.rejected > 0 &&
                        t('adminPurchasing.receipts.refused', {
                          quantity: text.packs(l.rejected, l.pack),
                          reason: l.rejectReason ?? '',
                        }),
                      l.returned > 0 &&
                        t('adminPurchasing.receipts.returned', {
                          quantity: text.packs(l.returned, l.pack),
                        }),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <span className={styles.rowSide}>
                  {l.price !== undefined && (
                    <span className={styles.quantity}>{text.perPack(l.price, l.pack)}</span>
                  )}
                  <span className={styles.actions}>
                    {l.flagged && (
                      <span className={cx(styles.chip, styles.out)}>
                        {t('adminPurchasing.receipts.flagged', {
                          expected: text.money(l.expectedPrice ?? 0),
                        })}
                      </span>
                    )}
                    {l.pricePending && (
                      <span className={cx(styles.chip, styles.low)}>
                        {t('adminPurchasing.receipts.toConfirm')}
                      </span>
                    )}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {receipt.total !== undefined && (
            <p className={styles.blockTitle}>
              {t('adminPurchasing.orders.total', {
                total: text.money(receipt.total),
                tax: text.money(receipt.tax ?? 0),
              })}
            </p>
          )}
          {receipt.note && <p className={styles.muted}>{receipt.note}</p>}
          {receipt.proofKey && (
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => void viewPhoto(receipt.proofKey ?? '')}
            >
              {t('adminPurchasing.receipts.photo')}
            </button>
          )}
          {can('purchase.manage') && (
            <PricesForm key={receipt.lines.map((l) => l.price).join()} receipt={receipt} />
          )}
          {can('purchase.manage') &&
            (returning ? (
              <ReturnForm receipt={receipt} onDone={() => setReturning(false)} />
            ) : (
              receipt.lines.some((l) => l.quantity - l.rejected - l.returned > 0) && (
                <Button variant="secondary" iconStart="arrow" onClick={() => setReturning(true)}>
                  {t('adminPurchasing.returns.start')}
                </Button>
              )
            ))}
        </div>
      )}
    </Dialog>
  );
}
