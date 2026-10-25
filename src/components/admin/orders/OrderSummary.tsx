import { useContent } from '@/api/hooks';
import { StatusPill, VegMark } from '@/components/ui';
import { amountDue } from '@/lib/lifecycle';
import type { Order } from '@/types/order';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { PaymentBadge } from './PaymentBadge';
import styles from './OrderDetailDialog.module.css';

/**
 * Everything on one order, for staff: its kitchen and payment state, where it goes (pickup
 * time, delivery address and rider), each dish with its choices and note (by round, on a
 * running order), the kitchen note, the bill (discounts, paid, still to pay), how it's paid
 * and its progress.
 */
export function OrderSummary({ order }: { order: Order }) {
  const t = useContent('common');
  const { money, clock } = useAdminWorkspace();
  const discount = (order.discounts ?? []).reduce((sum, d) => sum + d.amount, 0);
  const due = amountDue(order);
  const paid = order.total - due;
  const itemCount = order.items.reduce((n, item) => n + item.quantity, 0);
  // A running order lists its rounds (when each went to the kitchen, its status, who took it).
  const rounds = (order.rounds ?? []).filter((r) => r.status !== 'cancelled');
  const groups =
    rounds.length > 1
      ? rounds.map((round) => ({ key: `round-${round.number}`, round, items: round.items }))
      : [{ key: 'items', round: undefined, items: order.items }];

  return (
    <div className={styles.detail}>
      <div className={styles.statuses}>
        <StatusPill status={order.status} />
        <PaymentBadge status={order.payment.status}>
          {t(`adminDashboard.paymentStatus.${order.payment.status}`)}
        </PaymentBadge>
      </div>

      <Fulfilment order={order} />

      <section className={styles.section} aria-labelledby="order-items">
        <h3 id="order-items" className={styles.heading}>
          {t('adminOrder.items')}
          <span className={styles.headingMeta}>{t.plural('adminOrder.itemCount', itemCount)}</span>
        </h3>
        {groups.map((group) => (
          <div key={group.key} className={styles.round}>
            {group.round && (
              <div className={styles.roundHead}>
                <span className={styles.roundTitle}>
                  {t('adminOrder.round', {
                    round: group.round.number,
                    time: clock.time(group.round.placedAt),
                  })}
                </span>
                <StatusPill status={group.round.status} />
                {group.round.timeline[0]?.note && (
                  <span className={styles.roundNote}>{group.round.timeline[0].note}</span>
                )}
                {group.round.kitchenNote && (
                  <span className={styles.roundKitchen}>
                    {t('adminOrder.roundKitchenNote', { note: group.round.kitchenNote })}
                  </span>
                )}
              </div>
            )}
            <ul className={styles.items}>
              {group.items.map((item, index) => (
                <li key={`${item.dishSlug}-${index}`} className={styles.item}>
                  <VegMark veg={item.veg} className={styles.veg} />
                  <span className={styles.qty}>{item.quantity}</span>
                  <span className={styles.itemBody}>
                    <span className={styles.itemName}>{item.name}</span>
                    {/* details already open with the variant; it stands alone only without them */}
                    {(item.details.length ? item.details : [item.variant])
                      .filter(Boolean)
                      .map((line, i) => (
                        <span key={`${line}-${i}`} className={styles.itemLine}>
                          {line}
                        </span>
                      ))}
                    {item.note && (
                      <span className={styles.itemNote}>
                        {t('adminOrder.itemNote', { note: item.note })}
                      </span>
                    )}
                  </span>
                  <span className={styles.price}>
                    {money.format(item.unitPrice * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {order.kitchenNote && groups.length === 1 && (
        <p className={styles.kitchenNote}>
          <span className={styles.kitchenLabel}>{t('adminOrder.kitchenNote')}</span>
          {order.kitchenNote}
        </p>
      )}

      <section className={styles.section} aria-labelledby="order-bill">
        <h3 id="order-bill" className={styles.heading}>
          {t('adminOrder.bill')}
        </h3>
        <dl className={styles.bill}>
          <div className={styles.row}>
            <dt>{t('adminOrder.itemTotal')}</dt>
            <dd>{money.format(order.itemTotal)}</dd>
          </div>
          {discount > 0 && (
            <div className={styles.row}>
              <dt>{t('adminOrder.discounts')}</dt>
              <dd className={styles.saving}>{money.format(-discount)}</dd>
            </div>
          )}
          <div className={styles.total}>
            <dt>{t('adminOrder.total')}</dt>
            <dd>{money.format(order.total)}</dd>
          </div>
          {paid > 0 && due > 0 && (
            <div className={styles.row}>
              <dt>{t('adminOrder.paid')}</dt>
              <dd>{money.format(paid)}</dd>
            </div>
          )}
          {due > 0 && (
            <div className={styles.due}>
              <dt>{t('adminOrder.due')}</dt>
              <dd>{money.format(due)}</dd>
            </div>
          )}
          <div className={styles.row}>
            <dt>{t('adminOrder.payment')}</dt>
            <dd>
              {t('adminOrder.paymentLine', {
                method: order.payment.detail ?? t(`paymentMethods.${order.payment.method}`),
                status: t(`adminDashboard.paymentStatus.${order.payment.status}`),
              })}
            </dd>
          </div>
        </dl>
      </section>

      {order.timeline.length > 0 && (
        <section className={styles.section} aria-labelledby="order-progress">
          <h3 id="order-progress" className={styles.heading}>
            {t('adminOrder.progress')}
          </h3>
          <ol className={styles.timeline}>
            {order.timeline.map((event, index) => (
              <li key={`${event.status}-${index}`} className={styles.event}>
                <span className={styles.eventDot} aria-hidden="true" />
                <span className={styles.eventName}>{t(`orderStatus.${event.status}`)}</span>
                <span className={styles.eventTime}>{event.time}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

/** Where a takeaway or delivery goes: the pickup time, or the address and rider. */
function Fulfilment({ order }: { order: Order }) {
  const t = useContent('common');
  const { clock } = useAdminWorkspace();
  if (order.mode === 'takeaway' && order.pickup) {
    const time = clock.time(order.pickup.at);
    return (
      <section className={styles.where} aria-label={t('adminOrder.pickupTitle')}>
        <span className={styles.whereTitle}>{t('adminOrder.pickupTitle')}</span>
        <span>
          {order.pickup.asap
            ? t('adminOrder.pickupAsap', { time })
            : t('adminOrder.pickupAt', { time })}
        </span>
      </section>
    );
  }
  if (order.mode === 'delivery' && order.delivery) {
    const { address, rider } = order.delivery;
    return (
      <section className={styles.where} aria-label={t('adminOrder.deliveryTitle')}>
        <span className={styles.whereTitle}>{t('adminOrder.deliveryTitle')}</span>
        <span>{[address.line, address.area].join(', ')}</span>
        {address.landmark && (
          <span className={styles.whereNote}>
            {t('adminOrder.landmark', { landmark: address.landmark })}
          </span>
        )}
        {address.instructions && (
          <span className={styles.whereNote}>
            {t('adminOrder.itemNote', { note: address.instructions })}
          </span>
        )}
        {rider && (
          <span className={styles.whereNote}>
            {t('adminOrder.rider', { name: rider.name, phone: rider.phone })}
          </span>
        )}
      </section>
    );
  }
  return null;
}
