'use client';

import { useRouter } from 'next/navigation';
import { AddButton, QuantityStepper } from '@/components/ui';
import { useQuickAdd } from '@/context/QuickAddContext';
import { useCart } from '@/hooks/useCart';
import { defaultConfig, describeInMenu } from '@/lib/cartLine';
import { cx } from '@/lib/cx';
import { isCustomisable, unavailableLabel } from '@/lib/menu';
import type { Dish } from '@/types/menu';
import styles from './AddControl.module.css';

export interface AddControlProps {
  dish: Dish;
  /** Override the note under the control, e.g. "In cart" in search results. */
  inCartNote?: string;
  /** Show "Customisable" under ADD for dishes with options. */
  showCustomisable?: boolean;
  /** Never show a note (feature cards). */
  hideNote?: boolean;
  className?: string;
}

/**
 * ADD button that turns into a stepper once the dish is in the cart.
 * Customisable dishes open the food-detail page (with photo) or quick-add (without);
 * simple dishes are added straight away with an Undo toast.
 */
export function AddControl({
  dish,
  inCartNote,
  showCustomisable = true,
  hideNote,
  className,
}: AddControlProps) {
  const router = useRouter();
  const { linesForDish, addItem, setQuantity, hydrated } = useCart();
  const { openQuickAdd } = useQuickAdd();
  const lines = hydrated ? linesForDish(dish.slug) : [];
  const count = lines.reduce((n, l) => n + l.quantity, 0);
  const unavailable = unavailableLabel(dish);
  const customisable = isCustomisable(dish);

  const add = () => {
    if (!customisable) addItem(dish, defaultConfig(dish));
    else if (dish.image) router.push(`/dish/${dish.slug}/`);
    else openQuickAdd(dish);
  };

  let note: string | undefined;
  if (count > 0) note = inCartNote ?? describeInMenu(dish, lines);
  else if (customisable && showCustomisable && !unavailable) note = 'Customisable';

  return (
    <div className={cx(styles.wrap, className)}>
      {unavailable ? (
        <AddButton itemName={dish.name} unavailableLabel={unavailable} />
      ) : count === 0 ? (
        <AddButton itemName={dish.name} onClick={add} />
      ) : (
        <QuantityStepper
          value={count}
          min={0}
          itemName={dish.name}
          onChange={(next) => {
            // The stepper acts on the most recent configuration of this dish.
            const last = lines[lines.length - 1];
            setQuantity(last.key, last.quantity + (next - count));
          }}
        />
      )}
      {note && !hideNote && <span className={styles.note}>{note}</span>}
    </div>
  );
}
