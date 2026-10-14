'use client';

import { useState } from 'react';
import { useContent } from '@/api/hooks';
import { Chip, QuantityStepper, SearchField, VegMark } from '@/components/ui';
import { isAvailable, type MenuCatalog } from '@/lib/menu';
import { dishCount, hasChoices, plainKey, type PadLines } from '@/lib/orderPad';
import type { CategoryId, Dish } from '@/types/menu';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './OrderPad.module.css';

/**
 * The pad's menu: search, a chip per category, and the dishes by category. A dish without
 * choices adds with one tap and then shows a stepper; a dish with choices opens them.
 */
export function PadMenu({
  menu,
  lines,
  onAdd,
  onChoose,
  onQuantity,
}: {
  menu: MenuCatalog;
  lines: PadLines;
  onAdd: (dish: Dish) => void;
  onChoose: (dish: Dish) => void;
  onQuantity: (key: string, quantity: number) => void;
}) {
  const t = useContent('common');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryId | 'all'>('all');
  const searching = query.trim().length > 0;

  const sections = searching
    ? [{ id: 'results', name: '', dishes: menu.searchDishes(query) }]
    : menu.categories
        .filter((c) => category === 'all' || c.id === category)
        .map((c) => ({ id: c.id, name: c.name, dishes: menu.dishesIn(c.id) }))
        .filter((section) => section.dishes.length > 0);

  return (
    <div className={styles.menu}>
      <div className={styles.filters}>
        <SearchField
          value={query}
          onChange={setQuery}
          label={t('adminOrderPad.search')}
          placeholder={t('adminOrderPad.search')}
        />
        {!searching && (
          <div className={styles.chips} role="group" aria-label={t('adminOrderPad.categories')}>
            <Chip pressed={category === 'all'} onClick={() => setCategory('all')}>
              {t('adminOrderPad.all')}
            </Chip>
            {menu.categories.map((c) => (
              <Chip key={c.id} pressed={category === c.id} onClick={() => setCategory(c.id)}>
                {c.shortName ?? c.name}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {sections.map((section) => (
        <section key={section.id} className={styles.section} aria-label={section.name || undefined}>
          {section.name && <h3 className={styles.sectionTitle}>{section.name}</h3>}
          {section.dishes.length > 0 ? (
            <ul className={styles.dishes}>
              {section.dishes.map((dish) => (
                <PadDishRow
                  key={dish.slug}
                  dish={dish}
                  lines={lines}
                  onAdd={onAdd}
                  onChoose={onChoose}
                  onQuantity={onQuantity}
                />
              ))}
            </ul>
          ) : (
            <p className={styles.none}>{t('adminOrderPad.noMatch', { query: query.trim() })}</p>
          )}
        </section>
      ))}
    </div>
  );
}

function PadDishRow({
  dish,
  lines,
  onAdd,
  onChoose,
  onQuantity,
}: {
  dish: Dish;
  lines: PadLines;
  onAdd: (dish: Dish) => void;
  onChoose: (dish: Dish) => void;
  onQuantity: (key: string, quantity: number) => void;
}) {
  const t = useContent('common');
  const { money } = useAdminWorkspace();
  const choices = hasChoices(dish);
  const count = dishCount(lines, dish.slug);
  const available = isAvailable(dish);

  let action;
  if (!available) {
    action = <span className={styles.unavailable}>{t('adminOrderPad.unavailable')}</span>;
  } else if (!choices && count > 0) {
    action = (
      <QuantityStepper
        value={count}
        min={0}
        size="sm"
        itemName={dish.name}
        onChange={(next) => onQuantity(plainKey(dish), next)}
      />
    );
  } else {
    action = (
      <button
        type="button"
        className={styles.add}
        onClick={() => (choices ? onChoose(dish) : onAdd(dish))}
        aria-label={t(choices ? 'adminOrderPad.chooseLabel' : 'adminOrderPad.addLabel', {
          dish: dish.name,
        })}
      >
        {t('adminOrderPad.add')}
      </button>
    );
  }

  return (
    <li className={styles.dish} data-off={!available || undefined}>
      <VegMark veg={dish.veg} className={styles.veg} />
      <span className={styles.dishText}>
        <span className={styles.dishName}>{dish.name}</span>
        <span className={styles.dishMeta}>
          {money.format(dish.price)}
          {choices && count > 0 && (
            <span className={styles.added}>{t.plural('adminOrderPad.added', count)}</span>
          )}
        </span>
      </span>
      {action}
    </li>
  );
}
