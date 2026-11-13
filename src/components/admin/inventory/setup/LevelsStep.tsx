'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/api/endpoints';
import { useContent } from '@/api/hooks';
import { refreshAfter } from '@/api/refreshAfter';
import { Button } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useAdminToken } from '@/hooks/useAdminSession';
import type { StockItem } from '@/types/inventory';
import { useAdminWorkspace } from '../../shell/AdminWorkspace';
import styles from './Setup.module.css';

const amount = (text: string) => (text.trim() === '' ? undefined : Number(text.replace(',', '.')));

/**
 * Step ③: for each ingredient, the amount at which to order more ("Warn me at 5 kg"). When stock
 * drops to it, Today says so. Only what's typed (or changed) is saved; it can be skipped.
 */
export function LevelsStep({
  items,
  onDone,
  onSkip,
}: {
  items: readonly StockItem[];
  onDone: () => void;
  onSkip: () => void;
}) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const token = useAdminToken();
  const client = useQueryClient();
  const { showToast } = useToast();
  const [levels, setLevels] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Those without a level first: they're what this step is for.
  const sorted = [...items].sort(
    (a, b) =>
      Number(a.reorderLevel > 0) - Number(b.reorderLevel > 0) || a.name.localeCompare(b.name),
  );
  const changes = items.flatMap((i) => {
    const typed = levels[i.ingredientId];
    if (typed === undefined) return [];
    const level = amount(typed);
    if (level === undefined || !Number.isFinite(level) || level < 0) return [];
    return level === i.reorderLevel ? [] : [{ item: i, level }];
  });
  const withLevel = items.filter((i) => i.reorderLevel > 0).length;

  const save = async () => {
    if (!token) return;
    if (changes.length === 0) {
      setError(t('adminInventory.setup.levels.nothing'));
      return;
    }
    setSaving(true);
    setError('');
    let saved = 0;
    try {
      for (const { item, level } of changes) {
        try {
          await api.updateInventoryItem(token, branch.id, item.ingredientId, {
            reorderLevel: level,
          });
          saved += 1;
        } catch {
          setError(t('adminInventory.setup.levels.failed', { name: item.name }));
          return;
        }
      }
      showToast(t.plural('adminInventory.setup.levels.savedToast', saved), { tone: 'success' });
      setLevels({});
      const stillMissing = items.filter(
        (i) => i.reorderLevel <= 0 && !changes.some((c) => c.item === i && c.level > 0),
      );
      if (stillMissing.length === 0) onDone();
    } finally {
      setSaving(false);
      await refreshAfter(client, 'stockChanged', branch.id);
    }
  };

  return (
    <div className={styles.stepBody}>
      <p className={styles.lead}>{t('adminInventory.setup.levels.body')}</p>
      <ul className={styles.sheet}>
        {sorted.map((i) => (
          <li key={i.ingredientId} className={styles.sheetRow}>
            <span className={styles.sheetName}>{i.name}</span>
            <label className={styles.sheetField}>
              <span className={styles.sheetLabel}>{t('adminInventory.setup.levels.label')}</span>
              <span className={styles.withUnit}>
                <input
                  inputMode="decimal"
                  className={styles.box}
                  value={
                    levels[i.ingredientId] ?? (i.reorderLevel > 0 ? String(i.reorderLevel) : '')
                  }
                  onChange={(event) =>
                    setLevels((all) => ({ ...all, [i.ingredientId]: event.target.value }))
                  }
                  aria-label={`${i.name}: ${t('adminInventory.setup.levels.label')}`}
                />
                <span className={styles.suffix}>{t(`adminInventory.units.${i.unit}`)}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className={styles.footer}>
        <span className={error ? styles.footerError : styles.footerNote} role="status">
          {error || t.plural('adminInventory.setup.levels.set', withLevel, { total: items.length })}
        </span>
        <div className={styles.footerActions}>
          <Button variant="ghost" onClick={onSkip}>
            {t('adminInventory.setup.skip')}
          </Button>
          <Button
            iconStart="check"
            loading={saving}
            disabled={changes.length === 0}
            onClick={() => void save()}
          >
            {t('adminInventory.setup.levels.save')}
          </Button>
        </div>
      </div>
    </div>
  );
}
