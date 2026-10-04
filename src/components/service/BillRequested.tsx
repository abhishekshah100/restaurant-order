'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { useContent, useHelpTopics, useRegion } from '@/api/hooks';
import { useServiceRequest } from '@/context/ServiceRequestContext';
import { cx } from '@/lib/cx';
import { PAY_BILL_PATH, billFor } from '@/lib/service';
import { BillTotals } from './BillTotals';
import { HelpTopicDialog } from './HelpTopicDialog';
import { NoRequest, RequestLoading, RequestStatus } from './RequestStatus';
import { useTableVisit } from './useTableVisit';
import styles from './Summary.module.css';
import { useDineInOnly } from '@/hooks/useDineInOnly';

/** Bill requested (21 · w21). */
export function BillRequested() {
  useDineInOnly();
  const { requests, hydrated } = useServiceRequest();
  const { table, sessionId, orders, hydrated: ordersReady } = useTableVisit();
  const helpTopics = useHelpTopics();
  const t = useContent('service');
  const { money } = useRegion();
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
  // As drawn in 21 · w21, but only for "Just my orders": the server brings the whole table's bill.
  const canPay = bill.payableTotal > 0;

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
            {canPay && (
              <Button href={PAY_BILL_PATH} block={layout === 'mobile'} iconStart="lock">
                {t('shared.payNow', { amount: money.format(bill.payableTotal) })}
              </Button>
            )}
            <Button
              href="/menu/"
              variant={canPay ? 'secondary' : 'primary'}
              block={layout === 'mobile'}
            >
              {t('billRequested.payServer')}
            </Button>
            <Button
              variant={canPay ? 'ghost' : 'secondary'}
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
