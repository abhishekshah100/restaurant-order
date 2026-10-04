'use client';

import { useContent } from '@/api/hooks';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { Button, EmptyState } from '@/components/ui';
import styles from './NotOnMenu.module.css';

/** A dish or category page for something the guest's branch doesn't serve. */
export function NotOnMenu() {
  const t = useContent('menu');
  return (
    <>
      <SiteHeader />
      <MobileHeader variant="topbar" backHref="/menu/" backLabel={t('nav.backToMenu')} />
      <main id="main" className={styles.page}>
        <EmptyState
          icon="cloche"
          tone="neutral"
          as="h1"
          title={t('notOnMenu.title')}
          actions={<Button href="/menu/">{t('nav.backToMenu')}</Button>}
        >
          {t('notOnMenu.body')}
        </EmptyState>
      </main>
    </>
  );
}
