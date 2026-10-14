import type { ReactNode } from 'react';
import { useContent } from '@/api/hooks';
import { Icon } from '@/components/ui';
import styles from './SectionPage.module.css';

/*
 * The frame the admin sections share until each is redesigned: a title card, then the
 * section's content. Also their empty and error notes.
 */

export function SectionPage({
  title,
  subtitle,
  note,
  children,
}: {
  title: string;
  subtitle: string;
  /** A caveat about the data, under the subtitle. */
  note?: string;
  children: ReactNode;
}) {
  const t = useContent('common');
  return (
    <section className={styles.sectionPage}>
      <div className={styles.sectionTitle}>
        <span className={styles.eyebrow}>{t('adminDashboard.branchWorkspace')}</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        {note && <DataBanner>{note}</DataBanner>}
      </div>
      {children}
    </section>
  );
}

/** A quiet note about the data shown. */
export function DataBanner({ children }: { children: ReactNode }) {
  return (
    <div className={styles.dataBanner}>
      <Icon name="info" size="xs" />
      {children}
    </div>
  );
}

export function SectionEmpty({ label }: { label: string }) {
  return (
    <div className={styles.emptyState}>
      <span>
        <Icon name="receipt" size="sm" />
      </span>
      <p>{label}</p>
    </div>
  );
}

export function ErrorNotice({ children }: { children: ReactNode }) {
  return <div className={styles.errorNotice}>{children}</div>;
}
