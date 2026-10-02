'use client';

import { Button, EmptyState } from '@/components/ui';
import { BottomNav } from './BottomNav';
import { MobileHeader } from './MobileHeader';
import { SiteHeader } from './SiteHeader';

/** Temporary page for routes built in Phase 4 (orders, tracking, help). */
export function ComingSoon({ title }: { title: string }) {
  return (
    <>
      <SiteHeader />
      <MobileHeader
        variant="topbar"
        title={title}
        titleAs="p"
        backHref="/menu/"
        backLabel="Back to menu"
      />
      <main id="main">
        <EmptyState
          className="coming-soon"
          icon="clock"
          tone="neutral"
          as="h1"
          title={title}
          actions={<Button href="/menu/">Back to menu</Button>}
        >
          This screen arrives in Phase 4.
        </EmptyState>
      </main>
      <BottomNav />
    </>
  );
}
