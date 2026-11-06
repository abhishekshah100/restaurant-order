'use client';

import { useState } from 'react';
import { useContent, useStockBatches } from '@/api/hooks';
import { useUpdateBatch, useWriteOffBatches } from '@/api/mutations';
import { Button, Input } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { cx } from '@/lib/cx';
import { isDayKey } from '@/lib/dayRange';
import { newEntryId, parseQuantity } from '@/lib/inventory';
import type { ExpiryState, StockBatch } from '@/types/inventory';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { useInventoryText } from './useInventoryText';
import styles from './Inventory.module.css';

/** "Expires today", "2 days left", "Expired 3 Nov", "Date not set": coloured by how near. */
export function ExpiryChip({
  state,
  expiresOn,
  daysLeft,
}: {
  state: ExpiryState;
  expiresOn?: string;
  daysLeft?: number;
}) {
  const t = useContent('common');
  const date = useDayText();
  const tone = { ok: styles.ok, expiring: styles.low, expired: styles.out, unknown: '' }[state];
  let label: string;
  if (state === 'unknown') label = t('adminInventory.expiry.undated');
  // An item's summary (no one date): near or past it.
  else if (!expiresOn) label = t(`adminInventory.summary.${state === 'ok' ? 'expiring' : state}`);
  else if (state === 'expired')
    label = t('adminInventory.expiry.expiredOn', { date: date(expiresOn) });
  else if (daysLeft === 0) label = t('adminInventory.expiry.today');
  else if (state === 'expiring') label = t.plural('adminInventory.expiry.daysLeft', daysLeft ?? 0);
  else label = t('adminInventory.expiry.until', { date: date(expiresOn) });
  return <span className={cx(styles.chip, tone)}>{label}</span>;
}

