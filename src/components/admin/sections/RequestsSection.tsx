'use client';

import { useContent } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { SectionPage } from './SectionPage';
import styles from './RequestsSection.module.css';

/** /admin/dashboard/requests/: waiter calls and bill requests (to be redesigned). */
export function RequestsSection() {
  const t = useContent('common');
  return (
    <SectionPage
      title={t('adminShell.nav.requests')}
      subtitle={t('adminDashboard.sections.requestsSubtitle')}
    >
      <div className={styles.unavailable}>
        <span>
          <Icon name="info" size="md" />
        </span>
        <h2>{t('adminDashboard.requestQueueTitle')}</h2>
        <p>{t('adminDashboard.requestQueueDescription')}</p>
      </div>
    </SectionPage>
  );
}
