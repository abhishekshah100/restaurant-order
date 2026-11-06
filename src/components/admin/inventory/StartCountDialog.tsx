'use client';

import { useState } from 'react';
import { ApiError, isApiError } from '@/api/client';
import { useContent, useIngredients } from '@/api/hooks';
import { useStartCount } from '@/api/mutations';
import { Button, Dialog, SearchField, Select, Textarea } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './Inventory.module.css';

type Scope = 'all' | 'category' | 'items';

/**
 * Starting a count: of everything the branch tracks, one category (a shelf, the fridge), or
 * chosen items. What the stock is when it starts is what the count is compared with.
 */
export function StartCountDialog({
  onClose,
  onStarted,
}: {
  onClose: () => void;
  onStarted: (id: string) => void;
}) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const { showToast } = useToast();
  const ingredients = useIngredients(branch.id).data;
  const start = useStartCount();
  const [scope, setScope] = useState<Scope>('all');
  const [categoryId, setCategoryId] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);

  const tracked = (ingredients?.ingredients ?? []).filter((i) => i.tracked);
  const categories = (ingredients?.categories ?? []).filter((c) =>
    tracked.some((i) => i.categoryId === c.id),
  );
  const shown = tracked.filter((i) => i.name.toLowerCase().includes(search.trim().toLowerCase()));
  const problem =
    scope === 'category' && !categoryId
      ? 'category'
      : scope === 'items' && picked.size === 0
        ? 'items'
        : null;

  const submit = () => {
    setTried(true);
    if (problem) return;
    start.mutate(
      {
        branchId: branch.id,
        body: {
          scope,
          ...(scope === 'category' ? { categoryId } : {}),
          ...(scope === 'items' ? { ingredientIds: [...picked] } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      },
      {
        onSuccess: (count) => onStarted(count.id),
        onError: (error) => {
          const number = error instanceof ApiError ? error.body?.count : undefined;
          showToast(
            isApiError(error, 'count_open')
              ? t('adminInventory.counts.errors.open', { number: number ?? '' })
              : t('adminInventory.errors.failed'),
            { tone: 'error' },
          );
        },
      },
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminInventory.counts.start')}
      description={t('adminInventory.counts.startBody')}
      footer={
        <Button block iconStart="checkc" loading={start.isPending} onClick={submit}>
          {t('adminInventory.counts.startConfirm')}
        </Button>
      }
    >
      <div className={styles.form}>
        <div
          role="radiogroup"
          aria-label={t('adminInventory.counts.what')}
          className={styles.reasons}
        >
          {(['all', 'category', 'items'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={scope === s}
              className={styles.reason}
              disabled={s === 'category' && categories.length === 0}
              onClick={() => setScope(s)}
            >
              {t(`adminInventory.counts.scopes.${s}`)}
            </button>
          ))}
        </div>
        {scope === 'all' && (
          <p className={styles.muted}>
            {t.plural('adminInventory.counts.allItems', tracked.length)}
          </p>
        )}
        {scope === 'category' && (
          <Select
            id="count-category"
            label={t('adminInventory.stock.category')}
            value={categoryId}
            error={tried && problem === 'category' ? t('adminInventory.entry.pick') : undefined}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="" disabled>
              {t('adminInventory.entry.pickPlaceholder')}
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
        {scope === 'items' && (
          <>
            <SearchField
              value={search}
              onChange={setSearch}
              label={t('adminInventory.stock.search')}
              placeholder={t('adminInventory.stock.searchPlaceholder')}
            />
            <p className={styles.muted}>{t.plural('adminInventory.counts.picked', picked.size)}</p>
            {tried && problem === 'items' && (
              <p className={styles.error}>{t('adminInventory.counts.pickItems')}</p>
            )}
            <ul className={styles.list}>
              {shown.map((i) => (
                <li key={i.id}>
                  <label className={styles.row}>
                    <span className={styles.rowName}>{i.name}</span>
                    <input
                      type="checkbox"
                      checked={picked.has(i.id)}
                      onChange={(event) =>
                        setPicked((all) => {
                          const next = new Set(all);
                          if (event.target.checked) next.add(i.id);
                          else next.delete(i.id);
                          return next;
                        })
                      }
                    />
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
        <Textarea
          id="count-note"
          label={t('adminInventory.entry.note')}
          optional
          rows={2}
          maxLength={300}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
    </Dialog>
  );
}
