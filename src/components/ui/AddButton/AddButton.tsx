import { cx } from '@/lib/cx';
import { Icon } from '../Icon';
import styles from './AddButton.module.css';

export interface AddButtonProps {
  /** Dish name for the accessible label: "Add Paneer Tikka". */
  itemName: string;
  onClick?: () => void;
  /** Disabled text such as "Sold out" or "Back 8 PM". */
  unavailableLabel?: string;
  className?: string;
}

export function AddButton({ itemName, onClick, unavailableLabel, className }: AddButtonProps) {
  if (unavailableLabel) {
    return (
      <span
        className={cx(styles.add, styles.disabled, className)}
        aria-label={`${itemName}: ${unavailableLabel}`}
      >
        {unavailableLabel}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={cx(styles.add, className)}
      onClick={onClick}
      aria-label={`Add ${itemName}`}
    >
      ADD
      <Icon name="plus" size="xs" />
    </button>
  );
}
