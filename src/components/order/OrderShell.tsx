'use client';

import type { ReactNode } from 'react';
import { useContent } from '@/api/hooks';
import { Button, EmptyState, Skeleton } from '@/components/ui';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { Page } from '@/components/layout/Shells';
import { SiteHeader } from '@/components/layout/SiteHeader';
import styles from './OrderShell.module.css';

export interface OrderShellProps {
  /** Mobile top-bar title, e.g. "Order #A104" (the page has its own h1). */
  title: string;
  children: ReactNode;
  className?: string;
}

/** Both headers and the page column for an order screen; the mobile back button goes to My orders. */
export function OrderShell({ title, children, className }: OrderShellProps) {
  const t = useContent('orders');
  return (
    <Page>
      <SiteHeader />
      <MobileHeader
        variant="topbar"
        title={title}
        titleAs="p"
        backHref="/orders/"
        backLabel={t('shell.backToOrders')}
      />
      <main id="main" className={className}>
        {children}
      </main>
    </Page>
  );
}

/** Placeholder while orders load from this device. */
export function OrderLoading({ title }: { title: string }) {
  const t = useContent('orders');
  return (
    <OrderShell title={title} className={styles.loading}>
      <div className={styles.loadingBody} aria-busy="true" aria-label={t('shared.loadingOrder')}>
        <Skeleton shape="title" width={180} />
        <Skeleton shape="block" width="100%" height={220} />
        <Skeleton shape="block" width="100%" height={160} />
      </div>
    </OrderShell>
  );
}

/** An order id this device doesn't know (or an order page opened without one). */
export function OrderNotFound({ id }: { id: string | null }) {
  const t = useContent('orders');
  return (
    <OrderShell
      title={id ? t('shared.orderNumber', { id }) : t('shell.notFound.title')}
      className={styles.missing}
    >
      <EmptyState
        icon="receipt"
        tone="neutral"
        as="h1"
        title={t('shell.notFound.title')}
        actions={
          <>
            <Button href="/orders/">{t('shared.myOrders')}</Button>
            <Button href="/menu/" variant="secondary">
              {t('shared.browseMenu')}
            </Button>
          </>
        }
      >
        {id ? t('shell.notFound.body', { id }) : t('shell.notFound.bodyNoId')}
      </EmptyState>
    </OrderShell>
  );
}
