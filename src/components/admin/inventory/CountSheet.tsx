'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useContent, useIngredients, useInventoryStock } from '@/api/hooks';
import { useNow } from '@/hooks/useNow';
import type { StockItem } from '@/types/inventory';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { useInventoryText } from './useInventoryText';
import styles from './CountSheet.module.css';

/** Set on <html> while the sheet prints: everything else on the page is hidden. */
const PRINTING = 'printing-count';

/**
 * A paper count sheet: every item counted here, by category, with its unit, an empty box to write
 * what's on the shelf and room for a note. Blind (no expected amounts). `print()` shows it alone
 * and opens the browser's print dialog; it's taken away afterwards.
 */
export function useCountSheet() {
  const t = useContent('common');
  const { branch, clock, can } = useAdminWorkspace();
  const text = useInventoryText();
  const now = useNow();
  const stock = useInventoryStock(branch.id, can('inventory.view')).data;
  const categories = useIngredients(branch.id).data?.categories ?? [];
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!printing) return;
    const root = document.documentElement;
    const done = () => {
      root.classList.remove(PRINTING);
      setPrinting(false);
    };
    root.classList.add(PRINTING);
    window.addEventListener('afterprint', done, { once: true });
    const id = window.setTimeout(() => window.print(), 50);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('afterprint', done);
      root.classList.remove(PRINTING);
    };
  }, [printing]);

  const items = stock?.items ?? [];
  const groups = [
    ...categories.map((c) => ({ id: c.id as string | null, name: c.name })),
    { id: null, name: t('adminInventory.stock.noCategory') },
  ]
    .map((g) => ({
      ...g,
      items: items
        .filter((i) => i.categoryId === g.id)
        .sort((a: StockItem, b: StockItem) => a.name.localeCompare(b.name)),
    }))
    .filter((g) => g.items.length > 0);

  const sheet =
    printing &&
    createPortal(
      <div className={styles.sheet} data-count-sheet="">
        <header className={styles.head}>
          <h1>{t('adminInventory.sheet.title', { branch: branch.name })}</h1>
          <p>
            {t('adminInventory.sheet.meta', {
              date: now ? clock.date(now) : '',
              count: items.length,
            })}
          </p>
          <p className={styles.fill}>{t('adminInventory.sheet.countedBy')}</p>
        </header>
        {groups.map((g) => (
          <table key={g.id ?? 'none'} className={styles.table}>
            <caption>{g.name}</caption>
            <thead>
              <tr>
                <th scope="col">{t('adminInventory.sheet.item')}</th>
                <th scope="col">{t('adminInventory.sheet.unit')}</th>
                <th scope="col">{t('adminInventory.sheet.counted')}</th>
                <th scope="col">{t('adminInventory.sheet.note')}</th>
              </tr>
            </thead>
            <tbody>
              {g.items.map((i) => (
                <tr key={i.ingredientId}>
                  <td>{i.name}</td>
                  <td>{text.unit(i.unit)}</td>
                  <td />
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
        ))}
        <p className={styles.footnote}>{t('adminInventory.sheet.after')}</p>
      </div>,
      document.body,
    );

  return {
    print: () => setPrinting(true),
    ready: items.length > 0,
    sheet,
  };
}
