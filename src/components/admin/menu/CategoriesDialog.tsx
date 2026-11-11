'use client';

import { useState } from 'react';
import { useContent } from '@/api/hooks';
import { useCategoryChange, useUpdateCategories } from '@/api/mutations';
import { Button, Dialog, Icon, Input, Select } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { moveItem } from '@/lib/adminMenu';
import type { MenuCatalog } from '@/lib/menu';
import type { Category } from '@/types/menu';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { RowButtons } from './editor/parts';
import styles from './CategoriesDialog.module.css';

type Row = Pick<Category, 'id' | 'name' | 'description'> & { shortName: string };

const rowOf = (c: Category): Row => ({
  id: c.id,
  name: c.name,
  shortName: c.shortName ?? '',
  description: c.description,
});

/**
 * Categories, the sections guests see. One category is a simple menu: guests see one list, and
 * here it says so, with Add category to split it up. With more: each one's name, order and how
 * many dishes it holds; Details (short name for phone tabs, description); Delete (its dishes
 * moved to another first; the last one stays). Add and Delete are saved at once; names and order
 * with Save. Edits not saved yet are kept while categories come and go.
 */
export function CategoriesDialog({ menu, onClose }: { menu: MenuCatalog; onClose: () => void }) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const { showToast } = useToast();
  const update = useUpdateCategories();
  const change = useCategoryChange();
  const categories = menu.categories;
  const [edits, setEdits] = useState<Row[]>(() => categories.map(rowOf));
  const [open, setOpen] = useState<string | null>(null);
  const [removing, setRemoving] = useState<{ id: string; moveTo: string } | null>(null);
  const [newName, setNewName] = useState('');
  const [drinks, setDrinks] = useState(false);
  const [tried, setTried] = useState(false);

  // The categories as they are now, in the order being edited (new ones last, gone ones out).
  const rows: Row[] = [
    ...edits.filter((r) => categories.some((c) => c.id === r.id)),
    ...categories.filter((c) => !edits.some((r) => r.id === c.id)).map(rowOf),
  ];
  const simple = rows.length === 1;
  const names = rows.map((r) => r.name.trim().toLowerCase());
  const invalid = names.some((n) => !n) || new Set(names).size !== names.length;
  const changed = rows.some((r, i) => {
    const c = categories[i];
    return (
      !c ||
      c.id !== r.id ||
      c.name !== r.name ||
      (c.shortName ?? '') !== r.shortName ||
      c.description !== r.description
    );
  });
  const setRow = (id: string, fields: Partial<Row>) =>
    setEdits(rows.map((r) => (r.id === id ? { ...r, ...fields } : r)));
  const count = (id: string) => menu.dishesIn(id).length;
  const taken = names.includes(newName.trim().toLowerCase());
  const failed = () => showToast(t('adminMenu.failed'), { tone: 'error' });

  const save = () => {
    setTried(true);
    if (invalid) return;
    update.mutate(
      {
        branchId: branch.id,
        body: {
          categories: rows.map((r) => ({
            id: r.id,
            name: r.name.trim(),
            description: r.description.trim(),
            ...(r.shortName.trim() ? { shortName: r.shortName.trim() } : {}),
          })),
        },
      },
      {
        onSuccess: () => {
          showToast(t('adminMenu.categoriesDialog.saved'), { tone: 'success' });
          onClose();
        },
        onError: failed,
      },
    );
  };

  const add = () => {
    const name = newName.trim();
    if (!name || taken) return;
    change.mutate(
      { branchId: branch.id, add: { name, ...(drinks ? { drinks: true } : {}) } },
      {
        onSuccess: () => {
          setNewName('');
          setDrinks(false);
          showToast(t('adminMenu.categoriesDialog.added', { name }), { tone: 'success' });
        },
        onError: failed,
      },
    );
  };

  const remove = (row: Row) => {
    const dishes = count(row.id);
    const moveTo = removing?.moveTo;
    if (dishes > 0 && !moveTo) return;
    change.mutate(
      { branchId: branch.id, remove: row.id, ...(dishes > 0 && moveTo ? { moveTo } : {}) },
      {
        onSuccess: () => {
          setRemoving(null);
          showToast(t('adminMenu.categoriesDialog.removed', { name: row.name }), {
            tone: 'success',
          });
        },
        onError: failed,
      },
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="panel"
      className={styles.dialog}
      title={t('adminMenu.categoriesDialog.title')}
      description={
        simple
          ? t('adminMenu.categoriesDialog.subtitleSimple')
          : t('adminMenu.categoriesDialog.subtitle')
      }
      footer={
        !simple && changed ? (
          <Button block iconStart="check" loading={update.isPending} onClick={save}>
            {t('adminMenu.categoriesDialog.save')}
          </Button>
        ) : undefined
      }
    >
      <div className={styles.body}>
        {simple ? (
          <div className={styles.simple}>
            <span className={styles.simpleIcon} aria-hidden="true">
              <Icon name="list" size="md" />
            </span>
            <p className={styles.simpleTitle}>{t('adminMenu.categoriesDialog.simpleTitle')}</p>
            <p className={styles.simpleBody}>
              {t('adminMenu.categoriesDialog.simpleBody', { count: count(rows[0]?.id ?? '') })}
            </p>
          </div>
        ) : (
          <ol className={styles.list}>
            {rows.map((row, index) => {
              const dishes = count(row.id);
              const deleting = removing?.id === row.id;
              const others = rows.filter((r) => r.id !== row.id);
              return (
                <li key={row.id} className={styles.row} data-removing={deleting || undefined}>
                  <div className={styles.head}>
                    <span className={styles.position}>{index + 1}</span>
                    <Input
                      id={`category-${row.id}-name`}
                      label={t('adminMenu.categoriesDialog.name')}
                      hideLabel
                      value={row.name}
                      maxLength={40}
                      error={
                        tried && !row.name.trim()
                          ? t('adminMenu.categoriesDialog.errors')
                          : undefined
                      }
                      onChange={(event) => setRow(row.id, { name: event.target.value })}
                    />
                    <RowButtons
                      name={row.name || row.id}
                      first={index === 0}
                      last={index === rows.length - 1}
                      onMove={(by) => setEdits(moveItem(rows, index, by))}
                    />
                  </div>
                  <div className={styles.meta}>
                    <span className={styles.count}>
                      {t.plural('adminMenu.categoriesDialog.dishes', dishes)}
                    </span>
                    <span className={styles.rowActions}>
                      <button
                        type="button"
                        className={styles.link}
                        aria-expanded={open === row.id}
                        onClick={() => setOpen(open === row.id ? null : row.id)}
                      >
                        {t('adminMenu.categoriesDialog.details')}
                      </button>
                      <button
                        type="button"
                        className={styles.danger}
                        onClick={() =>
                          setRemoving(deleting ? null : { id: row.id, moveTo: others[0]?.id ?? '' })
                        }
                      >
                        <Icon name="trash" size="xs" />
                        {t('adminMenu.categoriesDialog.delete')}
                      </button>
                    </span>
                  </div>

                  {open === row.id && (
                    <div className={styles.more}>
                      <Input
                        id={`category-${row.id}-short`}
                        label={t('adminMenu.categoriesDialog.shortName')}
                        hint={t('adminMenu.categoriesDialog.shortNameHint')}
                        optional
                        value={row.shortName}
                        maxLength={40}
                        onChange={(event) => setRow(row.id, { shortName: event.target.value })}
                      />
                      <Input
                        id={`category-${row.id}-description`}
                        label={t('adminMenu.categoriesDialog.description')}
                        optional
                        value={row.description}
                        maxLength={200}
                        onChange={(event) => setRow(row.id, { description: event.target.value })}
                      />
                    </div>
                  )}

                  {deleting && (
                    <div className={styles.confirm} role="group" aria-label={row.name}>
                      {dishes > 0 ? (
                        <>
                          <p className={styles.confirmText}>
                            {t.plural('adminMenu.categoriesDialog.moveFirst', dishes)}
                          </p>
                          <Select
                            id={`category-${row.id}-move`}
                            label={t('adminMenu.categoriesDialog.moveTo')}
                            value={removing.moveTo}
                            onChange={(event) =>
                              setRemoving({ id: row.id, moveTo: event.target.value })
                            }
                          >
                            {others.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.name}
                              </option>
                            ))}
                          </Select>
                        </>
                      ) : (
                        <p className={styles.confirmText}>
                          {t('adminMenu.categoriesDialog.deleteEmpty', { name: row.name })}
                        </p>
                      )}
                      <div className={styles.confirmButtons}>
                        <Button size="sm" variant="secondary" onClick={() => setRemoving(null)}>
                          {t('adminMenu.categoriesDialog.cancel')}
                        </Button>
                        <Button
                          size="sm"
                          iconStart="trash"
                          className={styles.dangerButton}
                          loading={change.isPending}
                          onClick={() => remove(row)}
                        >
                          {dishes > 0
                            ? t('adminMenu.categoriesDialog.moveAndDelete')
                            : t('adminMenu.categoriesDialog.delete')}
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        {tried && invalid && (
          <p className={styles.error} role="alert">
            {t('adminMenu.categoriesDialog.errors')}
          </p>
        )}

        <section className={styles.add} aria-labelledby="category-add">
          <h3 id="category-add" className={styles.addTitle}>
            {t('adminMenu.categoriesDialog.addTitle')}
          </h3>
          <div className={styles.addRow}>
            <Input
              id="category-new"
              label={t('adminMenu.categoriesDialog.name')}
              hideLabel
              placeholder={t('adminMenu.categoriesDialog.addPlaceholder')}
              value={newName}
              maxLength={40}
              error={taken ? t('adminMenu.categoriesDialog.taken') : undefined}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') add();
              }}
            />
            <Button
              iconStart="plus"
              disabled={!newName.trim() || taken}
              loading={change.isPending && !removing}
              onClick={add}
            >
              {t('adminMenu.categoriesDialog.add')}
            </Button>
          </div>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={drinks}
              onChange={(event) => setDrinks(event.target.checked)}
            />
            {t('adminMenu.categoriesDialog.drinks')}
          </label>
          {simple ? (
            <p className={styles.note}>{t('adminMenu.categoriesDialog.simpleNote')}</p>
          ) : (
            <p className={styles.note}>{t('adminMenu.categoriesDialog.toSimple')}</p>
          )}
        </section>
      </div>
    </Dialog>
  );
}
