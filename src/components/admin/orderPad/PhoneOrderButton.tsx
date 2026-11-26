'use client';

import { useState } from 'react';
import { useContent } from '@/api/hooks';
import { Button, Dialog, OptionGroup } from '@/components/ui';
import type { PhoneMode } from '@/lib/orderPad';
import type { Order } from '@/types/order';
import { CollectDialog } from '../payments/CollectDialog';
import { usePaymentPrint } from '../payments/PaymentPrint';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { OrderPad } from './OrderPad';

/**
 * Phone order, for staff who take orders at a branch with takeaway or delivery on: choose how
 * the customer gets it (skipped when the branch offers just one), then the order pad. Paid now:
 * the payment opens straight after, as for any order.
 */
export function PhoneOrderButton({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const t = useContent('common');
  const { region, can } = useAdminWorkspace();
  const print = usePaymentPrint();
  const modes = (['takeaway', 'delivery'] as const).filter((m) => region.modes[m].enabled);
  const [choosing, setChoosing] = useState(false);
  const [mode, setMode] = useState<PhoneMode | null>(null);
  const [collect, setCollect] = useState<Order | null>(null);
  if (!can('orders.take') || modes.length === 0) return null;

  const start = () => {
    if (modes.length === 1) setMode(modes[0] ?? null);
    else setChoosing(true);
  };

  return (
    <>
      <Button size={size} variant="secondary" iconStart="phone" onClick={start}>
        {t('adminOrderPad.phone.button')}
      </Button>
      {choosing && (
        <Dialog
          open
          onClose={() => setChoosing(false)}
          presentation="adaptive"
          title={t('adminOrderPad.phone.chooseTitle')}
        >
          <OptionGroup
            id="phone-mode"
            type="radio"
            title={t('adminOrderPad.phone.chooseBody')}
            value={undefined}
            onChange={(id) => {
              setChoosing(false);
              setMode(id as PhoneMode);
            }}
            choices={modes.map((m) => ({
              id: m,
              label: t(`adminOrderPad.phone.modes.${m}`),
              sub: t(`adminOrderPad.phone.modesSub.${m}`),
            }))}
          />
        </Dialog>
      )}
      <OrderPad
        target={mode ? { kind: 'phone', mode } : null}
        onClose={() => setMode(null)}
        onPhoneTaken={(order, paidNow) => {
          if (paidNow && can('payments.collect')) setCollect(order);
        }}
      />
      {collect && (
        <CollectDialog
          target={{ kind: 'order', order: collect }}
          onClose={() => setCollect(null)}
          onPrint={(target) => print.bill(target.kind === 'order' ? [target.order] : target.orders)}
        />
      )}
      {print.sheet}
    </>
  );
}
