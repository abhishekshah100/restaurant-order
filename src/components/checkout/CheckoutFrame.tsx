'use client';

import type { ReactNode } from 'react';
import { useContent } from '@/api/hooks';
import { Skeleton } from '@/components/ui';
import { CheckoutProgress, type CheckoutStep } from '@/components/layout/CheckoutSteps';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { Columns } from '@/components/layout/Shells';
import { SiteHeader } from '@/components/layout/SiteHeader';
import styles from './Checkout.module.css';

export interface CheckoutFrameProps {
  step: CheckoutStep;
  backHref: string;
  backLabel: string;
  /** False while the guard is resolving; shows a skeleton. */
  ready: boolean;
  children: ReactNode;
  aside: ReactNode;
}

/** Checkout page frame: header + progress, main panel and summary aside. */
export function CheckoutFrame({
  step,
  backHref,
  backLabel,
  ready,
  children,
  aside,
}: CheckoutFrameProps) {
  const t = useContent('checkout');
  return (
    <div className={styles.page}>
      <SiteHeader variant="checkout" step={step} />
      <MobileHeader
        variant="topbar"
        title={t('frame.title')}
        backHref={backHref}
        backLabel={backLabel}
      />
      <CheckoutProgress current={step} />
      {ready ? (
        <Columns className={styles.body}>
          <main id="main" className={styles.main}>
            {children}
          </main>
          {aside}
        </Columns>
      ) : (
        <Columns className={styles.body}>
          <main id="main" className={styles.main} aria-busy="true" aria-label={t('frame.loading')}>
            <Skeleton shape="title" width="70%" />
            <Skeleton shape="block" height={52} />
            <Skeleton shape="block" height={52} />
          </main>
        </Columns>
      )}
    </div>
  );
}
