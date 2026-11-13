'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/api/endpoints';
import { useContent } from '@/api/hooks';
import { refreshAfter } from '@/api/refreshAfter';
import { Button, Icon } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useAdminToken } from '@/hooks/useAdminSession';
import { newEntryId } from '@/lib/inventory';
import type { IngredientCategory, OpeningLine, StockItem } from '@/types/inventory';
import { useAdminWorkspace } from '../../shell/AdminWorkspace';
import styles from './Setup.module.css';

/** The server takes this many lines at a time. */
const CHUNK = 200;

/** A number typed in a box ("", "2", "2.5"); NaN when it isn't one. */
const amount = (text: string) => (text.trim() === '' ? undefined : Number(text.replace(',', '.')));

/**
 * Step ②: what the kitchen has now, like a paper stock sheet: one row per ingredient still
 * without a starting amount, with how much and (optional) the price paid. Empty boxes are left
 * for later; 0 means none. Saved as opening stock, in one go.
 */
export function OpeningStep({
  items,
  categories,
  onDone,
}: {
  items: readonly StockItem[];
  categories: readonly IngredientCategory[];
  onDone: () => void;
}) {
  const t = useContent('common');
  const { branch, region } = useAdminWorkspace();
  const token = useAdminToken();
  const client = useQueryClient();
  const { showToast } = useToast();
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [costs, setCostsState] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const due = items.filter((i) => i.openingDue);

  if (due.length === 0) {
    return (
      <div className={styles.stepBody}>
        <p className={styles.note}>
          <Icon name="checkc" size="xs" />
          {t('adminInventory.setup.opening.allDone')}
        </p>
        <div className={styles.footer}>
          <span />
          <Button iconEnd="arrow" onClick={onDone}>
            {t('adminInventory.setup.next')}
          </Button>
        </div>
      </div>
    );
  }

  const lines: OpeningLine[] = due.flatMap((i) => {
    const quantity = amount(quantities[i.ingredientId] ?? '');
    if (quantity === undefined || !Number.isFinite(quantity) || quantity < 0) return [];
    const cost = amount(costs[i.ingredientId] ?? '');
    return [
      {
        ingredientId: i.ingredientId,
        quantity,
        cost: cost !== undefined && Number.isFinite(cost) && cost >= 0 ? cost : 0,
      },
    ];
  });
  const bad = due.some((i) => {
    const q = amount(quantities[i.ingredientId] ?? '');
    const c = amount(costs[i.ingredientId] ?? '');
    return (q !== undefined && !(q >= 0)) || (c !== undefined && !(c >= 0));
  });

  const save = async () => {
    if (lines.length === 0) {
      setError(t('adminInventory.setup.opening.nothing'));
      return;
    }
    if (!token || bad) {
      setError(t('adminInventory.setup.opening.failed'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      for (let start = 0; start < lines.length; start += CHUNK) {
        await api.openingStock(token, branch.id, {
          entryId: newEntryId(),
          lines: lines.slice(start, start + CHUNK),
        });
      }
      showToast(t.plural('adminInventory.setup.opening.savedToast', lines.length), {
        tone: 'success',
      });
      setQuantities({});
      setCostsState({});
      if (lines.length === due.length) onDone();
    } catch {
      setError(t('adminInventory.setup.opening.failed'));
    } finally {
      setSaving(false);
      await refreshAfter(client, 'stockChanged', branch.id);
    }
  };

  // By category, as the shelves are.
  const named = new Map(categories.map((c) => [c.id, c.name]));
  const groups = [...new Set(due.map((i) => i.categoryId))].map((id) => ({
    id,
    name: id ? (named.get(id) ?? '') : '',
    items: due.filter((i) => i.categoryId === id),
  }));
  const left = due.length - lines.length;

  return (
    <div className={styles.stepBody}>
      <p className={styles.lead}>{t('adminInventory.setup.opening.body')}</p>
      <p className={styles.hint}>{t('adminInventory.setup.opening.costHint')}</p>
      {groups.map((group) => (
        <section key={group.id ?? 'none'} className={styles.group} aria-label={group.name}>
          {group.name && <h3 className={styles.groupTitle}>{group.name}</h3>}
          <ul className={styles.sheet}>
            {group.items.map((i) => {
              const unit = t(`adminInventory.units.${i.unit}`);
              return (
                <li key={i.ingredientId} className={styles.sheetRow}>
                  <span className={styles.sheetName}>{i.name}</span>
                  <label className={styles.sheetField}>
                    <span className={styles.sheetLabel}>
                      {t('adminInventory.setup.opening.quantity')}
                    </span>
                    <span className={styles.withUnit}>
                      <input
                        inputMode="decimal"
                        className={styles.box}
                        value={quantities[i.ingredientId] ?? ''}
                        onChange={(event) =>
                          setQuantities((all) => ({ ...all, [i.ingredientId]: event.target.value }))
                        }
                        aria-label={`${i.name}: ${t('adminInventory.setup.opening.quantity')}`}
                      />
                      <span className={styles.suffix}>{unit}</span>
                    </span>
                  </label>
                  <label className={styles.sheetField}>
                    <span className={styles.sheetLabel}>
                      {t('adminInventory.setup.opening.costOptional', { unit })}
                    </span>
                    <span className={styles.withUnit}>
                      <span className={styles.prefix}>{region.currency.symbol}</span>
                      <input
                        inputMode="decimal"
                        className={styles.box}
                        value={costs[i.ingredientId] ?? ''}
                        onChange={(event) =>
                          setCostsState((all) => ({ ...all, [i.ingredientId]: event.target.value }))
                        }
                        aria-label={`${i.name}: ${t('adminInventory.setup.opening.cost', { unit })}`}
                      />
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <div className={styles.footer}>
        <span className={error ? styles.footerError : styles.footerNote} role="status">
          {error || t.plural('adminInventory.setup.opening.left', left)}
        </span>
        <div className={styles.footerActions}>
          <Button
            iconStart="check"
            loading={saving}
            disabled={lines.length === 0}
            onClick={() => void save()}
          >
            {t.plural('adminInventory.setup.opening.save', lines.length)}
          </Button>
        </div>
      </div>
    </div>
  );
}
