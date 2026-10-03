'use client';

import Link from 'next/link';
import { useContent, useRestaurant } from '@/api/hooks';
import { Button, Icon, Skeleton } from '@/components/ui';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { Columns } from '@/components/layout/Shells';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { OrderingBanner } from '@/components/status/OrderingBanner';
import { Breadcrumbs } from '@/components/menu/Breadcrumbs';
import { useCart } from '@/hooks/useCart';
import { cx } from '@/lib/cx';
import { formatINR } from '@/lib/format';
import { CartLineItem } from './CartLineItem';
import { EmptyCart } from './EmptyCart';
import { CartSuggestions } from './CartSuggestions';
import { KitchenNote } from './KitchenNote';
import { PriceSummary } from './PriceSummary';
import styles from './CartView.module.css';

/** Cart (08 · w08) and empty cart (s06 · ws06). */
export function CartView() {
  const { lines, bill, kitchenNote, setKitchenNote, hydrated } = useCart();
  const t = useContent('cart');
  const { prepTime } = useRestaurant();

  // The empty state brings its own h1 ("Your cart is empty"), so the top bar title steps down.
  const renderHeader = (empty = false) => (
    <>
      <SiteHeader />
      <MobileHeader
        variant="topbar"
        title={t('meta.title')}
        titleAs={empty ? 'p' : undefined}
        backHref="/menu/"
        backLabel={t('header.backLabel')}
      />
      <OrderingBanner />
    </>
  );

  if (!hydrated) {
    return (
      <>
        {renderHeader()}
        <main
          id="main"
          className={styles.loading}
          aria-busy="true"
          aria-label={t('header.loading')}
        >
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
        {renderHeader(true)}
        <main id="main">
          <EmptyCart />
        </main>
      </>
    );
  }

  const checkout = (
    <Button href="/checkout/details/" block iconEnd="arrow">
      {t('page.checkout')}
    </Button>
  );

  return (
    <>
      {renderHeader()}
      <Columns>
        <main id="main" className={styles.main}>
          <Breadcrumbs
            items={[
              { label: t('breadcrumbs.menu'), href: '/menu/' },
              { label: t('breadcrumbs.cart') },
            ]}
          />
          <div className={cx(styles.pageHead, 'hide-mobile')}>
            <h1 className="t-display">{t('meta.title')}</h1>
            <Button href="/menu/" variant="secondary" size="sm" iconStart="plus">
              {t('page.addMoreItems')}
            </Button>
          </div>
          <section aria-labelledby="cart-items">
            <div className={cx(styles.itemsHead, 'hide-desktop')}>
              <h2 id="cart-items" className="t-h2">
                {t.plural('itemCount', bill.itemCount)}
              </h2>
              <Link href="/menu/" className={styles.addMore}>
                <Icon name="plus" size="xs" />
                {t('page.addMore')}
              </Link>
            </div>
            <ul className={styles.panel} aria-label={t('page.itemsLabel')}>
              {lines.map((line) => (
                <CartLineItem key={line.key} line={line} />
              ))}
            </ul>
          </section>
          <CartSuggestions />
          <KitchenNote value={kitchenNote} onChange={setKitchenNote} />
          <section className={cx(styles.bill, 'hide-desktop')} aria-labelledby="bill-m">
            <h2 id="bill-m" className="t-h3">
              {t('page.billSummary')}
            </h2>
            <PriceSummary bill={bill} variant="split" />
          </section>
          <p className={cx('t-small c3', styles.fine, 'hide-desktop')}>{t('page.fineMobile')}</p>
        </main>

        <aside className={cx(styles.aside, 'hide-mobile')} aria-labelledby="bill-d">
          <h2 id="bill-d" className="t-h2">
            {t('page.billSummary')}
          </h2>
          <PriceSummary bill={bill} variant="split" showCount />
          <p className={cx('t-small', styles.eta)}>
            <Icon name="clock" size="xs" />
            {t('page.eta', { time: prepTime })}
          </p>
          {checkout}
          <p className={cx('t-small c3', styles.lockNote)}>
            <Icon name="lock" size="xs" />
            {t('page.fineDesktop')}
          </p>
        </aside>
      </Columns>

      <div className={cx(styles.actionbar, 'hide-desktop')}>
        <p className={styles.etaBar}>
          <span className={styles.etaPill}>
            <Icon name="clock" size="xs" />
            {t('page.etaAfterOrder', { time: prepTime })}
          </span>
        </p>
        <div className={styles.total}>
          <span className={styles.totalAmt}>{formatINR(bill.total)}</span>
          <span className="t-small c3">{t('page.totalLabel')}</span>
        </div>
        {checkout}
      </div>
    </>
  );
}
