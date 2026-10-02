'use client';

import Link from 'next/link';
import { Banner, Button, Icon, Input, Skeleton } from '@/components/ui';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { Columns } from '@/components/layout/Shells';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { Breadcrumbs } from '@/components/menu/Breadcrumbs';
import { useCart } from '@/hooks/useCart';
import { useTable } from '@/hooks/useTable';
import { cx } from '@/lib/cx';
import { formatINR, pluralize } from '@/lib/format';
import { CartLineItem } from './CartLineItem';
import { EmptyCart } from './EmptyCart';
import { PriceSummary } from './PriceSummary';
import styles from './CartView.module.css';

/** Cart (08 · w08) and empty cart (s06 · ws06). */
export function CartView() {
  const { lines, bill, kitchenNote, setKitchenNote, hydrated } = useCart();
  const table = useTable();

  const header = (
    <>
      <SiteHeader />
      <MobileHeader variant="topbar" title="Your cart" backHref="/menu/" backLabel="Back to menu" />
    </>
  );

  if (!hydrated) {
    return (
      <>
        {header}
        <main id="main" className={styles.loading} aria-busy="true" aria-label="Loading your cart">
          <Skeleton shape="block" height={64} />
          <Skeleton shape="block" height={88} />
          <Skeleton shape="block" height={88} />
        </main>
      </>
    );
  }

  if (lines.length === 0) {
    return (
      <>
        {header}
        <main id="main">
          <EmptyCart />
        </main>
      </>
    );
  }

  const checkout = (
    <Button href="/checkout/details/" block iconEnd="arrow">
      Checkout
    </Button>
  );

  return (
    <>
      {header}
      <Columns>
        <main id="main" className={styles.main}>
          <Breadcrumbs items={[{ label: 'Menu', href: '/menu/' }, { label: 'Cart' }]} />
          <div className={cx(styles.pageHead, 'hide-mobile')}>
            <h1 className="t-display">Your cart</h1>
            <Button href="/menu/" variant="secondary" size="sm" iconStart="plus">
              Add more items
            </Button>
          </div>
          <Banner tone="info" icon="user">
            <span className="hide-desktop">
              This cart is on your phone only. Others at Table {table} can order separately — the
              bill can be combined later.
            </span>
            <span className="hide-mobile">
              This cart is on your device only. Others at Table {table} order separately — the bill
              can be combined later.
            </span>
          </Banner>
          <section aria-labelledby="cart-items">
            <div className={cx(styles.itemsHead, 'hide-desktop')}>
              <h2 id="cart-items" className="t-h2">
                {pluralize(lines.length, 'item')}
              </h2>
              <Link href="/menu/" className={styles.addMore}>
                <Icon name="plus" size="xs" />
                Add more
              </Link>
            </div>
            <ul className={styles.panel} aria-label="Items in cart">
              {lines.map((line) => (
                <CartLineItem key={line.key} line={line} showEach />
              ))}
            </ul>
          </section>
          <Input
            id="kitchen-note"
            label="Note for the kitchen"
            placeholder="e.g. Serve starters first"
            maxLength={120}
            value={kitchenNote}
            onChange={(e) => setKitchenNote(e.target.value)}
          />
          <section className={cx(styles.bill, 'hide-desktop')} aria-labelledby="bill-m">
            <h2 id="bill-m" className="t-h3">
              Bill summary
            </h2>
            <PriceSummary bill={bill} variant="split" />
          </section>
          <p className={cx('t-small c3', styles.fine, 'hide-desktop')}>
            Prices include no hidden charges. Tipping is optional.
          </p>
        </main>

        <aside className={cx(styles.aside, 'hide-mobile')} aria-labelledby="bill-d">
          <h2 id="bill-d" className="t-h2">
            Bill summary
          </h2>
          <PriceSummary bill={bill} variant="split" showCount />
          {checkout}
          <p className={cx('t-small c3', styles.lockNote)}>
            <Icon name="lock" size="xs" />
            No hidden charges · Tipping is optional
          </p>
        </aside>
      </Columns>

      <div className={cx(styles.actionbar, 'hide-desktop')}>
        <div className={styles.total}>
          <span className={styles.totalAmt}>{formatINR(bill.total)}</span>
          <span className="t-small c3">Total incl. taxes</span>
        </div>
        {checkout}
      </div>
    </>
  );
}
