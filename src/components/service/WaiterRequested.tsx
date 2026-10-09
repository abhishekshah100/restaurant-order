'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Icon } from '@/components/ui';
import { useContent, useRegion } from '@/api/hooks';
import { useServiceRequest } from '@/context/ServiceRequestContext';
import { useToast } from '@/context/ToastContext';
import { cx } from '@/lib/cx';
import { orderPath } from '@/lib/orders';
import { NoRequest, RequestLoading, RequestStatus } from './RequestStatus';
import { useTableVisit } from './useTableVisit';
import styles from './Summary.module.css';
import { useDineInOnly } from '@/hooks/useDineInOnly';

/** Waiter requested (19 · w19). */
export function WaiterRequested() {
  useDineInOnly();
  const router = useRouter();
  const { showToast } = useToast();
  const t = useContent('service');
  const { clock } = useRegion();
  const { requests, cancelRequest, hydrated } = useServiceRequest();
  const { table, latest } = useTableVisit();
  const [leaving, setLeaving] = useState(false);
  const request = requests.waiter;

  if (!hydrated || leaving) return <RequestLoading />;
  if (!request) {
    return (
      <NoRequest
        icon="bell"
        title={t('waiterRequested.noneTitle')}
        action={{ label: t('shared.callAWaiter'), href: '/help/' }}
      >
        {t('waiterRequested.noneBody', { table })}
      </NoRequest>
    );
  }

  const cancel = () => {
    setLeaving(true);
    cancelRequest('waiter');
    showToast(t('waiterRequested.cancelledToast'));
    router.push('/help/');
  };
  const trackHref = latest ? orderPath(latest.id, 'track') : null;

  return (
    <RequestStatus
      icon="bell"
      tone="ok"
      title={t('waiterRequested.title')}
      lede={t('waiterRequested.lede', { table })}
      summary={
        <div className={styles.well}>
          <Icon name="clock" size="sm" className={styles.icon} />
          <p className={styles.text}>
            <span>
              {t.rich(
                'waiterRequested.summary',
                { b: (c) => <b>{c}</b> },
                {
                  reason: t(`waiterDialog.reasons.${request.reason}`),
                  time: clock.time(request.requestedAt),
                },
              )}
            </span>
            {request.note && (
              <span className={styles.note}>{t('shared.quoted', { text: request.note })}</span>
            )}
          </p>
          <button type="button" className={styles.cancel} onClick={cancel}>
            <span className="hide-desktop" aria-hidden="true">
              {t('shared.cancel')}
            </span>
            <span className={cx('hide-mobile')} aria-hidden="true">
              {t('waiterRequested.cancelRequest')}
            </span>
            <span className="visually-hidden">{t('waiterRequested.cancelRequest')}</span>
          </button>
        </div>
      }
      actions={(layout) => (
        <>
          <Button href="/menu/" block={layout === 'mobile'}>
            {t('shared.backToMenu')}
          </Button>
          {trackHref && (
            <Button
              href={trackHref}
              variant={layout === 'mobile' ? 'ghost' : 'secondary'}
              block={layout === 'mobile'}
            >
              {t('waiterRequested.viewOrder')}
            </Button>
          )}
        </>
      )}
    />
  );
}
