'use client';

import { useMemo, useState } from 'react';
import { ApiError, isApiError } from '@/api/client';
import { useContent, useIngredients, useInventoryStock } from '@/api/hooks';
import { useAdjustStock, useOpeningStock, useWasteStock } from '@/api/mutations';
import { Button, Dialog, IconButton, Input, Select, Textarea } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import {
  ADJUSTMENT_REASONS,
  WASTAGE_REASONS,
  newEntryId,
  parseCost,
  parseQuantity,
  unitsLike,
} from '@/lib/inventory';
import type {
  AdjustmentLine,
  AdjustmentReason,
  Ingredient,
  InventoryUnit,
  OpeningLine,
  StockItem,
  WastageLine,
  WastageReason,
} from '@/types/inventory';
import { useNow } from '@/hooks/useNow';
import { isDayKey, shiftDay } from '@/lib/dayRange';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { useInventoryText } from './useInventoryText';
import styles from './Inventory.module.css';

export type StockEntryKind = 'opening' | 'adjustment' | 'wastage';
type AdjustMode = 'add' | 'remove' | 'count';

interface Draft {
  key: number;
  ingredientId: string;
  quantity: string;
  /** A unit code, or "pack:<id>". */
  measure: string;
  cost: string;
  mode: AdjustMode;
  reason: AdjustmentReason | WastageReason | null;
  note: string;
  /** Items that track expiry (opening stock): its last good day; none typed: the default. */
  expires?: string;
}

let nextKey = 1;
const blank = (ingredientId = '', cost = ''): Draft => ({
  key: nextKey++,
  ingredientId,
  quantity: '',
  measure: '',
  cost,
  mode: 'count',
  reason: null,
  note: '',
});

/** The line's quantity is given in: a unit, or a pack. */
const measureOf = (draft: Draft, ingredient: Ingredient) =>
  draft.measure.startsWith('pack:')
    ? { packId: draft.measure.slice(5) }
    : draft.measure && draft.measure !== ingredient.unit
      ? { unit: draft.measure as InventoryUnit }
      : {};

/** What's wrong with a line, or null when it can be sent. */
function problemOf(draft: Draft, kind: StockEntryKind, expires?: string): string | null {
  if (!draft.ingredientId) return 'ingredient';
  if (expires !== undefined && !isDayKey(expires)) return 'expires';
  const quantity = parseQuantity(draft.quantity);
  const zeroOk = kind === 'opening' || (kind === 'adjustment' && draft.mode === 'count');
  if (quantity === null || (!zeroOk && quantity <= 0)) return 'quantity';
  if (kind === 'opening' && parseCost(draft.cost) === null) return 'cost';
  if (kind !== 'opening' && !draft.reason) return 'reason';
  if (draft.reason === 'other' && !draft.note.trim()) return 'note';
  return null;
}

/**
 * Opening stock, an adjustment or wastage, for one or more ingredients at once: each line its
 * quantity (in the ingredient's unit, another of its measure, or packs) and, by kind, its cost,
 * how it changes and why. Sent with an entry id, so a retry never records it twice.
 */
