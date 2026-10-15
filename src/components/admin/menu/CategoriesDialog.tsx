'use client';

import { useState } from 'react';
import { useContent } from '@/api/hooks';
import { useUpdateCategories } from '@/api/mutations';
import { Button, Dialog, Input } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { moveItem } from '@/lib/adminMenu';
import type { Category } from '@/types/menu';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { RowButtons } from './editor/parts';
import styles from './CategoriesDialog.module.css';

type Row = Pick<Category, 'id' | 'name' | 'description'> & { shortName: string };

/**
 * The categories guests see: each one's name, short name (phone tabs) and description, and their
 * order. New categories come with the backend (the guest app's pages are built for each one).
 */
export function CategoriesDialog({
  categories,
  onClose,
}: {
  categories: readonly Category[];
  onClose: () => void;
}) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const { showToast } = useToast();
  const update = useUpdateCategories();
  const [rows, setRows] = useState<Row[]>(() =>
    categories.map((c) => ({
      id: c.id,
      name: c.name,
      shortName: c.shortName ?? '',
      description: c.description,
    })),
  );
  const [tried, setTried] = useState(false);
  const names = rows.map((r) => r.name.trim().toLowerCase());
  const invalid = names.some((n) => !n) || new Set(names).size !== names.length;
  const setRow = (id: string, fields: Partial<Row>) =>
    setRows(rows.map((r) => (r.id === id ? { ...r, ...fields } : r)));

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
        onError: () => showToast(t('adminMenu.failed'), { tone: 'error' }),
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
      description={t('adminMenu.categoriesDialog.subtitle')}
      footer={
        <Button block iconStart="check" loading={update.isPending} onClick={save}>
          {t('adminMenu.categoriesDialog.save')}
        </Button>
      }
    >
      <div className={styles.body}>
        <ol className={styles.list}>
          {rows.map((row, index) => (
            <li key={row.id} className={styles.row}>
              <div className={styles.head}>
                <span className={styles.position}>{index + 1}</span>
                <Input
                  id={`category-${row.id}-name`}
                  label={t('adminMenu.categoriesDialog.name')}
                  value={row.name}
                  maxLength={40}
                  onChange={(event) => setRow(row.id, { name: event.target.value })}
                />
                <RowButtons
                  name={row.name || row.id}
                  first={index === 0}
                  last={index === rows.length - 1}
                  onMove={(by) => setRows(moveItem(rows, index, by))}
                />
              </div>
              <div className={styles.more}>
                <Input
                  id={`category-${row.id}-short`}
                  label={t('adminMenu.categoriesDialog.shortName')}
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
            </li>
          ))}
        </ol>
        {tried && invalid && (
          <p className={styles.error} role="alert">
            {t('adminMenu.categoriesDialog.errors')}
          </p>
        )}
        <p className={styles.note}>{t('adminMenu.categoriesDialog.note')}</p>
      </div>
    </Dialog>
  );
}
