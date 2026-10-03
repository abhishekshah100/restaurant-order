'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { useContent, useHelpTopics } from '@/api/hooks';
import { useServiceRequest } from '@/context/ServiceRequestContext';
import { cx } from '@/lib/cx';
import { billFor } from '@/lib/service';
import { BillTotals } from './BillTotals';
import { HelpTopicDialog } from './HelpTopicDialog';
import { NoRequest, RequestLoading, RequestStatus } from './RequestStatus';
import { useTableOrders } from './useTableOrders';
import styles from './Summary.module.css';

/** Bill requested (21 · w21). */
export function BillRequested() {
  const { requests, hydrated } = useServiceRequest();
  const { table, sessionId, orders, hydrated: ordersReady } = useTableOrders();
  const helpTopics = useHelpTopics();
  const t = useContent('service');
  const [helpOpen, setHelpOpen] = useState(false);
  const request = requests.bill;

  if (!hydrated || !ordersReady) return <RequestLoading />;
  if (!request) {
    return (
      <NoRequest
        icon="receipt"
        title={t('billRequested.noneTitle')}
        action={{ label: t('shared.requestTheBill'), href: '/help/bill/' }}
      >
        {t('billRequested.noneBody', { table })}
      </NoRequest>
    );
  }

  const bill = billFor(orders, request.scope, sessionId);

  return (
    <>
      <RequestStatus
        icon="receipt"
        title={t('shared.billRequested')}
        lede={t('billRequested.lede', { table })}
        summary={
          bill.orders.length > 0 && (
            <>
              <section
                className={cx(styles.card, 'hide-desktop')}
                aria-label={t('shared.billSummary')}
              >
                <BillTotals bill={bill} scope={request.scope} />
              </section>
              <BillTotals
                bill={bill}
                scope={request.scope}
                layout="tiles"
                className={cx(styles.tiles, 'hide-mobile')}
              />
            </>
          )
        }
        actions={(layout) => (
          <>
            <Button href="/menu/" block={layout === 'mobile'}>
              {t('billRequested.payServer')}
            </Button>
            <Button
              variant="secondary"
              block={layout === 'mobile'}
              iconStart="card"
              onClick={() => setHelpOpen(true)}
            >
              {t('billRequested.paymentOptions')}
            </Button>
          </>
        )}
      />
      <HelpTopicDialog
        topic={helpTopics.payment}
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
      />
    </>
  );
}
