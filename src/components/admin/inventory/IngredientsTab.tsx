'use client';

import { useState } from 'react';
import { isApiError } from '@/api/client';
import { useContent, useIngredients } from '@/api/hooks';
import {
  useCreateIngredientCategory,
  useDeleteIngredientCategory,
  useRenameIngredientCategory,
} from '@/api/mutations';
import { Button, Dialog, IconButton, Input, SearchField } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import type { Ingredient, IngredientCategory } from '@/types/inventory';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { IngredientDialog } from './IngredientDialog';
import { useInventoryText } from './useInventoryText';
import styles from './Inventory.module.css';

/** The restaurant's ingredient categories: added, renamed, removed (ingredients stay). */
function CategoriesDialog({
  categories,
  onClose,
}: {
  categories: readonly IngredientCategory[];
  onClose: () => void;
}) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const { showToast } = useToast();
  const create = useCreateIngredientCategory();
  const rename = useRenameIngredientCategory();
  const remove = useDeleteIngredientCategory();
  const [name, setName] = useState('');
  const [names, setNames] = useState<Record<string, string>>({});
  const failed = (error: unknown) =>
    showToast(
      isApiError(error, 'name_taken')
        ? t('adminInventory.errors.nameTaken')
        : t('adminInventory.errors.failed'),
      { tone: 'error' },
    );

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminInventory.categories.title')}
      description={t('adminInventory.categories.body')}
    >
      <div className={styles.form}>
        {categories.map((c) => {
          const draft = names[c.id] ?? c.name;
          return (
            <div key={c.id} className={styles.fieldRow}>
              <Input
                id={`category-${c.id}`}
                label={t('adminInventory.categories.name')}
                hideLabel
                maxLength={60}
                value={draft}
                onChange={(event) => setNames((all) => ({ ...all, [c.id]: event.target.value }))}
                onBlur={() => {
                  if (draft.trim() && draft.trim() !== c.name) {
                    rename.mutate(
                      { branchId: branch.id, id: c.id, name: draft.trim() },
                      { onError: failed },
                    );
                  }
                }}
              />
              <IconButton
                icon="trash"
                label={t('adminInventory.categories.remove', { name: c.name })}
                onClick={() =>
                  remove.mutate({ branchId: branch.id, id: c.id }, { onError: failed })
                }
              />
            </div>
          );
        })}
        <div className={styles.fieldRow}>
          <Input
            id="category-new"
            label={t('adminInventory.categories.new')}
            placeholder={t('adminInventory.categories.placeholder')}
            maxLength={60}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Button
            variant="secondary"
            iconStart="plus"
            disabled={!name.trim()}
            loading={create.isPending}
            onClick={() =>
              create.mutate(
                { branchId: branch.id, name: name.trim() },
                { onSuccess: () => setName(''), onError: failed },
              )
            }
          >
            {t('adminInventory.categories.add')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/**
 * The restaurant's ingredients, shared by every branch, by category: whether this branch tracks
 * each, its unit and packs. Managers add and change them here; categories have their own dialog.
 */
export function IngredientsTab() {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const text = useInventoryText();
  const query = useIngredients(branch.id);
  const [editing, setEditing] = useState<Ingredient | 'new' | null>(null);
  const [managing, setManaging] = useState(false);
  const [search, setSearch] = useState('');

  if (!query.data) {
    return (
      <p className={styles.muted} aria-busy={!query.isError}>
        {query.isError ? t('adminInventory.failed') : t('adminInventory.loading')}
      </p>
    );
  }
  const { categories, ingredients } = query.data;
  const q = search.trim().toLowerCase();
  const shown = ingredients.filter(
    (i) => !q || i.name.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q),
  );
  const groups = [
    ...categories.map((c) => ({ id: c.id, name: c.name })),
    { id: null, name: t('adminInventory.stock.noCategory') },
  ]
    .map((g) => ({ ...g, items: shown.filter((i) => i.categoryId === g.id) }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      <p className={styles.muted}>{t('adminInventory.ingredients.shared')}</p>
      <div className={styles.actions}>
        <Button iconStart="plus" onClick={() => setEditing('new')}>
          {t('adminInventory.ingredients.new')}
        </Button>
        <Button variant="secondary" iconStart="list" onClick={() => setManaging(true)}>
          {t('adminInventory.categories.title')}
        </Button>
      </div>
      {ingredients.length === 0 ? (
        <div className={styles.card}>
          <p>{t('adminInventory.ingredients.empty')}</p>
        </div>
      ) : (
        <>
          <SearchField
            value={search}
            onChange={setSearch}
            label={t('adminInventory.stock.search')}
            placeholder={t('adminInventory.stock.searchPlaceholder')}
          />
          {groups.length === 0 ? (
            <p className={styles.muted}>{t('adminInventory.stock.noMatch')}</p>
          ) : (
            groups.map((g) => (
              <section key={g.id ?? 'none'} className={styles.list} aria-label={g.name}>
                <h3 className={styles.groupTitle}>{g.name}</h3>
                {g.items.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    className={styles.row}
                    onClick={() => setEditing(i)}
                  >
                    <span className={styles.rowMain}>
                      <span className={styles.rowName}>{i.name}</span>
                      <span className={styles.muted}>
                        {[
                          t(`adminInventory.unitNames.${i.unit}`),
                          i.prep ? t('adminInventory.prep.badge') : null,
                          ...i.packs.map((p) =>
                            t('adminInventory.packOption', {
                              name: p.name,
                              quantity: text.quantity(p.quantity, i.unit),
                            }),
                          ),
                          i.sku,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    <span className={styles.rowSide}>
                      <span className={styles.muted}>
                        {i.tracked
                          ? t('adminInventory.ingredients.tracked')
                          : t('adminInventory.ingredients.notTracked')}
                      </span>
                    </span>
                  </button>
                ))}
              </section>
            ))
          )}
        </>
      )}
      {editing && (
        <IngredientDialog
          ingredient={editing === 'new' ? undefined : editing}
          categories={categories}
          ingredients={ingredients}
          onClose={() => setEditing(null)}
        />
      )}
      {managing && <CategoriesDialog categories={categories} onClose={() => setManaging(false)} />}
    </>
  );
}
