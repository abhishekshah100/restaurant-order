'use client';

import { useState } from 'react';
import { isApiError } from '@/api/client';
import { useContent, usePurchaseOrders } from '@/api/hooks';
import { usePurchaseOrderStep } from '@/api/mutations';
import { Button, Chip, Icon, SearchField } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { cx } from '@/lib/cx';
import {
  ORDER_VIEWS,
  inView,
  matchesOrder,
  nextAction,
  viewCounts,
  type OrderView,
} from '@/lib/purchasingFlow';
import type { PurchaseOrder } from '@/types/purchasing';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { OrderProgress } from './OrderProgress';
import { StatusChip } from './StatusChip';
import { useSendOrder, whatsAppNumber } from './useSendOrder';
import { docNumber, usePurchasingText } from './usePurchasingText';
import styles from './Purchasing.module.css';

/**
 * Purchasing › Orders: every order as a card (supplier, number, items, total, when it's due, how
 * far along: placed, sent, arrived) with the one next step on it for whoever may take it:
 * Approve, Send on WhatsApp (which marks it sent), Receive. Views: to do, on the way, done, all,
 * each with its count; search by number or supplier. A card opens the order.
 */
export function OrdersTab({
  onOpen,
  onReceive,
}: {
  onOpen: (id: string | 'new') => void;
  onReceive: (orderId?: string) => void;
}) {
  const t = useContent('common');
  const { branch, can, clock } = useAdminWorkspace();
  const query = usePurchaseOrders(branch.id, {});
  const [view, setView] = useState<OrderView>('todo');
  const [search, setSearch] = useState('');
  const today = clock.dayKey(new Date());

  if (!query.data) {
    return (
      <p className={styles.muted} aria-busy={!query.isError}>
        {query.isError ? t('adminInventory.failed') : t('adminInventory.loading')}
      </p>
    );
  }
  const orders = query.data.orders;
  const counts = viewCounts(orders);
  const shown = orders.filter((o) => inView(o, view) && matchesOrder(o, search));

  return (
    <div className={styles.today}>
      <div className={styles.toolbar}>
        <div className={styles.quick}>
          {can('purchase.manage') && (
            <Button iconStart="plus" onClick={() => onOpen('new')}>
              {t('adminPurchasing.orders.new')}
            </Button>
          )}
          {can('purchase.receive', 'purchase.manage') && (
            <Button variant="secondary" iconStart="bag" onClick={() => onReceive()}>
              {t('adminPurchasing.receive.title')}
            </Button>
          )}
        </div>
        <SearchField
          value={search}
          onChange={setSearch}
          label={t('adminPurchasing.orders.search')}
          placeholder={t('adminPurchasing.orders.search')}
          className={styles.search}
        />
      </div>
      <div
        className={styles.views}
        role="group"
        aria-label={t('adminPurchasing.orders.views.label')}
      >
        {ORDER_VIEWS.map((v) => (
          <Chip key={v} pressed={view === v} onClick={() => setView(v)}>
            {t(`adminPurchasing.orders.views.${v}`)}
            <span className={styles.viewCount}>{counts[v]}</span>
          </Chip>
        ))}
      </div>
      {shown.length === 0 ? (
        <div className={styles.empty}>
          <Icon name="receipt" size="md" />
          <p>
            {search
              ? t('adminPurchasing.orders.noMatch')
              : t(`adminPurchasing.orders.empty.${view}`)}
          </p>
          {view === 'todo' && !search && orders.length === 0 && can('purchase.manage') && (
            <Button size="sm" iconStart="plus" onClick={() => onOpen('new')}>
              {t('adminPurchasing.orders.new')}
            </Button>
          )}
        </div>
      ) : (
        <ul className={styles.orderCards}>
          {shown.map((o) => (
            <li key={o.id}>
              <OrderCard order={o} today={today} onOpen={onOpen} onReceive={onReceive} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** One order on the list, with its next step. */
function OrderCard({
  order,
  today,
  onOpen,
  onReceive,
}: {
  order: PurchaseOrder;
  today: string;
  onOpen: (id: string) => void;
  onReceive: (orderId?: string) => void;
}) {
  const t = useContent('common');
  const { branch, can, clock } = useAdminWorkspace();
  const text = usePurchasingText();
  const { showToast } = useToast();
  const step = usePurchaseOrderStep();
  const { send } = useSendOrder();
  const next = nextAction(order, {
    approve: can('purchase.approve'),
    manage: can('purchase.manage'),
    receive: can('purchase.receive', 'purchase.manage'),
  });
  const late =
    order.expectedOn !== undefined &&
    order.expectedOn < today &&
    ['approved', 'sent', 'partly_received'].includes(order.status);

  const approve = () =>
    step.mutate(
      { branchId: branch.id, id: order.id, step: 'approve' },
      {
        onSuccess: () => showToast(t('adminPurchasing.orders.done.approve'), { tone: 'success' }),
        onError: (error) =>
          showToast(
            isApiError(error, 'po_not_editable')
              ? t('adminPurchasing.errors.notEditable')
              : t('adminInventory.errors.failed'),
            { tone: 'error' },
          ),
      },
    );

  let action = null;
  if (next === 'approve') {
    action = (
      <Button size="sm" iconStart="check" loading={step.isPending} onClick={approve}>
        {t('adminPurchasing.orders.approve')}
      </Button>
    );
  } else if (next === 'send') {
    action = whatsAppNumber(order) ? (
      <Button size="sm" iconStart="whatsapp" onClick={() => send(order, 'whatsApp')}>
        {t('adminPurchasing.orders.whatsApp')}
      </Button>
    ) : (
      <Button size="sm" iconStart="arrow" onClick={() => onOpen(order.id)}>
        {t('adminPurchasing.orders.sendOpen')}
      </Button>
    );
  } else if (next === 'receive') {
    action = (
      <Button size="sm" iconStart="bag" onClick={() => onReceive(order.id)}>
        {t('adminPurchasing.orders.receive')}
      </Button>
    );
  }

  return (
    <article className={cx(styles.orderCard, late && styles.orderLate)}>
      <button type="button" className={styles.orderOpen} onClick={() => onOpen(order.id)}>
        <span className={styles.orderTop}>
          <span className={styles.orderSupplier}>{order.supplier.name}</span>
          <StatusChip status={order.status} />
        </span>
        <span className={styles.orderMeta}>
          {[
            docNumber('PO', order.number),
            t.plural('adminPurchasing.orders.lineCount', order.lines.length),
            order.total !== undefined && text.money(order.total),
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
        {order.expectedOn && (
          <span className={cx(styles.orderDue, late && styles.orderDueLate)}>
            <Icon name="calendar" size="xs" />
            {late
              ? t('adminPurchasing.today.lateSince', {
                  date: clock.day(order.expectedOn),
                })
              : t('adminPurchasing.orders.expected', {
                  date: clock.day(order.expectedOn),
                })}
          </span>
        )}
      </button>
      <div className={styles.orderFoot}>
        <OrderProgress status={order.status} />
        {action}
      </div>
    </article>
  );
}
