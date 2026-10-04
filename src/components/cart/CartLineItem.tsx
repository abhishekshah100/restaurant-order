'use client';

import Image from 'next/image';
import Link from 'next/link';
import { QuantityStepper, VegMark } from '@/components/ui';
import { useQuickAdd } from '@/context/QuickAddContext';
import { useCartActions } from '@/hooks/useCart';
import { describeInstructions, describeOptions, describeOptionsShort } from '@/lib/cartLine';
import { cx } from '@/lib/cx';
import { useContent, useMenu, useRegion } from '@/api/hooks';
import { dishImage, isCustomisable } from '@/lib/menu';
import type { CartLine } from '@/types/cart';
import { useCartLineLabels } from '@/hooks/useCartLineLabels';
import styles from './CartLineItem.module.css';

export interface CartLineItemProps {
  line: CartLine;
  /** page: cart page row · panel: compact desktop side panel. */
  variant?: 'page' | 'panel';
}

export function CartLineItem({ line, variant = 'page' }: CartLineItemProps) {
  const { setQuantity, removeLine } = useCartActions();
  const { openQuickAdd } = useQuickAdd();
  const menu = useMenu();
  const t = useContent('cart');
  const { money } = useRegion();
  const labels = useCartLineLabels();
  const dish = menu.getDish(line.dishSlug);
  if (!dish) return null;

  const thumb = dishImage(dish, 'thumb');
  const options =
    variant === 'panel'
      ? describeOptionsShort(dish, line, labels)
      : describeOptions(dish, line, labels);
  const instructions = describeInstructions(line);
  const editable = isCustomisable(dish);

  return (
    <li className={cx(styles.ci, styles[variant])}>
      <div className={cx(styles.media, !thumb && styles.mediaInitial)} aria-hidden="true">
        {thumb ? (
          <Image
            className={styles.img}
            src={thumb.src}
            alt={''}
            width={thumb.width}
            height={thumb.height}
            sizes="80px"
          />
        ) : (
          // No photo: a soft tile with the dish's initial instead of an empty placeholder
          <span className={styles.initial}>{dish.name.charAt(0)}</span>
        )}
      </div>
      <div className={styles.info}>
        <p className={styles.name}>
          <VegMark veg={dish.veg} />
          {dish.name}
        </p>
        {options && <p className={styles.opts}>{options}</p>}
        {instructions && variant === 'page' && <p className={styles.note}>{instructions}</p>}
      </div>
      <QuantityStepper
        className={styles.qty}
        variant={variant === 'page' ? 'filled' : 'outline'}
        size={variant === 'page' ? 'sm' : 'md'}
        value={line.quantity}
        min={0}
        onChange={(q) => setQuantity(line.key, q)}
        itemName={dish.name}
      />
      <span className={styles.price}>
        {money.format(line.unitPrice * line.quantity)}
        {variant === 'page' && line.quantity > 1 && (
          <span className={styles.each}>
            {t('line.each', { price: money.format(line.unitPrice) })}
          </span>
        )}
      </span>
      {variant === 'page' && (
        <div className={styles.links}>
          {editable &&
            (dish.image ? (
              <Link
                className={styles.link}
                href={`/dish/${dish.slug}/?edit=${encodeURIComponent(line.key)}`}
                aria-label={t('line.editLabel', { dish: dish.name })}
              >
                {t('line.edit')}
              </Link>
            ) : (
              <button
                type="button"
                className={styles.link}
                aria-label={t('line.editLabel', { dish: dish.name })}
                onClick={() => openQuickAdd(dish, line.key)}
              >
                {t('line.edit')}
              </button>
            ))}
          {editable && <span className={styles.linkSep} aria-hidden="true" />}
          <button
            type="button"
            className={cx(styles.link, styles.remove)}
            aria-label={t('line.removeLabel', { dish: dish.name })}
            onClick={() => removeLine(line.key)}
          >
            {t('line.remove')}
          </button>
        </div>
      )}
    </li>
  );
}
