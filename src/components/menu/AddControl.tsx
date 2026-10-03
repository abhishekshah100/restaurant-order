'use client';

import { useEffect, useRef } from 'react';
import { AddButton, QuantityStepper } from '@/components/ui';
import { useContent } from '@/api/hooks';
import { useQuickAdd } from '@/context/QuickAddContext';
import { useCartActions, useDishLines } from '@/hooks/useCart';
import { useOrderingAvailability } from '@/hooks/useRestaurantStatus';
import { defaultConfig } from '@/lib/cartLine';
import { cx } from '@/lib/cx';
import { isCustomisable } from '@/lib/menu';
import type { Dish } from '@/types/menu';
import { unavailableLabel } from './dishTag';
import styles from './AddControl.module.css';

export interface AddControlProps {
  dish: Dish;
  /** sm: compact ADD pill and stepper · icon: round "+" with compact stepper. */
  size?: 'sm' | 'md' | 'icon';
  /** Show a small "Customisable" label under ADD for dishes with choices. */
  customisableHint?: boolean;
  className?: string;
}

/**
 * ADD button that turns into a stepper once the dish is in the cart.
 * Customisable dishes open the quick-add pop-up; simple dishes are added
 * straight away with an Undo toast.
 */
export function AddControl({ dish, size = 'md', customisableHint, className }: AddControlProps) {
  const { addItem, setQuantity } = useCartActions();
  const { openQuickAdd } = useQuickAdd();
  const lines = useDishLines(dish.slug);
  const count = lines.reduce((n, l) => n + l.quantity, 0);
  const { canAdd } = useOrderingAvailability();
  const t = useContent('menu');
  // While the restaurant is closed the menu is read-only.
  const unavailable = unavailableLabel(t, dish) ?? (canAdd ? undefined : t('availability.closed'));
  const customisable = isCustomisable(dish);
  const inCart = count > 0;

  // ADD and the stepper swap places at 0 ↔ 1; keep keyboard focus on the control that replaces
  // the one just used ("Add one" after ADD, ADD after the last "Remove one").
  const wrapRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(false);
  const wasInCart = useRef(inCart);
  useEffect(() => {
    if (wasInCart.current === inCart) return;
    wasInCart.current = inCart;
    const wrap = wrapRef.current;
    const active = document.activeElement;
    const focusLost = !active || active === document.body || Boolean(wrap?.contains(active));
    if (restoreFocus.current && focusLost) {
      const buttons = wrap?.querySelectorAll('button');
      buttons?.[buttons.length - 1]?.focus();
    }
    restoreFocus.current = false;
  }, [inCart]);

  // Simple dishes go straight in; anything with choices opens the quick-add pop-up.
  const add = () => {
    restoreFocus.current = true;
    if (customisable) openQuickAdd(dish);
    else addItem(dish, defaultConfig(dish));
  };

  return (
    <div ref={wrapRef} className={cx(styles.wrap, className)}>
      {unavailable ? (
        <AddButton
          itemName={dish.name}
          unavailableLabel={unavailable}
          size={size === 'icon' ? 'sm' : size}
        />
      ) : inCart ? (
        <QuantityStepper
          size={size === 'icon' ? 'sm' : size}
          value={count}
          min={0}
          itemName={dish.name}
          onChange={(next) => {
            // The stepper acts on the most recent configuration of this dish.
            const last = lines[lines.length - 1];
            restoreFocus.current = next === 0;
            setQuantity(last.key, last.quantity + (next - count));
          }}
        />
      ) : (
        <AddButton itemName={dish.name} onClick={add} size={size} />
      )}
      {customisableHint && customisable && !inCart && !unavailable && (
        <span className={styles.hint}>{t('dish.customisable')}</span>
      )}
    </div>
  );
}