/** "8 Nov" for a day key, in the branch's locale. */
export function useDayText() {
  const { branch } = useAdminWorkspace();
  return (key: string) =>
    new Intl.DateTimeFormat(branch.locale, {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(`${key}T12:00:00Z`));
}

/** Writes off expired batches (whole), once per press: the entry id is made per press. */
export function useWriteOff() {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const { showToast } = useToast();
  const writeOff = useWriteOffBatches();
  return {
    pending: writeOff.isPending,
    run: (batchIds: string[]) =>
      writeOff.mutate(
        {
          branchId: branch.id,
          body: { entryId: newEntryId(), lines: batchIds.map((batchId) => ({ batchId })) },
        },
        {
          onSuccess: () =>
            showToast(t.plural('adminInventory.expiry.writtenOff', batchIds.length), {
              tone: 'success',
            }),
          onError: () => showToast(t('adminInventory.errors.failed'), { tone: 'error' }),
        },
      ),
  };
}

/**
 * An item's open batches, soonest expiry first: each its date (or "not set"), code, what's left
 * of what came, and what it's worth for managers. Managers date, code or split a batch; staff who
 * record wastage write off what's near or past its date.
 */
export function BatchList({ ingredientId }: { ingredientId: string }) {
  const t = useContent('common');
  const { branch, can } = useAdminWorkspace();
  const text = useInventoryText();
  const date = useDayText();
  const batches = useStockBatches(branch.id, { ingredient: ingredientId }).data?.batches;
  const writeOff = useWriteOff();
  const [editing, setEditing] = useState<string | null>(null);
  if (!batches) return null;

  return (
    <section className={styles.block} aria-labelledby="stock-batches">
      <h3 id="stock-batches" className={styles.blockTitle}>
        {t('adminInventory.expiry.batches')}
      </h3>
      {batches.length === 0 ? (
        <p className={styles.muted}>{t('adminInventory.expiry.noBatches')}</p>
      ) : (
        <ul className={styles.list}>
          {batches.map((b) => (
            <li key={b.id} className={styles.countLine}>
              <div className={styles.rowMain}>
                <span className={styles.rowName}>{text.quantity(b.left, b.unit)}</span>
                <span className={styles.muted}>
                  {[
                    t(`adminInventory.expiry.sources.${sourceKey(b.source)}`),
                    t('adminInventory.expiry.came', {
                      quantity: text.quantity(b.quantityIn, b.unit),
                      date: date(b.receivedAt.slice(0, 10)),
                    }),
                    b.lot && t('adminInventory.expiry.lotNamed', { lot: b.lot }),
                    b.value !== undefined ? text.value(b.value) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
              <span className={styles.rowSide}>
                <ExpiryChip state={b.state} expiresOn={b.expiresOn} daysLeft={b.daysLeft} />
              </span>
              {(can('inventory.manage') || (can('inventory.wastage') && b.state !== 'ok')) && (
                <div className={styles.actions}>
                  {can('inventory.manage') && (
                    <Button
                      size="sm"
                      variant="ghost"
                      iconStart="pencil"
                      onClick={() => setEditing(editing === b.id ? null : b.id)}
                    >
                      {t('adminInventory.expiry.edit')}
                    </Button>
                  )}
                  {can('inventory.wastage') && b.state !== 'ok' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      iconStart="trash"
                      loading={writeOff.pending}
                      onClick={() => writeOff.run([b.id])}
                    >
                      {t('adminInventory.expiry.writeOff')}
                    </Button>
                  )}
                </div>
              )}
              {editing === b.id && <BatchForm batch={b} onDone={() => setEditing(null)} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const SOURCES = ['receipt_line', 'production', 'stock_transfer', 'opening', 'start', 'split'];
const sourceKey = (source: string) =>
  (SOURCES.includes(source) ? source : 'other') as
    'receipt_line' | 'production' | 'stock_transfer' | 'opening' | 'start' | 'split' | 'other';

/** A batch's date and code, and some of it split off with its own date (managers). */
function BatchForm({ batch, onDone }: { batch: StockBatch; onDone: () => void }) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const text = useInventoryText();
  const { showToast } = useToast();
  const save = useUpdateBatch();
  const [expires, setExpires] = useState(batch.expiresOn ?? '');
  const [lot, setLot] = useState(batch.lot ?? '');
  const [splitQuantity, setSplitQuantity] = useState('');
  const [splitExpires, setSplitExpires] = useState('');
  const splitting = splitQuantity.trim() !== '';
  const splitValue = parseQuantity(splitQuantity);
  const problems = {
    expires: !isDayKey(expires),
    split: splitting && (splitValue === null || splitValue <= 0 || splitValue >= batch.left),
    splitExpires: splitting && !isDayKey(splitExpires),
  };
  const [tried, setTried] = useState(false);

  const submit = () => {
    setTried(true);
    if (problems.expires || problems.split || problems.splitExpires) return;
    save.mutate(
      {
        branchId: branch.id,
        id: batch.id,
        body: {
          ...(expires !== batch.expiresOn ? { expiresOn: expires } : {}),
          ...(lot.trim() !== (batch.lot ?? '') ? { lot: lot.trim() || null } : {}),
          ...(splitting ? { split: { quantity: splitValue ?? 0, expiresOn: splitExpires } } : {}),
        },
      },
      {
        onSuccess: () => {
          showToast(t('adminInventory.expiry.saved'), { tone: 'success' });
          onDone();
        },
        onError: () => showToast(t('adminInventory.errors.failed'), { tone: 'error' }),
      },
    );
  };

  return (
    <div className={styles.form}>
      <div className={styles.fieldRow}>
        <Input
          id={`batch-${batch.id}-expires`}
          type="date"
          label={t('adminInventory.expiry.expires')}
          value={expires}
          error={tried && problems.expires ? t('adminInventory.expiry.dateError') : undefined}
          onChange={(event) => setExpires(event.target.value)}
        />
        <Input
          id={`batch-${batch.id}-lot`}
          label={t('adminInventory.expiry.lot')}
          optional
          maxLength={40}
          value={lot}
          onChange={(event) => setLot(event.target.value)}
        />
      </div>
      <p className={styles.muted}>{t('adminInventory.expiry.splitHint')}</p>
      <div className={styles.fieldRow}>
        <Input
          id={`batch-${batch.id}-split`}
          label={t('adminInventory.expiry.splitQuantity', { unit: text.unit(batch.unit) })}
          optional
          inputMode="decimal"
          value={splitQuantity}
          error={tried && problems.split ? t('adminInventory.expiry.splitError') : undefined}
          onChange={(event) => setSplitQuantity(event.target.value)}
        />
        {splitting && (
          <Input
            id={`batch-${batch.id}-split-expires`}
            type="date"
            label={t('adminInventory.expiry.splitExpires')}
            value={splitExpires}
            error={
              tried && problems.splitExpires ? t('adminInventory.expiry.dateError') : undefined
            }
            onChange={(event) => setSplitExpires(event.target.value)}
          />
        )}
      </div>
      <div className={styles.actions}>
        <Button size="sm" iconStart="check" loading={save.isPending} onClick={submit}>
          {t('adminInventory.expiry.save')}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          {t('adminInventory.expiry.close')}
        </Button>
      </div>
    </div>
  );
}
