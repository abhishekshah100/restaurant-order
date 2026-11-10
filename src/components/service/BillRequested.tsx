'use client';

import { Button } from '@/components/ui';
import { useContent, useRegion } from '@/api/hooks';
import { useRegionCopy } from '@/hooks/useRegionCopy';
import { useServiceRequest } from '@/context/ServiceRequestContext';
import { PAY_BILL_PATH, billFor, firstName } from '@/lib/service';
import { BillTotals } from './BillTotals';
import { NoRequest, RequestLoading, RequestStatus } from './RequestStatus';
import { useTableVisit } from './useTableVisit';
import styles from './Summary.module.css';
import { useDineInOnly } from '@/hooks/useDineInOnly';

// Not in this phase: "Payment options" opened the payment FAQ in a pop-up (HelpTopicDialog, with
// useHelpTopics().payment and a `helpOpen` state). Brought back by restoring them and the button.

/** Bill requested (21 · w21). */
export function BillRequested() {
  useDineInOnly();
  const { requests, hydrated } = useServiceRequest();
  const { table, sessionId, orders, hydrated: ordersReady } = useTableVisit();
  const t = useContent('service');
  const { money } = useRegion();
  const { paymentMethods } = useRegionCopy();
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
        lede={
          request.acknowledgedBy
            ? t('billRequested.comingLede', {
                name: firstName(request.acknowledgedBy),
                table,
                paymentMethods,
              })
            : t('billRequested.lede', { table, paymentMethods })
        }
        summary={
          bill.orders.length > 0 && (
            // The bill as it'll be printed: items, service charge, each tax, round off, total.
            <section className={styles.card} aria-label={t('shared.billSummary')}>
              <BillTotals bill={bill} scope={request.scope} breakdown />
            </section>
          )
        }
        actions={(layout) => (
          <>
            {canPay && (
              <Button href={PAY_BILL_PATH} block={layout === 'mobile'} iconStart="lock">
                {t('shared.payNow', { amount: money.format(bill.payableTotal) })}
              </Button>
            )}
            {/* Nothing to do here meanwhile: back to the menu (pay the server when the bill comes). */}
            <Button
              href="/menu/"
              variant={canPay ? 'secondary' : 'primary'}
              block={layout === 'mobile'}
            >
              {canPay ? t('billRequested.payAtTable') : t('billRequested.backToMenu')}
            </Button>
            {/*
              Not in this phase: "Payment options" (the payment FAQ in a pop-up).
              <Button
                variant={canPay ? 'ghost' : 'secondary'}
                block={layout === 'mobile'}
                iconStart="card"
                onClick={() => setHelpOpen(true)}
              >
                {t('billRequested.paymentOptions')}
              </Button>
            */}
          </>
        )}
      />
      {/* Not in this phase: the payment FAQ pop-up (see "Payment options" above).
      {helpOpen && (
        <HelpTopicDialog topic={helpTopics.payment} open onClose={() => setHelpOpen(false)} />
      )} */}
    </>
  );
}