export function StockEntryDialog({
  kind,
  ingredientIds = [],
  onClose,
}: {
  kind: StockEntryKind;
  /** Lines to start with (for opening stock: every item still waiting for it). */
  ingredientIds?: readonly string[];
  onClose: () => void;
}) {
  const t = useContent('common');
  const { branch, region, can, clock } = useAdminWorkspace();
  const text = useInventoryText();
  const { showToast } = useToast();
  const ingredients = useIngredients(branch.id).data;
  const stock = useInventoryStock(branch.id, can('inventory.view')).data;
  const opening = useOpeningStock();
  const adjust = useAdjustStock();
  const waste = useWasteStock();
  const pending = opening.isPending || adjust.isPending || waste.isPending;
  const [entryId] = useState(newEntryId);
  const [lines, setLines] = useState<Draft[]>(() =>
    ingredientIds.length > 0 ? ingredientIds.map((id) => blank(id)) : [blank()],
  );
  const [tried, setTried] = useState(false);
  const byId = useMemo(
    () => new Map((ingredients?.ingredients ?? []).map((i) => [i.id, i])),
    [ingredients],
  );
  const stockOf = useMemo(
    () => new Map((stock?.items ?? []).map((i) => [i.ingredientId, i])),
    [stock],
  );
  const now = useNow();
  const today = now ? clock.dayKey(now) : null;
  /** Opening stock of an item that tracks expiry: the date typed, else today + its shelf life. */
  const expiresOf = (draft: Draft): string | undefined => {
    const expiry = byId.get(draft.ingredientId)?.expiry;
    if (kind !== 'opening' || !expiry) return undefined;
    if (draft.expires !== undefined) return draft.expires;
    return expiry.shelfLifeDays && today ? shiftDay(today, expiry.shelfLifeDays) : '';
  };

  // What can be picked: what the branch tracks (for opening stock, what still waits for it).
  const choices = (ingredients?.ingredients ?? []).filter(
    (i) => i.tracked && (kind !== 'opening' || (stockOf.get(i.id)?.openingDue ?? true)),
  );

  const update = (key: number, change: Partial<Draft>) =>
    setLines((all) => all.map((l) => (l.key === key ? { ...l, ...change } : l)));
  const picked = new Set(lines.map((l) => l.ingredientId).filter(Boolean));
  const problems = lines.map((l) => problemOf(l, kind, expiresOf(l)));
  const ready = lines.length > 0 && problems.every((p) => p === null);

  const done = (count: number) => {
    showToast(t.plural(`adminInventory.entry.done.${kind}`, count), { tone: 'success' });
    onClose();
  };
  const failed = (error: unknown) => {
    const names = error instanceof ApiError ? error.body?.ingredients : undefined;
    const message = isApiError(error, 'opening_done')
      ? t('adminInventory.errors.openingDone', { names: names?.join(', ') ?? '' })
      : isApiError(error, 'not_tracked')
        ? t('adminInventory.errors.notTracked', { names: names?.join(', ') ?? '' })
        : isApiError(error, 'expiry_required')
          ? t('adminInventory.errors.expiryRequired', { names: names?.join(', ') ?? '' })
          : t('adminInventory.errors.failed');
    showToast(message, { tone: 'error' });
  };

  const submit = () => {
    setTried(true);
    if (!ready) return;
    const measured = lines.map((l) => {
      const ingredient = byId.get(l.ingredientId) as Ingredient;
      return { line: l, base: { ingredientId: l.ingredientId, ...measureOf(l, ingredient) } };
    });
    const note = (l: Draft) => (l.note.trim() ? { note: l.note.trim() } : {});
    const options = { onSuccess: () => done(lines.length), onError: failed };
    if (kind === 'opening') {
      const body = measured.map<OpeningLine>(({ line, base }) => {
        const expiresOn = expiresOf(line);
        return {
          ...base,
          quantity: parseQuantity(line.quantity) ?? 0,
          cost: parseCost(line.cost) ?? 0,
          ...(expiresOn ? { expiresOn } : {}),
        };
      });
      opening.mutate({ branchId: branch.id, body: { entryId, lines: body } }, options);
    } else if (kind === 'adjustment') {
      const body = measured.map<AdjustmentLine>(({ line, base }) => {
        const quantity = parseQuantity(line.quantity) ?? 0;
        return {
          ...base,
          ...(line.mode === 'count'
            ? { counted: quantity }
            : { change: line.mode === 'add' ? quantity : -quantity }),
          reason: line.reason as AdjustmentReason,
          ...note(line),
        };
      });
      adjust.mutate({ branchId: branch.id, body: { entryId, lines: body } }, options);
    } else {
      const body = measured.map<WastageLine>(({ line, base }) => ({
        ...base,
        quantity: parseQuantity(line.quantity) ?? 0,
        reason: line.reason as WastageReason,
        ...note(line),
      }));
      waste.mutate({ branchId: branch.id, body: { entryId, lines: body } }, options);
    }
  };

  const reasons = kind === 'wastage' ? WASTAGE_REASONS : ADJUSTMENT_REASONS;

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t(`adminInventory.entry.title.${kind}`)}
      description={t(`adminInventory.entry.body.${kind}`)}
      footer={
        <Button block iconStart="check" loading={pending} onClick={submit}>
          {t.plural(`adminInventory.entry.confirm.${kind}`, lines.length)}
        </Button>
      }
    >
      <div className={styles.form}>
        {!ingredients ? (
          <p className={styles.muted} aria-busy="true">
            {t('adminInventory.loading')}
          </p>
        ) : choices.length === 0 ? (
          <p className={styles.muted}>{t(`adminInventory.entry.nothing.${kind}`)}</p>
        ) : (
          lines.map((line, index) => {
            const ingredient = byId.get(line.ingredientId);
            const item: StockItem | undefined = stockOf.get(line.ingredientId);
            const problem = tried ? problems[index] : null;
            const id = `entry-${line.key}`;
            return (
              <fieldset key={line.key} className={styles.line}>
                <div className={styles.lineHead}>
                  <legend className={styles.label}>
                    {t('adminInventory.entry.line', { number: index + 1 })}
                  </legend>
                  {lines.length > 1 && (
                    <IconButton
                      icon="trash"
                      label={t('adminInventory.entry.removeLine')}
                      onClick={() => setLines((all) => all.filter((l) => l.key !== line.key))}
                    />
                  )}
                </div>
                <Select
                  id={`${id}-ingredient`}
                  label={t('adminInventory.entry.ingredient')}
                  value={line.ingredientId}
                  error={problem === 'ingredient' ? t('adminInventory.entry.pick') : undefined}
                  onChange={(event) =>
                    update(line.key, { ingredientId: event.target.value, measure: '' })
                  }
                >
                  <option value="" disabled>
                    {t('adminInventory.entry.pickPlaceholder')}
                  </option>
                  {choices
                    .filter((c) => c.id === line.ingredientId || !picked.has(c.id))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </Select>
                {item && kind !== 'opening' && (
                  <p className={styles.muted}>
                    {t('adminInventory.entry.onHand', {
                      quantity: text.quantity(item.onHand, item.unit),
                    })}
                  </p>
                )}
                {kind === 'adjustment' && (
                  <div
                    role="radiogroup"
                    aria-label={t('adminInventory.entry.how')}
                    className={styles.reasons}
                  >
                    {(['count', 'add', 'remove'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        role="radio"
                        aria-checked={line.mode === mode}
                        className={styles.reason}
                        onClick={() => update(line.key, { mode })}
                      >
                        {t(`adminInventory.entry.modes.${mode}`)}
                      </button>
                    ))}
                  </div>
                )}
                <div className={styles.fieldRow}>
                  <Input
                    id={`${id}-quantity`}
                    label={
                      kind === 'adjustment' && line.mode === 'count'
                        ? t('adminInventory.entry.counted')
                        : t('adminInventory.entry.quantity')
                    }
                    inputMode="decimal"
                    autoComplete="off"
                    value={line.quantity}
                    error={
                      problem === 'quantity' ? t('adminInventory.entry.quantityError') : undefined
                    }
                    onChange={(event) => update(line.key, { quantity: event.target.value })}
                  />
                  {ingredient && (
                    <Select
                      id={`${id}-measure`}
                      label={t('adminInventory.entry.in')}
                      value={line.measure || ingredient.unit}
                      onChange={(event) => update(line.key, { measure: event.target.value })}
                    >
                      {unitsLike(ingredient.unit).map((u) => (
                        <option key={u} value={u}>
                          {text.unit(u)}
                        </option>
                      ))}
                      {ingredient.packs.map((p) => (
                        <option key={p.id} value={`pack:${p.id}`}>
                          {t('adminInventory.packOption', {
                            name: p.name,
                            quantity: text.quantity(p.quantity, ingredient.unit),
                          })}
                        </option>
                      ))}
                    </Select>
                  )}
                  {kind === 'opening' && ingredient && (
                    <Input
                      id={`${id}-cost`}
                      label={t('adminInventory.entry.cost', {
                        symbol: region.currency.symbol,
                        unit: text.unit(ingredient.unit),
                      })}
                      inputMode="decimal"
                      autoComplete="off"
                      value={line.cost}
                      error={problem === 'cost' ? t('adminInventory.entry.costError') : undefined}
                      onChange={(event) => update(line.key, { cost: event.target.value })}
                    />
                  )}
                </div>
                {expiresOf(line) !== undefined && (
                  <Input
                    id={`${id}-expires`}
                    type="date"
                    label={t('adminInventory.expiry.expires')}
                    value={expiresOf(line) ?? ''}
                    error={problem === 'expires' ? t('adminInventory.expiry.dateError') : undefined}
                    onChange={(event) => update(line.key, { expires: event.target.value })}
                  />
                )}
                {kind !== 'opening' && (
                  <div role="radiogroup" aria-labelledby={`${id}-why`} className={styles.block}>
                    <p id={`${id}-why`} className={styles.label}>
                      {t('adminInventory.entry.reason')}
                    </p>
                    <div className={styles.reasons}>
                      {reasons.map((r) => (
                        <button
                          key={r}
                          type="button"
                          role="radio"
                          aria-checked={line.reason === r}
                          className={styles.reason}
                          onClick={() => update(line.key, { reason: r })}
                        >
                          {t(`adminInventory.reasons.${r}`)}
                        </button>
                      ))}
                    </div>
                    {problem === 'reason' && (
                      <p className={styles.error}>{t('adminInventory.entry.reasonError')}</p>
                    )}
                  </div>
                )}
                {kind !== 'opening' && (
                  <Textarea
                    id={`${id}-note`}
                    label={t('adminInventory.entry.note')}
                    optional={line.reason !== 'other'}
                    rows={2}
                    maxLength={200}
                    value={line.note}
                    error={problem === 'note' ? t('adminInventory.entry.noteError') : undefined}
                    onChange={(event) => update(line.key, { note: event.target.value })}
                  />
                )}
              </fieldset>
            );
          })
        )}
        {ingredients && lines.length < choices.length && (
          <Button
            variant="secondary"
            iconStart="plus"
            onClick={() => setLines((all) => [...all, blank()])}
          >
            {t('adminInventory.entry.addLine')}
          </Button>
        )}
      </div>
    </Dialog>
  );
}
