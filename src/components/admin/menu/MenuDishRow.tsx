import Image from 'next/image';
import { useContent } from '@/api/hooks';
import { Icon, IconButton, VegMark } from '@/components/ui';
import { menuStatus, sizesOff } from '@/lib/adminMenu';
import { cx } from '@/lib/cx';
import { dishImage } from '@/lib/menu';
import type { Dish } from '@/types/menu';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { Switch } from './Switch';
import styles from './MenuDishRow.module.css';

/** The thumbnail repeats the dish name beside it, so screen readers skip it. */
const DECORATIVE = '';

/**
 * One dish for staff: its picture, name and type, sizes and prices; then one switch with what
 * it means beside it ("Available", "Sold out · back 8 PM"): the switch takes it off (asking how)
 * or puts it back, the words open the same choice. Tapping the dish, or Edit, opens it; Recipe
 * (inventory) opens its recipe.
 */
export function MenuDishRow({
  dish,
  onSwitch,
  onAvailability,
  onEdit,
  onRecipe,
  reorder,
  eager,
}: {
  dish: Dish;
  /** On: back on the menu at once. Off: ask how it's off. */
  onSwitch: (on: boolean) => void;
  onAvailability: () => void;
  /** Opens the dish editor; without it there's no Edit (the kitchen's Stock page). */
  onEdit?: () => void;
  /** Opens the dish's recipe (inventory managers, with the server). */
  onRecipe?: () => void;
  /** While reordering: move up / down instead of the switch and Edit. */
  reorder?: { first: boolean; last: boolean; onMove: (by: -1 | 1) => void };
  /** Near the top of the page: its photo loads at once. */
  eager?: boolean;
}) {
  const t = useContent('common');
  const { money } = useAdminWorkspace();
  const status = menuStatus(dish);
  const on = status === 'available';
  const thumb = dishImage(dish, 'thumb');
  const off = sizesOff(dish);
  const { availability } = dish;
  let statusLabel = t('adminMenu.status.available');
  if (availability.status === 'sold-out') {
    statusLabel = availability.backAt
      ? t('adminMenu.status.backAt', { time: availability.backAt })
      : t('adminMenu.status.soldOut');
  }
  if (availability.status === 'unavailable-today') statusLabel = t('adminMenu.status.offToday');
  // What the dish has, so staff see it at a glance: "2 sizes · 5 choices · 3 add-ons".
  const parts = [
    ...((dish.variants?.length ?? 0) > 1
      ? [t.plural('adminMenu.meta.sizes', dish.variants?.length ?? 0)]
      : []),
    ...(dish.optionGroups?.length
      ? [t.plural('adminMenu.meta.groups', dish.optionGroups.length)]
      : []),
    ...(dish.addOns?.length ? [t.plural('adminMenu.meta.addOns', dish.addOns.length)] : []),
  ];

  const details = (
    <>
      <span className={styles.name}>
        <VegMark veg={dish.veg} />
        <span className={styles.nameText}>{dish.name}</span>
      </span>
      <span className={styles.prices}>
        {dish.variants && dish.variants.length > 0
          ? dish.variants.map((v) => (
              <span key={v.id} className={cx(v.available === false && styles.sizeOff)}>
                {t('adminMenu.sizePrice', { size: v.name, price: money.format(v.price) })}
              </span>
            ))
          : money.format(dish.price)}
      </span>
      {parts.length > 0 && <span className={styles.meta}>{parts.join(' · ')}</span>}
    </>
  );

  return (
    <li className={cx(styles.row, !on && styles.off)}>
      <span className={styles.thumb} aria-hidden="true">
        {thumb ? (
          <Image
            className={styles.img}
            src={thumb.src}
            alt={DECORATIVE}
            width={thumb.width}
            height={thumb.height}
            sizes="56px"
            loading={eager ? 'eager' : 'lazy'}
          />
        ) : (
          <Icon name="cutlery" size="sm" />
        )}
      </span>

      {/* Tapping the dish opens it (when it can be edited here). */}
      {onEdit && !reorder ? (
        <button
          type="button"
          className={cx(styles.main, styles.mainButton)}
          onClick={onEdit}
          aria-label={t('adminMenu.edit', { dish: dish.name })}
        >
          {details}
        </button>
      ) : (
        <div className={styles.main}>{details}</div>
      )}

      <div className={styles.availability}>
        {reorder ? (
          <>
            <IconButton
              icon="chevd"
              className={styles.up}
              disabled={reorder.first}
              label={t('adminMenu.editor.moveUp', { name: dish.name })}
              onClick={() => reorder.onMove(-1)}
            />
            <IconButton
              icon="chevd"
              disabled={reorder.last}
              label={t('adminMenu.editor.moveDown', { name: dish.name })}
              onClick={() => reorder.onMove(1)}
            />
          </>
        ) : (
          <>
            <Switch
              checked={on}
              onChange={onSwitch}
              label={t('adminMenu.toggle', { dish: dish.name })}
            />
            {/* What the switch means, in words: tap it to change how it's off. */}
            <button
              type="button"
              className={cx(styles.status, styles[status])}
              onClick={onAvailability}
              aria-label={t('adminMenu.changeAvailability', { dish: dish.name })}
            >
              <span className={styles.dot} aria-hidden="true" />
              <span>
                {statusLabel}
                {on && off.length > 0 && (
                  <span className={styles.partly}>
                    {' · '}
                    {t.plural('adminMenu.sizesOff', off.length)}
                  </span>
                )}
              </span>
            </button>
          </>
        )}
      </div>

      {!reorder && (onRecipe || onEdit) && (
        <div className={styles.actions}>
          {onRecipe && (
            <button
              type="button"
              className={styles.action}
              onClick={onRecipe}
              aria-label={t('adminInventory.recipes.open', { dish: dish.name })}
            >
              <Icon name="list" size="xs" />
              <span className={styles.actionLabel}>{t('adminMenu.recipe')}</span>
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              className={cx(styles.action, styles.editAction)}
              onClick={onEdit}
              aria-label={t('adminMenu.edit', { dish: dish.name })}
            >
              <Icon name="pencil" size="xs" />
              <span className={styles.actionLabel}>{t('adminMenu.editShort')}</span>
            </button>
          )}
        </div>
      )}
    </li>
  );
}
