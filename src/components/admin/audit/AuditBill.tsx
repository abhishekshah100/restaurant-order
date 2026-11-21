'use client';

import { useEffect } from 'react';
import { useBranchOrder, useContent } from '@/api/hooks';
import { LoadingSignal } from '@/components/layout/GlobalLoader';
import { useToast } from '@/context/ToastContext';
import { PaymentOrderDialog } from '../payments/PaymentOrderDialog';
import { usePaymentPrint } from '../payments/PaymentPrint';
import { useAdminWorkspace } from '../shell/AdminWorkspace';

/**
 * An activity entry's bill: the order read only when it's opened (GET …/orders/:id), then the
 * Payments page's order pop-up — items, the bill, every payment and refund, Print — to look at
 * (nothing is collected or refunded from here). Downloaded the first time one opens.
 */
export function AuditBill({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const { showToast } = useToast();
  const order = useBranchOrder(branch.id, orderId);
  const print = usePaymentPrint();
  const failed = order.isError;

  useEffect(() => {
    if (!failed) return;
    showToast(t('adminAudit.bill.failed', { order: orderId }), { tone: 'error' });
    onClose();
  }, [failed, orderId, onClose, showToast, t]);

  if (order.isPending) return <LoadingSignal />;
  return (
    <>
      <PaymentOrderDialog order={order.data} onClose={onClose} onPrint={(o) => print.bill([o])} />
      {print.sheet}
    </>
  );
}
