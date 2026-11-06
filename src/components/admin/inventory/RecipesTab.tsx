'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useContent, useRecipes } from '@/api/hooks';
import { useSetFoodCostTarget } from '@/api/mutations';
import { Button, Chip, Input, SearchField } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { cx } from '@/lib/cx';
import type { RecipeSummary } from '@/types/inventory';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { useInventoryText } from './useInventoryText';
import styles from './Inventory.module.css';

const RecipeDialog = dynamic(() => import('./RecipeDialog').then((m) => m.RecipeDialog), {
  ssr: false,
});

type RecipeFilter = 'all' | 'none' | 'over' | 'off';
const FILTERS: readonly RecipeFilter[] = ['all', 'none', 'over', 'off'];

/** The highest food cost among a dish's portions (none without costs). */
const worst = (d: RecipeSummary) =>
  Math.max(...d.portions.map((p) => p.foodCost ?? 0), d.portions.length > 0 ? 0 : -1);

/** The branch's food cost target, saved on its own. */
function TargetField({ target }: { target: number }) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const { showToast } = useToast();
  const save = useSetFoodCostTarget();
  const [text, setText] = useState(String(target));
  const value = Number(text);
  const valid = /^\d{1,3}(\.\d)?$/.test(text.trim()) && value >= 1 && value <= 100;
  return (
    <div className={styles.filters}>
      <Input
        id="food-cost-target"
        label={t('adminInventory.recipes.targetLabel')}
        hint={t('adminInventory.recipes.targetHint')}
        inputMode="decimal"
        value={text}
        error={!valid ? t('adminInventory.recipes.targetError') : undefined}
        onChange={(event) => setText(event.target.value)}
      />
      <Button
        variant="secondary"
        disabled={!valid || value === target}
        loading={save.isPending}
        onClick={() =>
          save.mutate(
            { branchId: branch.id, target: value },
            {
              onSuccess: () => showToast(t('adminInventory.item.saved'), { tone: 'success' }),
              onError: () => showToast(t('adminInventory.errors.failed'), { tone: 'error' }),
            },
          )
        }
      >
        {t('adminInventory.item.save')}
      </Button>
    </div>
  );
}

/**
 * Every dish and its recipe: how many have one (dishes without use no stock), each portion's
 * food cost against the target (managers), and which stock has taken off. A dish opens its
 * recipe.
 */
export function RecipesTab() {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const text = useInventoryText();
  const query = useRecipes(branch.id);
  const [filter, setFilter] = useState<RecipeFilter>('all');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  if (!query.data) {
    return (
      <p className={styles.muted} aria-busy={!query.isError}>
        {query.isError ? t('adminInventory.failed') : t('adminInventory.loading')}
      </p>
    );
  }
  const { dishes, foodCostTarget } = query.data;
  const withRecipe = dishes.filter((d) => d.lines > 0).length;
  const q = search.trim().toLowerCase();
  const shown = dishes.filter(
    (d) =>
      (!q || d.name.toLowerCase().includes(q)) &&
      (filter === 'all' ||
        (filter === 'none' && d.lines === 0) ||
        (filter === 'over' && d.lines > 0 && worst(d) > foodCostTarget) ||
        (filter === 'off' && d.soldOutByStock)),
  );

  return (
    <>
      <ul className={styles.tiles} aria-label={t('adminInventory.recipes.summary')}>
        <li className={styles.tile}>
          <span className={styles.muted}>{t('adminInventory.recipes.coverage')}</span>
          <span className={styles.tileValue}>
            {t('adminInventory.recipes.coverageValue', { done: withRecipe, total: dishes.length })}
          </span>
        </li>
        <li className={cx(styles.tile, dishes.some((d) => d.soldOutByStock) && styles.tileOut)}>
          <span className={styles.muted}>{t('adminInventory.recipes.offByStock')}</span>
          <span className={styles.tileValue}>{dishes.filter((d) => d.soldOutByStock).length}</span>
        </li>
      </ul>
      <TargetField key={foodCostTarget} target={foodCostTarget} />
      <SearchField
        value={search}
        onChange={setSearch}
        label={t('adminInventory.recipes.search')}
        placeholder={t('adminInventory.recipes.search')}
      />
      <div className={styles.chips} role="group" aria-label={t('adminInventory.stock.filter')}>
        {FILTERS.map((f) => (
          <Chip key={f} pressed={filter === f} onClick={() => setFilter(f)}>
            {t(`adminInventory.recipes.filters.${f}`)}
          </Chip>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className={styles.muted}>{t('adminInventory.stock.noMatch')}</p>
      ) : (
        <ul className={styles.list}>
          {shown.map((d) => (
            <li key={d.slug}>
              <button type="button" className={styles.row} onClick={() => setOpen(d.slug)}>
                <span className={styles.rowMain}>
                  <span className={styles.rowName}>{d.name}</span>
                  <span className={styles.muted}>
                    {[
                      d.category,
                      d.lines === 0
                        ? t('adminInventory.recipes.noRecipe')
                        : t.plural('adminInventory.recipes.lines', d.lines),
                      d.unknownParts > 0
                        ? t.plural('adminInventory.recipes.unknown', d.unknownParts)
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <span className={styles.rowSide}>
                  {d.lines > 0 &&
                    d.portions.map((p, i) =>
                      p.cost !== undefined ? (
                        <span key={p.code ?? i} className={styles.muted}>
                          {[
                            p.name,
                            text.money(p.cost),
                            p.foodCost !== undefined ? `${p.foodCost}%` : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      ) : null,
                    )}
                  <span className={styles.actions}>
                    {d.soldOutByStock && (
                      <span className={cx(styles.chip, styles.out)}>
                        {t('adminInventory.recipes.soldOut')}
                      </span>
                    )}
                    {d.lines > 0 && worst(d) > foodCostTarget && (
                      <span className={cx(styles.chip, styles.low)}>
                        {t('adminInventory.recipes.overTarget')}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && <RecipeDialog slug={open} onClose={() => setOpen(null)} />}
    </>
  );
}
