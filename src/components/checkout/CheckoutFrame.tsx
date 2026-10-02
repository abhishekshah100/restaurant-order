'use client';

import type { ReactNode } from 'react';
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
  /** Bottom actions on mobile when they aren't part of a form inside `children`. */
  mobileFoot?: ReactNode;
}

/** Checkout page frame: header + progress, main panel, summary aside, mobile footer. */
export function CheckoutFrame({
  step,
  backHref,
  backLabel,
  ready,
  children,
  aside,
  mobileFoot,
}: CheckoutFrameProps) {
  return (
    <div className={styles.page}>
      <SiteHeader variant="checkout" step={step} />
      <MobileHeader variant="topbar" title="Checkout" backHref={backHref} backLabel={backLabel} />
      <CheckoutProgress current={step} />
      {ready ? (
        <>
          <Columns className={styles.body}>
            <main id="main" className={styles.main}>
              {children}
            </main>
            {aside}
          </Columns>
          {mobileFoot && <div className={`${styles.mobileFoot} hide-desktop`}>{mobileFoot}</div>}
        </>
      ) : (
        <Columns className={styles.body}>
          <main id="main" className={styles.main} aria-busy="true" aria-label="Loading checkout">
            <Skeleton shape="title" width="70%" />
            <Skeleton shape="block" height={52} />
            <Skeleton shape="block" height={52} />
          </main>
        </Columns>
      )}
    </div>
  );
}
