'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { useContent, useMenu } from '@/api/hooks';
import { Columns } from '@/components/layout/Shells';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { cx } from '@/lib/cx';
import { DishDetail } from './DishDetail';
import styles from './DishPage.module.css';

/**
 * `/dish/?slug=…`: the dish is read from the guest's live menu on the client, so every dish
 * opens here, including ones staff add after the site was built. The static page carries the
 * dish page's shape (DishSkeleton, in the HTML itself), so it never opens blank; the dish
 * replaces it as soon as the address is read. It's read with Next's useSearchParams, which
 * knows the address being opened even before the browser's shows it (a tap from the menu), so
 * the page never shows "Not on the menu here" on its way. Titled with the dish's name once known.
 */
export function DishPage() {
  return (
    <Suspense fallback={<DishSkeleton />}>
      <DishFromAddress />
    </Suspense>
  );
}

function DishFromAddress() {
  const slug = useSearchParams().get('slug') ?? '';
  const dish = useMenu().getDish(slug);
  const common = useContent('common');

  useEffect(() => {
    if (dish) document.title = common('meta.titleTemplate').replace('%s', dish.name);
  }, [common, dish]);

  return <DishDetail slug={slug} />;
}

/** The dish page's outline while it opens: photo, name, description, price and choices. */
function DishSkeleton() {
  const t = useContent('menu');
  return (
    <>
      <SiteHeader showCart />
      <Columns even>
        <div className={styles.photo} />
        <main id="main" className={styles.main} aria-busy="true" aria-label={t('detail.loading')}>
          <span className={cx(styles.line, styles.tag)} />
          <span className={cx(styles.line, styles.title)} />
          <span className={styles.line} />
          <span className={cx(styles.line, styles.short)} />
          <span className={cx(styles.line, styles.price)} />
          <span className={styles.block} />
          <span className={styles.block} />
        </main>
      </Columns>
    </>
  );
}
