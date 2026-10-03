'use client';

import { Button, Icon } from '@/components/ui';
import { useCart } from '@/hooks/useCart';
import { useTable } from '@/hooks/useTable';
import { cx } from '@/lib/cx';
import { useContent } from '@/api/hooks';
import { CartLineItem } from './CartLineItem';
import { PriceSummary } from './PriceSummary';
import styles from './CartPanel.module.css';

export interface CartPanelProps {
  /** Rendered inside the tablet slide-over dialog. */
  inDialog?: boolean;
  onNavigate?: () => void;
}

/** "Your order" column on desktop menu pages (w02) and the tablet slide-over. */
export function CartPanel({ inDialog, onNavigate }: CartPanelProps) {
  const { lines, bill, count, hydrated } = useCart();
  const table = useTable();
  const t = useContent('cart');
  const Heading = inDialog ? 'p' : 'h2';

  return (
    <aside className={cx(styles.panel, inDialog && styles.inDialog)} aria-label={t('meta.title')}>
      <div className={inDialog ? undefined : styles.sticky}>
        <div className={styles.head}>
          <Heading className="t-h2">{t('panel.title')}</Heading>
          <span className="t-small c2">
            {hydrated && count > 0
              ? t('panel.tableWithCount', { table, items: t.plural('itemCount', count) })
              : t('panel.table', { table })}
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
                {t('panel.sharedNote', { table })}
              </p>
            </div>
            <div className={styles.foot}>
              <PriceSummary bill={bill} variant="combined" />
              <Button href="/cart/" block iconEnd="arrow" onClick={onNavigate}>
                {t('panel.review')}
              </Button>
            </div>
          </>
        ) : (
          <p className={cx('t-small c3', styles.empty)}>{t('empty.title')}</p>
        )}
      </div>
    </aside>
  );
}
