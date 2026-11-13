'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Fragment, useMemo, useState } from 'react';
import { useContent, useIngredients, useInventoryStock, useRecipe, useRecipes } from '@/api/hooks';
import { recipeQuery } from '@/api/queries';
import { useAdminToken } from '@/hooks/useAdminSession';
import { applyTemplate, findTemplate, sizeFactor } from '@/lib/recipeTemplates';
import { RECIPE_TEMPLATES } from './recipeTemplateList';
import { useSaveRecipe } from '@/api/mutations';
import { Button, Dialog, IconButton, Input, Select } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { cx } from '@/lib/cx';
import { UNITS, parseQuantity, quantityText, unitsLike } from '@/lib/inventory';
import type {
  Ingredient,
  InventoryUnit,
  RecipeLineInput,
  RecipePart,
  RecipeResponse,
} from '@/types/inventory';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { useInventoryText } from './useInventoryText';
import styles from './Inventory.module.css';
import quick from './RecipeQuick.module.css';

interface Draft {
  key: number;
  part: RecipePart;
  code: string;
  choice: string;
  ingredientId: string;
  quantity: string;
  unit: InventoryUnit | '';
}

/** A part of the dish whose lines are edited together. */
interface Section {
  id: string;
  part: RecipePart;
  code: string;
  choice: string;
  title: string;
  hint?: string;
  /** A size: it can use the dish's recipe or its own. */
  size?: { price: number };
}

let nextKey = 1;
const sectionId = (part: string, code = '', choice = '') => `${part}|${code}|${choice}`;

/** The saved recipe as editable lines (lines whose part is gone are left out: they'd be refused). */
const draftsOf = (recipe: RecipeResponse): Draft[] =>
  recipe.lines
    .filter((l) => !l.unknown)
    .map((l) => ({
      key: nextKey++,
      part: l.part,
      code: l.code ?? '',
      choice: l.choice ?? '',
      ingredientId: l.ingredientId,
      quantity: quantityText(l.quantity),
      unit: l.unit,
    }));

function sectionsOf(recipe: RecipeResponse, t: ReturnType<typeof useContent<'common'>>): Section[] {
  const { dish } = recipe;
  return [
    {
      id: sectionId('dish'),
      part: 'dish',
      code: '',
      choice: '',
      title: t('adminInventory.recipes.every'),
      hint: dish.sizes.length > 0 ? t('adminInventory.recipes.everySizes') : undefined,
    },
    ...dish.sizes.map((s) => ({
      id: sectionId('size', s.code),
      part: 'size' as const,
      code: s.code,
      choice: '',
      title: t('adminInventory.recipes.size', { name: s.name }),
      size: { price: s.price },
    })),
    ...dish.addOns.map((a) => ({
      id: sectionId('addon', a.code),
      part: 'addon' as const,
      code: a.code,
      choice: '',
      title: t('adminInventory.recipes.addOn', { name: a.name }),
    })),
    ...dish.options.flatMap((g) =>
      g.choices.map((c) => ({
        id: sectionId('choice', g.code, c.name),
        part: 'choice' as const,
        code: g.code,
        choice: c.name,
        title: t('adminInventory.recipes.choice', { group: g.name, name: c.name }),
      })),
    ),
    ...dish.removables.map((r) => ({
      id: sectionId('removal', r.code),
      part: 'removal' as const,
      code: r.code,
      choice: '',
      title: t('adminInventory.recipes.removal', { name: r.name }),
      hint: t('adminInventory.recipes.removalHint'),
    })),
  ];
}

/**
 * A dish's recipe: what every portion uses, a size's own recipe (else it uses the dish's), what
 * each add-on and option adds and each leave-out takes off. What a portion costs and its food
 * cost show as it's edited (managers), from today's average costs.
 */
