'use client';

import { memo } from 'react';
import { useContent } from '@/api/hooks';
import type { KitchenStep } from '@/api/contracts';
import { WhereBadge } from '@/components/admin/home/WhereBadge';
import { useAdminWorkspace } from '@/components/admin/shell/AdminWorkspace';
import { Button, Icon } from '@/components/ui';
import { cx } from '@/lib/cx';
import {
  isScheduled,
  minutesLeft,
  nextKitchenStep,
  stationItems,
  ticketStartBy,
  ticketUrgency,
  type CategoryOf,
  type KitchenTicket,
  type StationFilter,
} from '@/lib/kitchenBoard';
import { stockIssue } from '@/lib/kitchenItems';
import type { Dish } from '@/types/menu';
import { useTicketWhere } from '../useTicketWhere';
import { TicketItem } from './TicketItem';
import { TicketTimer } from './TicketTimer';
import styles from './TicketCard.module.css';

/** A ticket placed this recently is flagged New. */
const FRESH_MS = 60_000;

export interface TicketCardProps {
  ticket: KitchenTicket;
  /** The board's time (urgency, due in); null until hydrated. */
  now: Date | null;
  station: StationFilter;
  categoryOf: CategoryOf;
  /** The dish on the menu now, for its choices' names and whether it's in stock. */
  dishOf: (slug: string) => Dish | undefined;
  /** Items ticked off as plated, by their index on the ticket. */
  plated: ReadonlySet<number>;
  /** Stable callbacks (one for every ticket), so a card re-renders only when its ticket does. */
  onTogglePlated: (key: string, index: number) => void;
  onStep: (ticket: KitchenTicket, step: KitchenStep) => void;
  /** Take a dish off the menu (sold out, off today). */
  onOutOfStock: (dish: Dish) => void;
  /** A step was sent and the server hasn't answered yet. */
  pending: boolean;
}

/**
 * One ticket: where it goes (table, pickup, delivery), the order and round, the guest and whether
 * they ordered on their phone or a waiter took it, a running clock, when it's due (late in red,
 * due soon in amber), the kitchen note, the items (TicketItem: each choice by its slot, what to
 * leave out, notes; tap one when it's plated, or mark its dish sold out), a warning when a dish
 * went off the menu since, (with a station chosen, the others are counted, not listed), and the
 * next step: Start cooking (or straight to Ready), Mark ready (Hand to rider for delivery). Ready
 * tickets wait for a waiter or the guest, with how long they've waited.
 */
