'use client';

import { useState } from 'react';
import { isApiError } from '@/api/client';
import { useContent, useIngredients } from '@/api/hooks';
import { useProduceStock } from '@/api/mutations';
import { Button, Dialog, Input, Select, Textarea } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { UNITS, newEntryId, parseQuantity, unitsLike } from '@/lib/inventory';
import type { InventoryUnit } from '@/types/inventory';
import { useNow } from '@/hooks/useNow';
import { isDayKey, shiftDay } from '@/lib/dayRange';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { useInventoryText } from './useInventoryText';
import styles from './Inventory.module.css';

/**
 * A batch of a prepared item made (gravy, dough): how much came out. What its batch recipe uses,
 * scaled to that, leaves stock, shown before saving; the batch comes in at what that cost.
 */
export function ProductionDialog({
  ingredientId: initial,
  onClose,
}: {
  ingredientId?: string;
  onClose: () => void;
}) {
  const t = useContent('common');
  const { branch, clock } = useAdminWorkspace();
  const text = useInventoryText();
  const { showToast } = useToast();
  const produce = useProduceStock();
  const prepared = (useIngredients(branch.id).data?.ingredients ?? []).filter(
    (i) => i.prep && i.tracked,
  );
  const [entryId] = useState(newEntryId);
  const [id, setId] = useState(initial ?? '');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<InventoryUnit | ''>('');
  const [note, setNote] = useState('');
  const [expires, setExpires] = useState<string | null>(null);
  const now = useNow();
  const item = prepared.find((p) => p.id === id);
  const made = parseQuantity(quantity);
  // Items that track expiry: the batch's last good day (typed, else today + its shelf life).
  const expiresOn = item?.expiry
    ? (expires ??
      (item.expiry.shelfLifeDays && now
        ? shiftDay(clock.dayKey(now), item.expiry.shelfLifeDays)
        : ''))
    : undefined;
  const ready =
    Boolean(item) && made !== null && made > 0 && (expiresOn === undefined || isDayKey(expiresOn));
  // How many batches that is, in the item's own unit.
  const batches =
    item?.prep && made
      ? (made * UNITS[unit || item.unit].factor) / UNITS[item.unit].factor / item.prep.batchQuantity
      : 0;

  const submit = () => {
    if (!ready || !item) return;
    produce.mutate(
      {
        branchId: branch.id,
        body: {
          entryId,
          ingredientId: item.id,
          quantity: made ?? 0,
          ...(unit && unit !== item.unit ? { unit } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(expiresOn ? { expiresOn } : {}),
        },
      },
      {
        onSuccess: () => {
          showToast(t('adminInventory.production.done', { name: item.name }), {
            tone: 'success',
          });
          onClose();
        },
        onError: (error) =>
          showToast(
            isApiError(error, 'not_tracked')
              ? t('adminInventory.errors.notTracked', { names: item.name })
              : t('adminInventory.errors.failed'),
            { tone: 'error' },
          ),
      },
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminInventory.production.title')}
      description={t('adminInventory.production.body')}
      footer={
        <Button
          block
          iconStart="check"
          disabled={!ready}
          loading={produce.isPending}
          onClick={submit}
        >
          {t('adminInventory.production.confirm')}
        </Button>
      }
    >
      <div className={styles.form}>
        {prepared.length === 0 ? (
          <p className={styles.muted}>{t('adminInventory.production.none')}</p>
        ) : (
          <>
            <Select
              id="production-item"
              label={t('adminInventory.production.item')}
              value={id}
              onChange={(event) => {
                setId(event.target.value);
                setUnit('');
                setExpires(null);
              }}
            >
              <option value="" disabled>
                {t('adminInventory.entry.pickPlaceholder')}
              </option>
              {prepared.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            {item && (
              <div className={styles.fieldRow}>
                <Input
                  id="production-quantity"
                  label={t('adminInventory.production.made')}
                  hint={
                    item.prep
                      ? t('adminInventory.production.batch', {
                          quantity: text.quantity(item.prep.batchQuantity, item.unit),
                        })
                      : undefined
                  }
                  inputMode="decimal"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
                <Select
                  id="production-unit"
                  label={t('adminInventory.entry.in')}
                  value={unit || item.unit}
                  onChange={(event) => setUnit(event.target.value as InventoryUnit)}
                >
                  {unitsLike(item.unit).map((u) => (
                    <option key={u} value={u}>
                      {text.unit(u)}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            {item?.prep && batches > 0 && (
              <section className={styles.block} aria-labelledby="production-uses">
                <h3 id="production-uses" className={styles.blockTitle}>
                  {t('adminInventory.production.uses')}
                </h3>
                <ul className={styles.list}>
                  {item.prep.lines.map((l) => (
                    <li key={l.ingredientId} className={styles.row}>
                      <span className={styles.rowName}>{l.name}</span>
                      <span className={styles.quantity}>
                        {text.change(-l.quantity * batches, l.unit)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {expiresOn !== undefined && (
              <Input
                id="production-expires"
                type="date"
                label={t('adminInventory.expiry.expires')}
                value={expiresOn}
                error={
                  expires !== null && !isDayKey(expiresOn)
                    ? t('adminInventory.expiry.dateError')
                    : undefined
                }
                onChange={(event) => setExpires(event.target.value)}
              />
            )}
            <Textarea
              id="production-note"
              label={t('adminInventory.entry.note')}
              optional
              rows={2}
              maxLength={200}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </>
        )}
      </div>
    </Dialog>
  );
}
