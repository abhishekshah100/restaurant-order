import type { ReactNode, Ref } from 'react';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { Page } from '@/components/layout/Shells';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { useContent } from '@/api/hooks';
import { Button, EmptyState, Icon, Skeleton, type IconName } from '@/components/ui';
import { cx } from '@/lib/cx';
import styles from './RequestStatus.module.css';

interface RequestStatusProps {
  icon: IconName;
  tone?: 'brand' | 'ok';
  title: string;
  lede: ReactNode;
  /** Request summary under the text. */
  summary: ReactNode;
  /** Buttons: in the card on web, pinned to the bottom on mobile. */
  actions: (layout: 'mobile' | 'desktop') => ReactNode;
  /** The title, for moving focus to it when the page changes state in place. */
  titleRef?: Ref<HTMLHeadingElement>;
}

/** Shared frame of the "waiter requested" and "bill requested" pages (19 · w19 · 21 · w21). */
export function RequestStatus({
  icon,
  tone = 'brand',
  title,
  lede,
  summary,
  actions,
  titleRef,
}: RequestStatusProps) {
  return (
    <RequestFrame>
      <main id="main" className={styles.main}>
        <section className={styles.card} aria-labelledby="request-title">
          <div className={cx(styles.art, tone === 'ok' && styles.ok)} aria-hidden="true">
            <Icon name={icon} />
          </div>
          <div className={styles.text} role="status">
            <h1
              id="request-title"
              className="t-h1"
              ref={titleRef}
              tabIndex={titleRef ? -1 : undefined}
            >
              {title}
            </h1>
            <p className={cx('t-body c2', styles.lede)}>{lede}</p>
          </div>
          {summary}
          <div className={cx(styles.actions, 'hide-mobile')}>{actions('desktop')}</div>
        </section>
        <div className={cx(styles.foot, 'hide-desktop')}>{actions('mobile')}</div>
      </main>
    </RequestFrame>
  );
}

function RequestFrame({ children }: { children: ReactNode }) {
  return (
    <Page>
      <SiteHeader />
      <MobileHeader variant="pill-end" />
      {children}
    </Page>
  );
}

export function RequestLoading() {
  const t = useContent('service');
  return (
    <RequestFrame>
      <main
        id="main"
        className={styles.loading}
        aria-busy="true"
        aria-label={t('requestStatus.loading')}
      >
        <Skeleton shape="circle" width={112} height={112} />
        <Skeleton shape="title" width={220} />
        <Skeleton shape="block" width="100%" height={120} />
      </main>
    </RequestFrame>
  );
}

interface NoRequestProps {
  icon: IconName;
  title: string;
  children: ReactNode;
  action: { label: string; href: string };
}

/** Shown when the page is opened without a pending request (expired or cancelled elsewhere). */
export function NoRequest({ icon, title, children, action }: NoRequestProps) {
  const t = useContent('service');
  return (
    <RequestFrame>
      <main id="main" className={styles.none}>
        <EmptyState
          icon={icon}
          tone="neutral"
          as="h1"
          title={title}
          actions={
            <>
              <Button href={action.href}>{action.label}</Button>
              <Button href="/menu/" variant="ghost">
                {t('shared.backToMenu')}
              </Button>
            </>
          }
        >
          {children}
        </EmptyState>
      </main>
    </RequestFrame>
  );
}
