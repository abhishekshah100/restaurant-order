import { Button } from '@/components/ui';
import styles from './HistoryButton.module.css';

/**
 * A page's History, at the end of its filter row (Orders, Requests, Payments): the clock and
 * the word; on a phone the clock alone (named for screen readers), so the filters keep their room.
 */
export function HistoryButton({ href, label }: { href: string; label: string }) {
  return (
    <Button
      href={href}
      variant="secondary"
      size="sm"
      iconStart="history"
      aria-label={label}
      className={styles.button}
    >
      <span className={styles.label}>{label}</span>
    </Button>
  );
}
