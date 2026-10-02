'use client';

import { Button, Icon } from '@/components/ui';
import { useCart } from '@/hooks/useCart';
import { useTable } from '@/hooks/useTable';
import { cx } from '@/lib/cx';
import { pluralize } from '@/lib/format';
import { CartLineItem } from './CartLineItem';
import { PriceSummary } from './PriceSummary';
import styles from './CartPanel.module.css';

export interface CartPanelProps {
  /** Rendered inside the tablet slide-over dialog. */
  inDialog?: boolean;
  onNavigate?: () => void;
  className?: string;
}

/** "Your order" column on desktop menu pages (w02) and the tablet slide-over. */
export function CartPanel({ inDialog, onNavigate, className }: CartPanelProps) {
  const { lines, bill, count, hydrated } = useCart();
  const table = useTable();
  const Heading = inDialog ? 'p' : 'h2';

  return (
    <aside
      className={cx(styles.panel, inDialog && styles.inDialog, className)}
      aria-label="Your cart"
    >
      <div className={inDialog ? undefined : styles.sticky}>
        <div className={styles.head}>
          <Heading className="t-h2">Your order</Heading>
          <span className="t-small c2">
            Table {table}
            {hydrated && count > 0 ? ` · ${pluralize(count, 'item')}` : ''}
          </span>
        </div>
        {hydrated && count > 0 ? (
          <>
            <div className={styles.body}>
              <ul>
                {lines.map((line) => (
                  <CartLineItem key={line.key} line={line} variant="panel" />
                ))}
              </ul>
              <p className={cx('t-small c3', styles.note)}>
                <Icon name="user" size="xs" />
                This cart is yours. Others at Table {table} order separately.
              </p>
            </div>
            <div className={styles.foot}>
              <PriceSummary bill={bill} variant="combined" />
              <Button href="/cart/" block iconEnd="arrow" onClick={onNavigate}>
                Review &amp; checkout
              </Button>
            </div>
          </>
        ) : (
          <p className={cx('t-small c3', styles.empty)}>Your cart is empty</p>
        )}
      </div>
    </aside>
  );
}
