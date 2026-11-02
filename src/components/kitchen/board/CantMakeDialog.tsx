'use client';

import { useState } from 'react';
import { useContent } from '@/api/hooks';
import { useMarkUnavailable, useSetDishAvailability } from '@/api/mutations';
import { useAdminWorkspace } from '@/components/admin/shell/AdminWorkspace';
import { Button, Dialog, QuantityStepper } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import type { KitchenTicket } from '@/lib/kitchenBoard';
import type { Dish } from '@/types/menu';
import { useKitchenThemeClass } from '../shell/useKitchenTheme';
import { useTicketWhere } from '../useTicketWhere';
import styles from './CantMakeDialog.module.css';

/**
 * The kitchen can't make an item (sold out): how many of it, and whether the dish goes off the
 * menu too (on to start with). It comes off the guest's bill and the waiters are told; or the
 * whole order can't be made, and it's cancelled as out of stock.
 */
export function CantMakeDialog({
  ticket,
  index,
  dish,
  onClose,
}: {
  ticket: KitchenTicket;
  /** The item's place on the ticket (its round's). */
  index: number;
  /** The dish on the menu now, if it's still there. */
  dish: Dish | undefined;
  onClose: () => void;
}) {
  const t = useContent('kitchen');
  const { branch } = useAdminWorkspace();
  const themeClass = useKitchenThemeClass();
  const whereOf = useTicketWhere();
  const { showToast } = useToast();
  const mark = useMarkUnavailable();
  const availability = useSetDishAvailability();
  const item = ticket.items[index];
  const [quantity, setQuantity] = useState(item?.quantity ?? 1);
  const [offMenu, setOffMenu] = useState(true);
  if (!item) return null;

  const target = { branchId: branch.id, orderId: ticket.orderId };
  const done = (message: string) => {
    if (offMenu && dish) {
      availability.mutate({
        branchId: branch.id,
        slug: dish.slug,
        body: { availability: { status: 'sold-out' } },
      });
    }
    showToast(message);
    onClose();
  };
  const failed = () => showToast(t('cantMake.failed'), { tone: 'error' });

  const removeItem = () =>
    mark.mutate(
      {
        kind: 'item',
        ...target,
        round: ticket.round,
        index,
        quantity,
        note: t('cantMake.itemNote', { dish: item.name, count: quantity }),
      },
      { onSuccess: () => done(t('cantMake.itemDone', { dish: item.name })), onError: failed },
    );
  const removeOrder = () =>
    mark.mutate(
      { kind: 'order', ...target, note: t('cantMake.orderNote', { order: ticket.orderId }) },
      {
        onSuccess: () => done(t('cantMake.orderDone', { order: ticket.orderId })),
        onError: failed,
      },
    );

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('cantMake.title', { dish: item.name })}
      description={t('cantMake.subtitle', { where: whereOf(ticket), order: ticket.orderId })}
      presentation="adaptive"
      className={themeClass}
      footer={
        <div className={styles.actions}>
          <Button block iconStart="xc" loading={mark.isPending} onClick={removeItem}>
            {t.plural('cantMake.confirm', quantity)}
          </Button>
          <Button
            block
            variant="ghost"
            className={styles.whole}
            disabled={mark.isPending}
            onClick={removeOrder}
          >
            {t('cantMake.wholeOrder')}
          </Button>
        </div>
      }
    >
      <div className={styles.body}>
        <p className={styles.explain}>{t('cantMake.explain')}</p>
        {item.quantity > 1 && (
          <div className={styles.row}>
            <span className={styles.label}>{t('cantMake.howMany')}</span>
            <QuantityStepper
              value={quantity}
              min={1}
              max={item.quantity}
              variant="outline"
              itemName={item.name}
              onChange={setQuantity}
            />
          </div>
        )}
        {dish && (
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={offMenu}
              onChange={(event) => setOffMenu(event.target.checked)}
            />
            <span>
              <b>{t('cantMake.offMenu', { dish: dish.name })}</b>
              <span className={styles.hint}>{t('cantMake.offMenuHint')}</span>
            </span>
          </label>
        )}
      </div>
    </Dialog>
  );
}