function RecipeEditor({ recipe, onClose }: { recipe: RecipeResponse; onClose: () => void }) {
  const t = useContent('common');
  const { branch, money } = useAdminWorkspace();
  const text = useInventoryText();
  const { showToast } = useToast();
  const save = useSaveRecipe();
  const ingredientData = useIngredients(branch.id).data;
  const stockData = useInventoryStock(branch.id).data;
  const ingredients = useMemo(() => ingredientData?.ingredients ?? [], [ingredientData]);
  const [lines, setLines] = useState<Draft[]>(() => draftsOf(recipe));
  const [tried, setTried] = useState(false);
  const [extras, setExtras] = useState(() =>
    recipe.lines.some((l) => !['dish', 'size'].includes(l.part)),
  );
  const sections = useMemo(() => sectionsOf(recipe, t), [recipe, t]);
  const byId = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);
  const costs = useMemo(
    () =>
      new Map(
        (stockData?.items ?? []).flatMap((s) =>
          s.cost !== undefined ? [[s.ingredientId, s]] : [],
        ),
      ),
    [stockData],
  );
  const dropped = recipe.lines.filter((l) => l.unknown).length;
  const token = useAdminToken();
  const client = useQueryClient();
  const others = (useRecipes(branch.id).data?.dishes ?? []).filter(
    (d) => d.lines > 0 && d.slug !== recipe.dish.slug,
  );
  const template = findTemplate(recipe.dish.name, RECIPE_TEMPLATES);
  // What a quick start did: filled in, and what it couldn't (ingredients not added yet).
  const [notice, setNotice] = useState<{ missing: string[] } | null>(null);
  const [copying, setCopying] = useState(false);
  /** The biggest size: templates are for a full plate. */
  const fullSize = [...recipe.dish.sizes].sort(
    (a, b) =>
      (sizeFactor(b, { name: 'Full', price: 0 }) || b.price) -
      (sizeFactor(a, { name: 'Full', price: 0 }) || a.price),
  )[0];
  const asDrafts = (
    section: { part: RecipePart; code: string },
    ls: readonly { ingredientId: string; quantity: number; unit?: InventoryUnit | '' }[],
  ): Draft[] =>
    ls.map((l) => ({
      key: nextKey++,
      part: section.part,
      code: section.code,
      choice: '',
      ingredientId: l.ingredientId,
      quantity: quantityText(l.quantity),
      unit: l.unit ?? '',
    }));
  /** Replaces what every plate and each size use (add-ons and options stay). */
  const replaceMain = (next: Draft[]) =>
    setLines((all) => [...all.filter((l) => l.part !== 'dish' && l.part !== 'size'), ...next]);

  const fillTemplate = () => {
    if (!template) return;
    if (recipe.dish.sizes.length > 0 && fullSize) {
      const missing = new Set<string>();
      const next = recipe.dish.sizes.flatMap((size) => {
        const result = applyTemplate(template, ingredients, sizeFactor(size, fullSize));
        result.missing.forEach((m) => missing.add(m));
        return asDrafts({ part: 'size', code: size.code }, result.lines);
      });
      replaceMain(next);
      setNotice({ missing: [...missing] });
    } else {
      const result = applyTemplate(template, ingredients);
      replaceMain(asDrafts({ part: 'dish', code: '' }, result.lines));
      setNotice({ missing: result.missing });
    }
  };

  const copyFrom = async (slug: string) => {
    if (!slug) return;
    setCopying(true);
    try {
      const source = await client.fetchQuery(recipeQuery(token, branch.id, slug));
      const known = source.lines.filter((l) => !l.unknown);
      const dishLines = known.filter((l) => l.part === 'dish');
      // No recipe for every plate: the biggest size's.
      const biggest = [...source.dish.sizes].sort((a, b) => b.price - a.price)[0];
      const from =
        dishLines.length > 0
          ? dishLines
          : known.filter((l) => l.part === 'size' && l.code === biggest?.code);
      replaceMain(asDrafts({ part: 'dish', code: '' }, from));
      setNotice({ missing: [] });
    } catch {
      showToast(t('adminInventory.errors.failed'), { tone: 'error' });
    } finally {
      setCopying(false);
    }
  };

  const update = (key: number, change: Partial<Draft>) =>
    setLines((all) => all.map((l) => (l.key === key ? { ...l, ...change } : l)));
  const add = (s: Section, from: Partial<Draft> = {}) =>
    setLines((all) => [
      ...all,
      {
        key: nextKey++,
        part: s.part,
        code: s.code,
        choice: s.choice,
        ingredientId: '',
        quantity: '',
        unit: '',
        ...from,
      },
    ]);
  const inSection = (s: Section) =>
    lines.filter((l) => l.part === s.part && l.code === s.code && l.choice === s.choice);

  /** A line's cost (minor units), when its ingredient's cost is known. */
  const lineCost = (l: Draft): number | null => {
    const item = costs.get(l.ingredientId);
    const quantity = parseQuantity(l.quantity);
    if (!item || item.cost === undefined || quantity === null) return null;
    const unit = l.unit || item.unit;
    const inOwn = (quantity * UNITS[unit].factor) / UNITS[item.unit].factor;
    return inOwn * item.cost * money.minorUnit;
  };
  const costOfLines = (ls: readonly Draft[]) => ls.reduce((sum, l) => sum + (lineCost(l) ?? 0), 0);
  const base = sections[0] as Section;
  /** A portion of the dish, or of a size (its own lines, else the dish's). */
  const portionCost = (s?: Section) => {
    const own = s ? inSection(s) : [];
    return costOfLines(own.length > 0 ? own : inSection(base));
  };
  const showCosts = recipe.portions !== undefined;
  const foodCost = (costMinor: number, price: number) => {
    if (price <= 0) return null;
    const pct = Math.round((costMinor / (price * money.minorUnit)) * 1000) / 10;
    return (
      <span className={cx(styles.chip, pct > recipe.foodCostTarget ? styles.out : styles.ok)}>
        {t('adminInventory.recipes.foodCost', { pct })}
      </span>
    );
  };

  const problems = new Map(
    lines.map((l) => {
      const q = parseQuantity(l.quantity);
      return [l.key, !l.ingredientId ? 'ingredient' : q === null || q <= 0 ? 'quantity' : null];
    }),
  );
  const duplicate = (l: Draft) =>
    lines.some(
      (o) =>
        o.key !== l.key &&
        o.ingredientId === l.ingredientId &&
        o.part === l.part &&
        o.code === l.code &&
        o.choice === l.choice,
    );
  const ready = lines.every((l) => problems.get(l.key) === null && !duplicate(l));

  const submit = () => {
    setTried(true);
    if (!ready) return;
    const body: RecipeLineInput[] = lines.map((l) => ({
      part: l.part,
      ...(l.code ? { code: l.code } : {}),
      ...(l.choice ? { choice: l.choice } : {}),
      ingredientId: l.ingredientId,
      quantity: parseQuantity(l.quantity) ?? 0,
      ...(l.unit ? { unit: l.unit } : {}),
    }));
    save.mutate(
      { branchId: branch.id, slug: recipe.dish.slug, lines: body },
      {
        onSuccess: () => {
          showToast(t('adminInventory.recipes.saved', { name: recipe.dish.name }), {
            tone: 'success',
          });
          onClose();
        },
        onError: () => showToast(t('adminInventory.errors.failed'), { tone: 'error' }),
      },
    );
  };

  const renderLine = (l: Draft) => {
    const ingredient: Ingredient | undefined = byId.get(l.ingredientId);
    const problem = tried ? problems.get(l.key) : null;
    const cost = showCosts ? lineCost(l) : null;
    return (
      <div key={l.key} className={styles.ingredientLine}>
        <Select
          id={`recipe-${l.key}-ingredient`}
          label={t('adminInventory.entry.ingredient')}
          value={l.ingredientId}
          error={
            problem === 'ingredient'
              ? t('adminInventory.entry.pick')
              : tried && duplicate(l)
                ? t('adminInventory.recipes.twice')
                : undefined
          }
          onChange={(event) => update(l.key, { ingredientId: event.target.value, unit: '' })}
        >
          <option value="" disabled>
            {t('adminInventory.entry.pickPlaceholder')}
          </option>
          {ingredients.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </Select>
        <Input
          id={`recipe-${l.key}-quantity`}
          label={t('adminInventory.recipes.perPortion')}
          inputMode="decimal"
          autoComplete="off"
          value={l.quantity}
          hint={cost !== null ? money.formatMinor(Math.round(cost)) : undefined}
          error={problem === 'quantity' ? t('adminInventory.entry.quantityError') : undefined}
          onChange={(event) => update(l.key, { quantity: event.target.value })}
        />
        {ingredient && (
          <Select
            id={`recipe-${l.key}-unit`}
            label={t('adminInventory.entry.in')}
            value={l.unit || ingredient.unit}
            onChange={(event) => update(l.key, { unit: event.target.value as InventoryUnit })}
          >
            {unitsLike(ingredient.unit).map((u) => (
              <option key={u} value={u}>
                {text.unit(u)}
              </option>
            ))}
          </Select>
        )}
        <IconButton
          icon="trash"
          label={t('adminInventory.recipes.removeLine')}
          onClick={() => setLines((all) => all.filter((o) => o.key !== l.key))}
        />
      </div>
    );
  };

  const renderSection = (s: Section) => {
    const own = inSection(s);
    return (
      <section key={s.id} className={styles.line} aria-label={s.title}>
        <div className={styles.lineHead}>
          <h3 className={styles.label}>{s.title}</h3>
          {showCosts && (s.part === 'dish' || s.part === 'size') && (
            <span className={styles.actions}>
              <span className={styles.muted}>
                {money.formatMinor(Math.round(portionCost(s.part === 'size' ? s : undefined)))}
              </span>
              {s.size
                ? foodCost(portionCost(s), s.size.price)
                : recipe.dish.sizes.length === 0 && recipe.dish.price !== undefined
                  ? foodCost(portionCost(), recipe.dish.price)
                  : null}
            </span>
          )}
        </div>
        {s.hint && <p className={styles.muted}>{s.hint}</p>}
        {s.part === 'size' && own.length === 0 ? (
          <>
            <p className={styles.muted}>{t('adminInventory.recipes.usesBase')}</p>
            <Button
              variant="ghost"
              iconStart="copy"
              onClick={() =>
                inSection(base).forEach((b) =>
                  add(s, { ingredientId: b.ingredientId, quantity: b.quantity, unit: b.unit }),
                )
              }
            >
              {t('adminInventory.recipes.ownRecipe')}
            </Button>
            {(() => {
              // Another size with its own recipe: fill this one from it, scaled (Half = ½ Full).
              const from = main.find(
                (o) => o.part === 'size' && o.code !== s.code && inSection(o).length > 0,
              );
              const fromSize = recipe.dish.sizes.find((z) => z.code === from?.code);
              const thisSize = recipe.dish.sizes.find((z) => z.code === s.code);
              if (!from || !fromSize || !thisSize) return null;
              const factor = sizeFactor(thisSize, fromSize);
              return (
                <Button
                  variant="ghost"
                  iconStart="copy"
                  onClick={() =>
                    inSection(from).forEach((b) => {
                      const q = parseQuantity(b.quantity);
                      add(s, {
                        ingredientId: b.ingredientId,
                        quantity:
                          q === null
                            ? b.quantity
                            : quantityText(Math.round(q * factor * 1000) / 1000),
                        unit: b.unit,
                      });
                    })
                  }
                >
                  {t('adminInventory.recipes.scaleFrom', { name: fromSize.name, factor })}
                </Button>
              );
            })()}
          </>
        ) : (
          own.map(renderLine)
        )}
        <Button variant="ghost" iconStart="plus" onClick={() => add(s)}>
          {t('adminInventory.recipes.addLine')}
        </Button>
      </section>
    );
  };

  const main = sections.filter((s) => s.part === 'dish' || s.part === 'size');
  const rest = sections.filter((s) => s.part !== 'dish' && s.part !== 'size');

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminInventory.recipes.title', { name: recipe.dish.name })}
      description={t('adminInventory.recipes.body')}
      footer={
        <Button block iconStart="check" loading={save.isPending} onClick={submit}>
          {t('adminInventory.recipes.save')}
        </Button>
      }
    >
      <div className={styles.form}>
        {dropped > 0 && (
          <p className={styles.error}>{t.plural('adminInventory.recipes.dropped', dropped)}</p>
        )}
        {showCosts && (
          <p className={styles.muted}>
            {t('adminInventory.recipes.targetLine', { pct: recipe.foodCostTarget })}
          </p>
        )}
        {(template || others.length > 0) && (
          <section className={quick.start} aria-labelledby="recipe-quick">
            <h3 id="recipe-quick" className={quick.startTitle}>
              {t('adminInventory.recipes.quickStart')}
            </h3>
            <div className={quick.startActions}>
              {template && (
                <Button iconStart="sparkle" onClick={fillTemplate}>
                  {t('adminInventory.recipes.useTemplate', { name: template.dishes[0] ?? '' })}
                </Button>
              )}
              {others.length > 0 && (
                <Select
                  id="recipe-copy"
                  label={t('adminInventory.recipes.copyFrom')}
                  value=""
                  disabled={copying}
                  onChange={(event) => void copyFrom(event.target.value)}
                >
                  <option value="" disabled>
                    {t('adminInventory.recipes.copyPick')}
                  </option>
                  {others.map((d) => (
                    <option key={d.slug} value={d.slug}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              )}
            </div>
            {notice && (
              <p className={quick.notice} role="status">
                {t('adminInventory.recipes.filled')}
                {notice.missing.length > 0 &&
                  ` ${t('adminInventory.recipes.missing', { names: notice.missing.join(', ') })}`}
              </p>
            )}
          </section>
        )}
        {main.map(renderSection)}
        {rest.length > 0 &&
          (extras ? (
            <Fragment>{rest.map(renderSection)}</Fragment>
          ) : (
            <button type="button" className={styles.linkButton} onClick={() => setExtras(true)}>
              {t('adminInventory.recipes.showExtras', { count: rest.length })}
            </button>
          ))}
      </div>
    </Dialog>
  );
}

/** A dish's recipe, read first (GET …/inventory/recipes/:dishSlug). */
export function RecipeDialog({ slug, onClose }: { slug: string; onClose: () => void }) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const query = useRecipe(branch.id, slug);
  if (!query.data) {
    return (
      <Dialog open onClose={onClose} presentation="adaptive" title={t('adminInventory.loading')}>
        <p className={styles.muted} aria-busy={!query.isError}>
          {query.isError ? t('adminInventory.failed') : t('adminInventory.loading')}
        </p>
      </Dialog>
    );
  }
  return <RecipeEditor key={slug} recipe={query.data} onClose={onClose} />;
}
