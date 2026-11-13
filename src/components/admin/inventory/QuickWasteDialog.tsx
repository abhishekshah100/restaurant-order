'use client';

import { useState } from 'react';
import { useContent, useIngredients, useInventoryMovements, useInventoryStock } from '@/api/hooks';
import { useWasteStock } from '@/api/mutations';
import {
  Button,
  Dialog,
  Icon,
  IconButton,
  Input,
  SearchField,
  type IconName,
} from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useNow } from '@/hooks/useNow';
import { cx } from '@/lib/cx';
import { shiftDay } from '@/lib/dayRange';
import { newEntryId, parseQuantity, WASTAGE_REASONS } from '@/lib/inventory';
import type { InventoryUnit, WastageReason } from '@/types/inventory';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { useInventoryText } from './useInventoryText';
import styles from './QuickWaste.module.css';

/** Wastage this many days back decides what's "often wasted". */
const OFTEN_DAYS = 30;
const OFTEN_SHOWN = 8;
const STEP: Record<InventoryUnit, number> = { kg: 0.5, l: 0.5, g: 50, ml: 50, pc: 1, dozen: 1 };
const REASON_ICONS: Record<WastageReason, IconName> = {
  expired: 'clock',
  spoiled: 'alert',
  damaged: 'x',
  kitchen_mistake: 'chef',
  spilled: 'trash',
  guest_return: 'refresh',
  other: 'msg',
};

interface Line {
  ingredientId: string;
  text: string;
  reason: WastageReason | '';
  note: string;
}

/**
 * Record wastage in three taps: tap what was thrown away (the most wasted of the last month
 * first, or search), set how much with − and +, tap why. What it's worth shows before saving
 * (for those who see costs). Several items at once; each comes off the stock.
 */
