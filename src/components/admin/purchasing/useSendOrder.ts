'use client';

import { useCallback } from 'react';
import { isApiError } from '@/api/client';
import { useContent } from '@/api/hooks';
import { usePurchaseOrderStep } from '@/api/mutations';
import { useToast } from '@/context/ToastContext';
import type { PurchaseOrder } from '@/types/purchasing';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { docNumber, usePurchasingText } from './usePurchasingText';

export type SendChannel = 'whatsApp' | 'email';

/** The supplier's number as WhatsApp takes it (digits only), if they have one. */
export const whatsAppNumber = (order: Pick<PurchaseOrder, 'supplier'>) =>
  order.supplier.phone?.replace(/\D/g, '') || undefined;

/**
 * Sending an order to its supplier: the message (what to deliver and when, the note), opened in
 * WhatsApp or the mail app, and the order marked sent at the same time when it's approved and
 * not sent yet (one step, not two). `win` is a window opened from the tap itself, for when the
 * order is saved first (browsers block windows opened later); it's pointed at WhatsApp.
 */
export function useSendOrder() {
  const t = useContent('common');
  const { branch, brand, clock } = useAdminWorkspace();
  const text = usePurchasingText();
  const { showToast } = useToast();
  const step = usePurchaseOrderStep();

  const message = useCallback(
    (order: PurchaseOrder) =>
      [
        t('adminPurchasing.orders.message', {
          number: docNumber('PO', order.number),
          brand,
          date: order.expectedOn ? clock.date(`${order.expectedOn}T12:00:00Z`) : '',
        }),
        ...order.lines.map((l) => `• ${l.name}: ${text.packs(l.quantity, l.pack)}`),
        order.note ?? '',
      ]
        .filter(Boolean)
        .join('\n'),
    [t, brand, clock, text],
  );

  /** Marks it sent (when approved and not sent yet); says so either way. */
  const markSent = useCallback(
    (order: PurchaseOrder, quiet = false) => {
      if (order.status !== 'approved') return;
      step.mutate(
        { branchId: branch.id, id: order.id, step: 'send' },
        {
          onSuccess: () =>
            !quiet && showToast(t('adminPurchasing.orders.done.send'), { tone: 'success' }),
          onError: (error) =>
            showToast(
              isApiError(error, 'po_not_approved')
                ? t('adminPurchasing.errors.notApproved')
                : t('adminInventory.errors.failed'),
              { tone: 'error' },
            ),
        },
      );
    },
    [branch.id, showToast, step, t],
  );

  const send = useCallback(
    (order: PurchaseOrder, channel: SendChannel, win?: Window | null) => {
      const body = message(order);
      if (channel === 'whatsApp') {
        const phone = whatsAppNumber(order);
        if (!phone) return;
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(body)}`;
        if (win) win.location.href = url;
        else window.open(url, '_blank', 'noopener');
      } else {
        if (!order.supplier.email) return;
        window.location.href = `mailto:${order.supplier.email}?subject=${encodeURIComponent(
          `${docNumber('PO', order.number)} · ${brand}`,
        )}&body=${encodeURIComponent(body)}`;
      }
      if (order.status === 'approved') {
        markSent(order, true);
        showToast(
          t('adminPurchasing.orders.sentVia', {
            channel: t(`adminPurchasing.orders.channels.${channel}`),
          }),
          {
            tone: 'success',
          },
        );
      }
    },
    [brand, markSent, message, showToast, t],
  );

  return { send, markSent, pending: step.isPending };
}
