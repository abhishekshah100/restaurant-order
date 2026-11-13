'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { isApiError } from '@/api/client';
import { api } from '@/api/endpoints';
import { useContent } from '@/api/hooks';
import { refreshAfter } from '@/api/refreshAfter';
import { Button, Icon, Input, Select } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useAdminToken } from '@/hooks/useAdminSession';
import { cx } from '@/lib/cx';
import { sameName } from '@/lib/inventorySetup';
import type { Ingredient, IngredientCategory, InventoryUnit } from '@/types/inventory';
import { useAdminWorkspace } from '../../shell/AdminWorkspace';
import { STARTER_INGREDIENTS, type StarterIngredient } from './starterIngredients';
import styles from './Setup.module.css';

const OWN_UNITS: readonly InventoryUnit[] = ['kg', 'g', 'l', 'ml', 'pc', 'dozen'];
const OWN_CATEGORY = '';

interface Pick extends StarterIngredient {
  /** The category it's saved in (none for "your own"). */
  category: string;
}

/**
 * Step ①: tick ingredients from a ready list (grouped as a kitchen buys them) and add your own;
 * those already added show as Added. They're saved one by one (a category is made the first time
 * it's needed), then everything is read again once.
 */
export function IngredientsStep({
  ingredients,
  categories,
  onDone,
}: {
  ingredients: readonly Ingredient[];
  categories: readonly IngredientCategory[];
  onDone: () => void;
}) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const token = useAdminToken();
  const client = useQueryClient();
  const { showToast } = useToast();
  const [ticked, setTicked] = useState<Pick[]>([]);
  const [own, setOwn] = useState<Pick[]>([]);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<InventoryUnit>('kg');
  const [ownError, setOwnError] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [tried, setTried] = useState(false);

  // Ingredients are the restaurant's; each branch tracks its own. One the restaurant has but
  // this branch doesn't track yet is ticked to start tracking it here.
  const existing = (n: string) => ingredients.find((i) => sameName(i.name, n));
  const added = (n: string) => existing(n)?.tracked ?? false;
  const starterNames = STARTER_INGREDIENTS.flatMap((g) => g.items.map((i) => i.name));
  const elsewhere = ingredients.filter(
    (i) => !i.tracked && !starterNames.some((n) => sameName(n, i.name)),
  );
  const tracked = ingredients.filter((i) => i.tracked).length;
  const isTicked = (n: string) => ticked.some((p) => sameName(p.name, n));
  const toggle = (pick: Pick) =>
    setTicked((list) =>
      isTicked(pick.name) ? list.filter((p) => !sameName(p.name, pick.name)) : [...list, pick],
    );
  const addOwn = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    // Already on a list: tick it there instead (unless it's already tracked here).
    const starter = STARTER_INGREDIENTS.flatMap((g) =>
      g.items.map((i) => ({ ...i, category: g.category })),
    ).find((i) => sameName(i.name, trimmed));
    const theirs = existing(trimmed);
    if (added(trimmed) || own.some((i) => sameName(i.name, trimmed))) {
      setOwnError(t('adminInventory.setup.ingredients.ownDuplicate', { name: trimmed }));
      return;
    }
    if (starter || theirs) {
      const known = starter ?? {
        name: theirs?.name ?? trimmed,
        unit: theirs?.unit ?? unit,
        category: '',
      };
      if (!isTicked(known.name)) setTicked((list) => [...list, known]);
      setName('');
      setOwnError('');
      return;
    }
    const pick = { name: trimmed, unit, category: OWN_CATEGORY };
    setOwn((list) => [...list, pick]);
    setTicked((list) => [...list, pick]);
    setName('');
    setOwnError('');
  };

  const save = async () => {
    setTried(true);
    if (!token || ticked.length === 0) return;
    const chosen = ticked.filter((p) => !added(p.name));
    setProgress({ done: 0, total: chosen.length });
    const categoryIds = new Map(categories.map((c) => [c.name.toLocaleLowerCase(), c.id]));
    let saved = 0;
    try {
      for (const [index, pick] of chosen.entries()) {
        let categoryId: string | null = null;
        if (pick.category && !existing(pick.name)) {
          const known = categoryIds.get(pick.category.toLocaleLowerCase());
          if (known) categoryId = known;
          else {
            const made = await api.createIngredientCategory(token, branch.id, pick.category);
            categoryIds.set(pick.category.toLocaleLowerCase(), made.id);
            categoryId = made.id;
          }
        }
        try {
          const theirs = existing(pick.name);
          if (theirs) {
            await api.updateInventoryItem(token, branch.id, theirs.id, { tracked: true });
          } else {
            await api.createIngredient(token, branch.id, {
              name: pick.name,
              unit: pick.unit,
              categoryId,
              track: true,
            });
          }
          saved += 1;
        } catch (error) {
          // Already there (another device, or a name typed twice): nothing to add.
          if (!isApiError(error, 'name_taken')) {
            showToast(t('adminInventory.setup.ingredients.failed', { name: pick.name }), {
              tone: 'error',
            });
            return;
          }
        }
        setProgress({ done: index + 1, total: chosen.length });
      }
      showToast(t.plural('adminInventory.setup.ingredients.savedToast', saved), {
        tone: 'success',
      });
      setTicked([]);
      setOwn([]);
      onDone();
    } finally {
      setProgress(null);
      await refreshAfter(client, 'stockChanged', branch.id);
    }
  };

  const chip = (pick: Pick) => {
    const done = added(pick.name);
    const on = done || isTicked(pick.name);
    return (
      <button
        key={pick.name}
        type="button"
        className={cx(styles.pick, on && styles.pickOn, done && styles.pickDone)}
        aria-pressed={on}
        disabled={done || progress !== null}
        onClick={() => toggle(pick)}
      >
        <span className={styles.pickBox} aria-hidden="true">
          {on && <Icon name="check" size="xs" />}
        </span>
        <span>{pick.name}</span>
        <span className={styles.pickUnit}>
          {done
            ? t('adminInventory.setup.ingredients.added')
            : t(`adminInventory.units.${existing(pick.name)?.unit ?? pick.unit}`)}
        </span>
      </button>
    );
  };

  const toAdd = ticked.filter((p) => !added(p.name)).length;
  return (
    <div className={styles.stepBody}>
      <p className={styles.lead}>{t('adminInventory.setup.ingredients.body')}</p>
      {tracked > 0 && (
        <p className={styles.note}>
          <Icon name="checkc" size="xs" />
          {t.plural('adminInventory.setup.ingredients.have', tracked)}
        </p>
      )}
      {elsewhere.length > 0 && (
        <section className={styles.group} aria-labelledby="setup-yours">
          <h3 id="setup-yours" className={styles.groupTitle}>
            {t('adminInventory.setup.ingredients.yours')}
          </h3>
          <div className={styles.picks}>
            {elsewhere.map((i) => chip({ name: i.name, unit: i.unit, category: '' }))}
          </div>
        </section>
      )}
      {STARTER_INGREDIENTS.map((group) => (
        <section key={group.category} className={styles.group} aria-label={group.category}>
          <h3 className={styles.groupTitle}>{group.category}</h3>
          <div className={styles.picks}>
            {group.items.map((item) => chip({ ...item, category: group.category }))}
          </div>
        </section>
      ))}
      <section className={styles.group} aria-labelledby="setup-own">
        <h3 id="setup-own" className={styles.groupTitle}>
          {t('adminInventory.setup.ingredients.own')}
        </h3>
        {own.length > 0 && <div className={styles.picks}>{own.map(chip)}</div>}
        <div className={styles.ownRow}>
          <Input
            id="setup-own-name"
            label={t('adminInventory.setup.ingredients.ownName')}
            placeholder={t('adminInventory.setup.ingredients.ownNamePlaceholder')}
            value={name}
            maxLength={80}
            error={ownError || undefined}
            onChange={(event) => {
              setName(event.target.value);
              setOwnError('');
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addOwn();
              }
            }}
          />
          <Select
            id="setup-own-unit"
            label={t('adminInventory.setup.ingredients.ownUnit')}
            value={unit}
            onChange={(event) => setUnit(event.target.value as InventoryUnit)}
          >
            {OWN_UNITS.map((u) => (
              <option key={u} value={u}>
                {t(`adminInventory.unitNames.${u}`)}
              </option>
            ))}
          </Select>
          <Button variant="secondary" iconStart="plus" onClick={addOwn} disabled={!name.trim()}>
            {t('adminInventory.setup.ingredients.ownAdd')}
          </Button>
        </div>
      </section>

      <div className={styles.footer}>
        <span className={styles.footerNote} role="status">
          {progress
            ? t('adminInventory.setup.ingredients.saving', progress)
            : tried && toAdd === 0
              ? t('adminInventory.setup.ingredients.none')
              : t.plural('adminInventory.setup.ingredients.chosen', toAdd)}
        </span>
        <div className={styles.footerActions}>
          {tracked > 0 && toAdd === 0 && (
            <Button variant="secondary" iconEnd="arrow" onClick={onDone}>
              {t('adminInventory.setup.next')}
            </Button>
          )}
          {!(tracked > 0 && toAdd === 0) && (
            <Button
              iconStart="plus"
              loading={progress !== null}
              disabled={toAdd === 0}
              onClick={() => void save()}
            >
              {t.plural('adminInventory.setup.ingredients.save', toAdd)}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