export const TicketCard = memo(function TicketCard({
  ticket,
  now,
  station,
  categoryOf,
  dishOf,
  plated,
  onTogglePlated,
  onStep,
  onOutOfStock,
  pending,
}: TicketCardProps) {
  const t = useContent('kitchen');
  const { clock, region } = useAdminWorkspace();
  const whereOf = useTicketWhere();
  const step = nextKitchenStep(ticket.stage);
  const urgency = now ? ticketUrgency(ticket, now) : 'onTime';
  const fresh =
    now && ticket.stage === 'new' && now.getTime() - Date.parse(ticket.placedAt) < FRESH_MS;
  const scheduled = now ? isScheduled(ticket, now, region) : false;
  const shown = stationItems(ticket, station, categoryOf);
  const elsewhere = ticket.items.length - shown.length;
  const where = whereOf(ticket);
  const toCook = ticket.stage === 'new' || ticket.stage === 'cooking';
  // Items still to cook that can't be made now: the waiter has to tell the guest.
  const offMenu = toCook
    ? ticket.items.filter((item) => stockIssue(item, dishOf(item.dishSlug))).length
    : 0;

  // When it's due, and how it's doing, for new and cooking tickets.
  let due: string | null = null;
  if (ticket.stage !== 'ready' && now) {
    const left = minutesLeft(ticket, now);
    const status =
      left < 0
        ? t('ticket.late', { count: -left })
        : t('ticket.dueIn', { count: Math.max(0, left) });
    due = `${t('ticket.due', { time: clock.time(ticket.dueAt) })} · ${status}`;
  }
  const place =
    ticket.mode === 'takeaway' && ticket.pickupAt
      ? ticket.asap
        ? t('ticket.asap')
        : t('ticket.pickupAt', { time: clock.time(ticket.pickupAt) })
      : ticket.mode === 'delivery' && ticket.deliveryArea
        ? t('ticket.deliveryTo', { area: ticket.deliveryArea })
        : null;

  return (
    <article
      className={styles.ticket}
      data-stage={ticket.stage}
      data-urgency={urgency}
      aria-label={t('ticket.label', { order: ticket.orderId, where })}
    >
      <header className={styles.head}>
        <WhereBadge table={ticket.table} mode={ticket.mode} />
        <div className={styles.title}>
          <h3 className={styles.order}>
            {t('ticket.order', { order: ticket.orderId })}
            {ticket.token !== undefined && (
              <span className={styles.token}>{t('ticket.token', { token: ticket.token })}</span>
            )}
            {fresh && <span className={styles.fresh}>{t('ticket.fresh')}</span>}
          </h3>
          <p className={styles.meta}>
            {ticket.roundCount > 1 && (
              <span className={styles.round}>
                {t('ticket.round', { round: ticket.round, count: ticket.roundCount })}
              </span>
            )}
            <span>{ticket.customerName}</span>
            <span className={styles.source} data-source={ticket.source}>
              <Icon name={ticket.source === 'guest' ? 'mobile' : 'user'} size="xs" />
              {ticket.takenBy ?? t(`ticket.source.${ticket.source}`)}
            </span>
          </p>
        </div>
        <div className={styles.clock}>
          <TicketTimer
            since={ticket.stage === 'ready' ? (ticket.readyAt ?? ticket.placedAt) : ticket.placedAt}
            label={(time) =>
              t(ticket.stage === 'ready' ? 'ticket.timer.ready' : 'ticket.timer.open', { time })
            }
          />
          <span className={styles.urgency}>{t(`ticket.urgency.${urgency}`)}</span>
        </div>
      </header>

      {(due || place || scheduled) && (
        <p className={styles.due}>
          <Icon name={ticket.mode === 'delivery' ? 'scooter' : 'clock'} size="xs" />
          {[
            scheduled
              ? t('ticket.scheduled', { time: clock.time(ticketStartBy(ticket, region)) })
              : due,
            place,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}

      {ticket.kitchenNote && (
        <p className={styles.note}>
          <Icon name="msg" size="xs" />
          <span>
            <span className="visually-hidden">{t('ticket.kitchenNote')}</span>
            {ticket.kitchenNote}
          </span>
        </p>
      )}

      {offMenu > 0 && (
        <p className={styles.stockWarning} role="note">
          <Icon name="alert" size="xs" />
          {t.plural('ticket.stock.warning', offMenu)}
        </p>
      )}

      <ul className={styles.items}>
        {ticket.items.map((item, index) =>
          shown.includes(item) ? (
            <TicketItem
              key={`${item.dishSlug}-${index}`}
              item={item}
              dish={dishOf(item.dishSlug)}
              plated={plated.has(index)}
              onTogglePlated={() => onTogglePlated(ticket.key, index)}
              onOutOfStock={toCook ? onOutOfStock : undefined}
            />
          ) : null,
        )}
      </ul>
      {elsewhere > 0 && (
        <p className={styles.elsewhere}>{t.plural('ticket.otherStation', elsewhere)}</p>
      )}

      <footer className={styles.foot}>
        {step === 'preparing' && (
          <>
            <Button
              size="sm"
              iconStart="flame"
              className={styles.primary}
              loading={pending}
              onClick={() => onStep(ticket, 'preparing')}
              aria-label={t('ticket.actions.startLabel', { order: ticket.orderId })}
            >
              {t('ticket.actions.start')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => onStep(ticket, 'ready')}
              aria-label={t('ticket.actions.skipLabel', { order: ticket.orderId })}
            >
              {t('ticket.actions.skip')}
            </Button>
          </>
        )}
        {step === 'ready' && (
          <Button
            size="sm"
            iconStart={ticket.mode === 'delivery' ? 'scooter' : 'check'}
            className={cx(styles.primary, styles.readyAction)}
            loading={pending}
            onClick={() => onStep(ticket, 'ready')}
            aria-label={t('ticket.actions.readyLabel', { order: ticket.orderId })}
          >
            {t(ticket.mode === 'delivery' ? 'ticket.actions.dispatch' : 'ticket.actions.ready')}
          </Button>
        )}
        {ticket.stage === 'ready' && (
          <p className={styles.waiting}>
            <Icon name={ticket.mode === 'takeaway' ? 'bag' : 'cloche'} size="xs" />
            {t(ticket.mode === 'takeaway' ? 'ticket.waiting.takeaway' : 'ticket.waiting.dineIn')}
          </p>
        )}
        {ticket.stage === 'cooking' && ticket.kitchen?.started && (
          <p className={styles.by}>{t('ticket.startedBy', { name: ticket.kitchen.started.by })}</p>
        )}
        {ticket.stage === 'ready' && ticket.kitchen?.ready && (
          <p className={styles.by}>{t('ticket.markedBy', { name: ticket.kitchen.ready.by })}</p>
        )}
      </footer>
    </article>
  );
});
