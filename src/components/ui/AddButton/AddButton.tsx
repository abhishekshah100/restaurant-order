'use client';

import { useContent } from '@/api/hooks';
import { cx } from '@/lib/cx';
import { Icon } from '../Icon';
import styles from './AddButton.module.css';

export interface AddButtonProps {
  /** Dish name for the accessible label: "Add Paneer Tikka". */
  itemName: string;
  onClick?: () => void;
  /** Disabled text such as "Sold out". */
  unavailableLabel?: string;
  /** sm: compact pill for feature cards · icon: round "+" button (suggestion tiles). */
  size?: 'sm' | 'md' | 'icon';
  className?: string;
}

export function AddButton({
  itemName,
  onClick,
  unavailableLabel,
  size = 'md',
  className,
}: AddButtonProps) {
  const t = useContent('common');
  const sizeClass = size === 'sm' ? styles.sm : size === 'icon' ? styles.icon : undefined;
  if (unavailableLabel) {
    return (
      <span className={cx(styles.add, sizeClass, styles.disabled, className)}>
        <span className="visually-hidden">{itemName}: </span>
        {unavailableLabel}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={cx(styles.add, sizeClass, className)}
      onClick={onClick}
      aria-label={t('addButton.label', { item: itemName })}
    >
      {size === 'icon' ? (
        <Icon name="plus" size="sm" />
      ) : (
        <>
          {t('addButton.text')}
          <Icon name="plus" size="xs" />
        </>
      )}
    </button>
  );
}