export function QuickWasteDialog({
  ingredientIds = [],
  onClose,
}: {
  /** Items to start with (from an item's page). */
  ingredientIds?: readonly string[];
  onClose: () => void;
}) {
  const t = useContent('common');
  const { branch, clock, can } = useAdminWorkspace();
  const text = useInventoryText();
  const { showToast } = useToast();
  const waste = useWasteStock();
  const viewer = can('inventory.view');
  const now = useNow();
  const today = now ? clock.dayKey(now) : null;
  const ingredients = useIngredients(branch.id).data;
  const stock = useInventoryStock(branch.id, viewer).data;
  const history = useInventoryMovements(
    branch.id,
    today ? { from: shiftDay(today, -(OFTEN_DAYS - 1)), to: today, kind: 'wastage' } : {},
    viewer && today !== null,
  ).data;
  const [entryId] = useState(newEntryId);
  const [lines, setLines] = useState<Line[]>(() =>
    ingredientIds.map((id) => ({ ingredientId: id, text: '', reason: '', note: '' })),
  );
  const [search, setSearch] = useState('');
  const [tried, setTried] = useState(false);

  const tracked = (ingredients?.ingredients ?? []).filter((i) => i.tracked);
  const byId = new Map(tracked.map((i) => [i.id, i]));
  const stockOf = new Map((stock?.items ?? []).map((i) => [i.ingredientId, i]));
  const picked = new Set(lines.map((l) => l.ingredientId));

  // Most wasted first (how often), then the rest by name.
  const times = new Map<string, number>();
  for (const m of history?.movements ?? []) {
    times.set(m.ingredientId, (times.get(m.ingredientId) ?? 0) + 1);
  }
  const often = [...times.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => byId.get(id))
    .filter((i) => i !== undefined)
    .slice(0, OFTEN_SHOWN);
  const q = search.trim().toLowerCase();
  const choices = q
    ? tracked.filter((i) => i.name.toLowerCase().includes(q))
    : often.length > 0
      ? often
      : tracked;

  const add = (id: string) => {
    if (picked.has(id)) return;
    setLines((all) => [...all, { ingredientId: id, text: '', reason: '', note: '' }]);
    setSearch('');
  };
  const update = (id: string, change: Partial<Line>) =>
    setLines((all) => all.map((l) => (l.ingredientId === id ? { ...l, ...change } : l)));
  const remove = (id: string) => setLines((all) => all.filter((l) => l.ingredientId !== id));

  const quantityOf = (l: Line) => parseQuantity(l.text);
  const problem = (l: Line) =>
    quantityOf(l) === null || (quantityOf(l) ?? 0) <= 0
      ? 'quantity'
      : !l.reason
        ? 'reason'
        : l.reason === 'other' && !l.note.trim()
          ? 'note'
          : null;
  const worth = lines.reduce((sum, l) => {
    const cost = stockOf.get(l.ingredientId)?.cost;
    const n = quantityOf(l);
    return cost !== undefined && n ? sum + cost * n : sum;
  }, 0);

  const save = () => {
    setTried(true);
    if (lines.length === 0 || lines.some((l) => problem(l) !== null)) return;
    waste.mutate(
      {
        branchId: branch.id,
        body: {
          entryId,
          lines: lines.map((l) => ({
            ingredientId: l.ingredientId,
            quantity: quantityOf(l) ?? 0,
            reason: l.reason as WastageReason,
            ...(l.note.trim() ? { note: l.note.trim() } : {}),
          })),
        },
      },
      {
        onSuccess: () => {
          showToast(t.plural('adminInventory.entry.done.wastage', lines.length), {
            tone: 'success',
          });
          onClose();
        },
        onError: () => showToast(t('adminInventory.errors.failed'), { tone: 'error' }),
      },
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminInventory.entry.title.wastage')}
      description={t('adminInventory.waste.body')}
      footer={
        <div className={styles.footer}>
          {worth > 0 && (
            <span className={styles.worth}>
              {t('adminInventory.waste.worth', { amount: text.value(worth) })}
            </span>
          )}
          <Button
            block
            iconStart="trash"
            loading={waste.isPending}
            disabled={lines.length === 0}
            onClick={save}
          >
            {t.plural('adminInventory.waste.save', Math.max(lines.length, 1))}
          </Button>
        </div>
      }
    >
      <div className={styles.body}>
        <section className={styles.pick} aria-labelledby="waste-pick">
          <h3 id="waste-pick" className={styles.title}>
            {q || often.length === 0
              ? t('adminInventory.waste.pick')
              : t('adminInventory.waste.often')}
          </h3>
          <SearchField
            value={search}
            onChange={setSearch}
            label={t('adminInventory.waste.search')}
            placeholder={t('adminInventory.waste.search')}
          />
          <div className={styles.choices}>
            {choices.map((i) => (
              <button
                key={i.id}
                type="button"
                className={cx(styles.choice, picked.has(i.id) && styles.chosen)}
                aria-pressed={picked.has(i.id)}
                onClick={() => (picked.has(i.id) ? remove(i.id) : add(i.id))}
              >
                {picked.has(i.id) && <Icon name="check" size="xs" />}
                {i.name}
              </button>
            ))}
            {choices.length === 0 && (
              <p className={styles.muted}>{t('adminInventory.stock.noMatch')}</p>
            )}
          </div>
        </section>

        {lines.length === 0 ? (
          <p className={styles.empty}>{t('adminInventory.waste.none')}</p>
        ) : (
          <ul className={styles.lines}>
            {lines.map((l) => {
              const ingredient = byId.get(l.ingredientId);
              const unit = ingredient?.unit ?? 'kg';
              const item = stockOf.get(l.ingredientId);
              const issue = tried ? problem(l) : null;
              const n = quantityOf(l) ?? 0;
              return (
                <li key={l.ingredientId} className={styles.line}>
                  <div className={styles.lineHead}>
                    <strong>{ingredient?.name ?? ''}</strong>
                    {item && (
                      <span className={styles.muted}>
                        {t('adminInventory.entry.onHand', {
                          quantity: text.quantity(item.onHand, unit),
                        })}
                      </span>
                    )}
                    <IconButton
                      icon="x"
                      size="sm"
                      label={t('adminInventory.waste.remove', { name: ingredient?.name ?? '' })}
                      onClick={() => remove(l.ingredientId)}
                    />
                  </div>
                  <div className={styles.amount}>
                    <button
                      type="button"
                      className={styles.step}
                      aria-label={t('adminInventory.quick.less', {
                        step: text.quantity(STEP[unit], unit),
                      })}
                      onClick={() =>
                        update(l.ingredientId, {
                          text: String(Math.max(0, Math.round((n - STEP[unit]) * 1000) / 1000)),
                        })
                      }
                    >
                      −
                    </button>
                    <label className={styles.box}>
                      <input
                        inputMode="decimal"
                        autoComplete="off"
                        value={l.text}
                        aria-label={t('adminInventory.waste.quantity', {
                          name: ingredient?.name ?? '',
                        })}
                        aria-invalid={issue === 'quantity' || undefined}
                        onChange={(event) => update(l.ingredientId, { text: event.target.value })}
                      />
                      <span>{text.unit(unit)}</span>
                    </label>
                    <button
                      type="button"
                      className={styles.step}
                      aria-label={t('adminInventory.quick.more', {
                        step: text.quantity(STEP[unit], unit),
                      })}
                      onClick={() =>
                        update(l.ingredientId, {
                          text: String(Math.round((n + STEP[unit]) * 1000) / 1000),
                        })
                      }
                    >
                      +
                    </button>
                  </div>
                  {issue === 'quantity' && (
                    <p className={styles.error}>{t('adminInventory.waste.quantityError')}</p>
                  )}
                  <div
                    className={styles.reasons}
                    role="radiogroup"
                    aria-label={t('adminInventory.entry.reason')}
                  >
                    {WASTAGE_REASONS.map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        role="radio"
                        aria-checked={l.reason === reason}
                        className={cx(styles.reason, l.reason === reason && styles.reasonOn)}
                        onClick={() => update(l.ingredientId, { reason })}
                      >
                        <Icon name={REASON_ICONS[reason]} size="sm" />
                        <span>{t(`adminInventory.reasons.${reason}`)}</span>
                      </button>
                    ))}
                  </div>
                  {issue === 'reason' && (
                    <p className={styles.error}>{t('adminInventory.entry.reasonError')}</p>
                  )}
                  {l.reason === 'other' && (
                    <Input
                      id={`waste-note-${l.ingredientId}`}
                      label={t('adminInventory.entry.note')}
                      maxLength={200}
                      value={l.note}
                      error={issue === 'note' ? t('adminInventory.entry.noteError') : undefined}
                      onChange={(event) => update(l.ingredientId, { note: event.target.value })}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
