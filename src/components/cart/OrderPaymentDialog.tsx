'use client';

import { useState } from 'react';
import { useBranch, useContent, useRegion } from '@/api/hooks';
import { useCreatePayment, useSimulatePayment } from '@/api/mutations';
import type { Payment } from '@/api/contracts';
import { PaymentMethods, type PaymentMethodOption } from '@/components/checkout/PaymentMethods';
import { Banner, Button, Dialog, Spinner } from '@/components/ui';
import { useGuestSession } from '@/context/GuestSessionContext';
import { useCart } from '@/hooks/useCart';
import type { CartPayment, PaymentPrompt } from '@/hooks/useCartAction';
import { useRequestFailed } from '@/hooks/useRequestFailed';
import { orderLine } from '@/lib/cartLine';
import { modePayments } from '@/lib/fulfilment';
import { paidAmount } from '@/lib/lifecycle';
import { PAYMENT_METHODS, isOnlineMethod, pickMethod } from '@/lib/payments';
import type { PaymentMethodId } from '@/types/branch';
import styles from './OrderPaymentDialog.module.css';

interface OrderPaymentDialogProps extends CartPayment {
  prompt: PaymentPrompt | null;
}

/**
 * Paying for a round as it's ordered, or the difference after a change: choose a method, then
 * approve the request (the prototype's success / failure links stand in for the payment
 * partner, POST /payments/:id/simulate). A round can also go on at the counter.
 */
export function OrderPaymentDialog({ prompt, busy, onPaid, onClose }: OrderPaymentDialogProps) {
  const t = useContent('cart');
  return (
    <Dialog
      open={prompt !== null}
      onClose={onClose}
      presentation="adaptive"
      title={
        prompt?.purpose === 'round'
          ? t('orderPayment.titleRound', { round: prompt.round })
          : t('orderPayment.titleChange')
      }
    >
      {prompt && <PaymentFlow prompt={prompt} busy={busy} onPaid={onPaid} onClose={onClose} />}
    </Dialog>
  );
}

function PaymentFlow({
  prompt,
  busy,
  onPaid,
  onClose,
}: OrderPaymentDialogProps & { prompt: PaymentPrompt }) {
  const t = useContent('cart');
  const checkout = useContent('checkout');
  const common = useContent('common');
  const branch = useBranch();
  const { money } = useRegion();
  const sessionId = useGuestSession()?.id;
  const { lines } = useCart();
  const { mutateAsync: createPayment, isPending: opening } = useCreatePayment();
  const { mutateAsync: simulate, mutate: report, isPending: settling } = useSimulatePayment();
  const requestFailed = useRequestFailed();
  const { purpose, order, round } = prompt;
  // A round can also be paid at the counter later; a difference is paid online, like the order.
  const options = modePayments(branch, order.mode).filter(
    (o) => purpose === 'round' || isOnlineMethod(o.id),
  );
  const [chosen, setChosen] = useState<PaymentMethodId | null>(null);
  const [pending, setPending] = useState<Payment | null>(null);
  const [failed, setFailed] = useState(false);
  const method = pickMethod(options, chosen);
  const amount = money.format(pending?.amount ?? prompt.amount);

  const methods: PaymentMethodOption<PaymentMethodId>[] = options.map((o) => ({
    id: o.id,
    title: checkout(`payment.methods.${o.labelKey}.title`),
    mobileSub: checkout(`payment.methods.${o.labelKey}.mobileSub`),
    desktopSub: checkout(`payment.methods.${o.labelKey}.desktopSub`),
    icon: PAYMENT_METHODS[o.id].icon,
  }));

  const pay = async () => {
    if (!sessionId) return;
    if (!isOnlineMethod(method)) {
      onPaid({ method });
      return;
    }
    const body = { sessionId, method, orderId: order.id, lines: lines.map(orderLine) };
    try {
      const payment = await createPayment(
        purpose === 'round' ? { purpose, ...body } : { purpose, round, ...body },
      );
      setFailed(false);
      setPending(payment);
    } catch {
      requestFailed();
    }
  };

  const succeed = async (payment: Payment) => {
    try {
      const settled = await simulate({ id: payment.id, outcome: 'succeeded' });
      onPaid({ method: settled.payment.method, paymentId: settled.payment.id });
    } catch {
      requestFailed();
    }
  };

  if (pending) {
    return (
      <div className={styles.waiting} aria-busy="true">
        <Spinner tone="brand" size="lg" />
        <p className={styles.amount}>{amount}</p>
        <p className={styles.text} role="status">
          {t('orderPayment.waiting', {
            amount,
            name: common(`paymentMethods.${pending.method}`),
          })}
        </p>
        <div className={styles.actions}>
          <Button
            variant="secondary"
            block
            disabled={settling || busy}
            onClick={() => {
              report({ id: pending.id, outcome: 'failed' });
              setPending(null);
              setFailed(true);
            }}
          >
            {checkout('processing.protoFailure')}
          </Button>
          <Button block loading={settling || busy} onClick={() => void succeed(pending)}>
            {checkout('processing.protoSuccess')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.flow}>
      <p className={styles.text}>
        {purpose === 'round'
          ? t('orderPayment.bodyRound', { round, amount })
          : t('orderPayment.bodyChange', {
              total: money.format(paidAmount(order) + prompt.amount),
              paid: money.format(paidAmount(order)),
              amount,
            })}
      </p>
      {failed && (
        <Banner tone="err" icon="alert" live="assertive">
          {t('orderPayment.failed')}
        </Banner>
      )}
      <PaymentMethods
        label={t('orderPayment.methods')}
        methods={methods}
        value={method}
        onChange={setChosen}
      />
      <div className={styles.actions}>
        <Button variant="secondary" block onClick={onClose}>
          {t('orderPayment.close')}
        </Button>
        <Button
          block
          iconStart={isOnlineMethod(method) ? 'lock' : undefined}
          loading={opening || busy}
          onClick={() => void pay()}
        >
          {isOnlineMethod(method)
            ? failed
              ? t('orderPayment.retry')
              : t('orderPayment.pay', { amount })
            : t('orderPayment.send')}
        </Button>
      </div>
    </div>
  );
}
