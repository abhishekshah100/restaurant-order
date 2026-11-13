'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useContent, useInventoryDashboard, useRecipes } from '@/api/hooks';
import { useSetFoodCostTarget } from '@/api/mutations';
import { Button, Chip, Input, SearchField } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { cx } from '@/lib/cx';
import { findTemplate } from '@/lib/recipeTemplates';
import type { RecipeSummary } from '@/types/inventory';
import { RECIPE_TEMPLATES } from './recipeTemplateList';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { useInventoryText } from './useInventoryText';
import styles from './Inventory.module.css';
import recipes from './Recipes.module.css';
import stock from './Stock.module.css';

const RecipeDialog = dynamic(() => import('./RecipeDialog').then((m) => m.RecipeDialog), {
  ssr: false,
});

type RecipeFilter = 'all' | 'linked' | 'none' | 'over' | 'price' | 'off';
const FILTERS: readonly RecipeFilter[] = ['all', 'linked', 'none', 'over', 'price', 'off'];

/** The highest food cost among a dish's portions (none without costs). */
const worst = (d: RecipeSummary) =>
  Math.max(...d.portions.map((p) => p.foodCost ?? 0), d.portions.length > 0 ? 0 : -1);

/** The branch's food cost goal, folded: a line saying it, opened to change it. */
function TargetField({ target }: { target: number }) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const { showToast } = useToast();
  const save = useSetFoodCostTarget();
  const [text, setText] = useState(String(target));
  const value = Number(text);
  const valid = /^\d{1,3}(\.\d)?$/.test(text.trim()) && value >= 1 && value <= 100;
  return (
    <details className={stock.settings}>
      <summary>{t('adminInventory.recipes.target', { pct: target })}</summary>
      <div className={stock.settingsBody}>
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
                  onSuccess: () =>
                    showToast(t('adminInventory.recipes.targetSaved'), { tone: 'success' }),
                  onError: () => showToast(t('adminInventory.errors.failed'), { tone: 'error' }),
                },
              )
            }
          >
            {t('adminInventory.recipes.targetSave')}
          </Button>
        </div>
      </div>
    </details>
  );
}

/**
 * Every dish and its recipe: how many are linked to ingredients (with a bar), the food cost goal
 * (folded), filters with counts, linked dishes with each size's cost and food cost, and those
 * not linked yet folded below. A dish opens its recipe.
 */
export function RecipesTab() {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const text = useInventoryText();
  const query = useRecipes(branch.id);
  // Dishes an ingredient's price rise touched (managers: it's about money).
  const pricey = new Set(
    (useInventoryDashboard(branch.id, 'branch').data?.priceRises ?? []).flatMap((r) =>
      r.dishes.map((d) => d.slug),
    ),
  );
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
  const matches = (f: RecipeFilter, d: RecipeSummary) =>
    f === 'all' ||
    (f === 'linked' && d.lines > 0) ||
    (f === 'none' && d.lines === 0) ||
    (f === 'over' && d.lines > 0 && worst(d) > foodCostTarget) ||
    (f === 'price' && pricey.has(d.slug)) ||
    (f === 'off' && d.soldOutByStock);
  const counts = Object.fromEntries(
    FILTERS.map((f) => [f, dishes.filter((d) => matches(f, d)).length]),
  ) as Record<RecipeFilter, number>;
  const shown = dishes.filter(
    (d) => (!q || d.name.toLowerCase().includes(q)) && matches(filter, d),
  );
  const linked = shown.filter((d) => d.lines > 0);
  const notLinked = shown.filter((d) => d.lines === 0);
  const share = dishes.length > 0 ? withRecipe / dishes.length : 0;

  const row = (d: RecipeSummary) => (
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
                    t('adminInventory.recipes.portionCost', { amount: text.money(p.cost) }),
                    p.foodCost !== undefined
                      ? t('adminInventory.recipes.foodCost', { pct: p.foodCost })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              ) : null,
            )}
          <span className={styles.actions}>
            {d.lines === 0 && (
              <span className={cx(styles.chip, recipes.addChip)}>
                {findTemplate(d.name, RECIPE_TEMPLATES)
                  ? t('adminInventory.recipes.templateReady')
                  : t('adminInventory.recipes.add')}
              </span>
            )}
            {pricey.has(d.slug) && (
              <span className={cx(styles.chip, styles.out)}>{t('adminInventory.prices.tag')}</span>
            )}
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
  );

  return (
    <>
      <section className={recipes.progress} aria-label={t('adminInventory.recipes.summary')}>
        <div className={recipes.progressText}>
          <strong>
            {t('adminInventory.recipes.coverageValue', { done: withRecipe, total: dishes.length })}
          </strong>
          <span>{t('adminInventory.recipes.coverageHint')}</span>
        </div>
        <span className={recipes.bar} aria-hidden="true">
          <span style={{ width: `${share * 100}%` }} />
        </span>
        {counts.off > 0 && (
          <span className={recipes.offNote}>
            {t.plural('adminInventory.recipes.offNote', counts.off)}
          </span>
        )}
      </section>
      <TargetField key={foodCostTarget} target={foodCostTarget} />
      <SearchField
        value={search}
        onChange={setSearch}
        label={t('adminInventory.recipes.search')}
        placeholder={t('adminInventory.recipes.search')}
      />
      <div className={styles.chips} role="group" aria-label={t('adminInventory.stock.filter')}>
        {FILTERS.filter((f) => f === 'all' || counts[f] > 0 || filter === f).map((f) => (
          <Chip key={f} pressed={filter === f} count={counts[f]} onClick={() => setFilter(f)}>
            {t(`adminInventory.recipes.filters.${f}`)}
          </Chip>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className={styles.muted}>{t('adminInventory.stock.noMatch')}</p>
      ) : (
        <>
          {linked.length > 0 && (
            <section className={recipes.group} aria-labelledby="recipes-linked">
              <h3 id="recipes-linked" className={recipes.groupTitle}>
                {t('adminInventory.recipes.linkedTitle')}
                <span>{linked.length}</span>
              </h3>
              <ul className={styles.list}>{linked.map(row)}</ul>
            </section>
          )}
          {notLinked.length > 0 &&
            (filter === 'none' || q || linked.length === 0 ? (
              <ul className={styles.list}>{notLinked.map(row)}</ul>
            ) : (
              <details className={stock.settings}>
                <summary>
                  {t.plural('adminInventory.recipes.notLinkedTitle', notLinked.length)}
                </summary>
                <div className={stock.settingsBody}>
                  <ul className={styles.list}>{notLinked.map(row)}</ul>
                </div>
              </details>
            ))}
        </>
      )}
      {open && <RecipeDialog slug={open} onClose={() => setOpen(null)} />}
    </>
  );
}
