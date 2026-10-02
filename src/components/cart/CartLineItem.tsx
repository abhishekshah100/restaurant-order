'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Icon, QuantityStepper, VegMark } from '@/components/ui';
import { useQuickAdd } from '@/context/QuickAddContext';
import { useCart } from '@/hooks/useCart';
import { describeInstructions, describeOptions, describeOptionsShort } from '@/lib/cartLine';
import { cx } from '@/lib/cx';
import { formatINR } from '@/lib/format';
import { dishImage, getDish, isCustomisable } from '@/lib/menu';
import type { CartLine } from '@/types/cart';
import styles from './CartLineItem.module.css';

export interface CartLineItemProps {
  line: CartLine;
  /** page: cart page row · panel: compact desktop side panel. */
  variant?: 'page' | 'panel';
  /** Show "₹199 each" after the options when quantity > 1 (desktop cart). */
  showEach?: boolean;
}

export function CartLineItem({ line, variant = 'page', showEach }: CartLineItemProps) {
  const { setQuantity, removeLine } = useCart();
  const { openQuickAdd } = useQuickAdd();
  const dish = getDish(line.dishSlug);
  if (!dish) return null;

  const thumb = dishImage(dish, 'thumb');
  const options =
    variant === 'panel' ? describeOptionsShort(dish, line) : describeOptions(dish, line);
  const instructions = describeInstructions(line);
  const editable = isCustomisable(dish);

  return (
    <li className={cx(styles.ci, styles[variant], line.quantity === 1 && styles.single)}>
      <div className={styles.media}>
        {thumb ? (
          <Image src={thumb.src} alt="" width={thumb.width} height={thumb.height} sizes="80px" />
        ) : (
          <Icon name="cutlery" />
        )}
      </div>
      <div className={styles.info}>
        <p className={styles.name}>
          <VegMark veg={dish.veg} />
          {dish.name}
        </p>
        {options && (
          <p className={styles.opts}>
            {options}
            {showEach && line.quantity > 1 && (
              <span className="hide-mobile"> · {formatINR(line.unitPrice)} each</span>
            )}
          </p>
        )}
        {instructions && variant === 'page' && <p className={styles.note}>{instructions}</p>}
      </div>
      <QuantityStepper
        className={styles.qty}
        variant="outline"
        value={line.quantity}
        min={0}
        onChange={(q) => setQuantity(line.key, q)}
        itemName={dish.name}
      />
      <span className={styles.price}>{formatINR(line.unitPrice * line.quantity)}</span>
      {variant === 'page' && (
        <div className={styles.links}>
          {editable &&
            (dish.image ? (
              <Link
                className={styles.link}
                href={`/dish/${dish.slug}/?edit=${encodeURIComponent(line.key)}`}
                aria-label={`Edit ${dish.name}`}
              >
                <Icon name="pencil" size="xs" />
                Edit
              </Link>
            ) : (
              <button
                type="button"
                className={styles.link}
                aria-label={`Edit ${dish.name}`}
                onClick={() => openQuickAdd(dish, line.key)}
              >
                <Icon name="pencil" size="xs" />
                Edit
              </button>
            ))}
          <button
            type="button"
            className={cx(styles.link, styles.remove)}
            aria-label={`Remove ${dish.name}`}
            onClick={() => removeLine(line.key)}
          >
            <Icon name="trash" size="xs" />
            Remove
          </button>
        </div>
      )}
    </li>
  );
}
