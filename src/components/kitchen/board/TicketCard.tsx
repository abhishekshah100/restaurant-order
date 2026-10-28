'use client';

import { memo } from 'react';
import { useContent } from '@/api/hooks';
import type { KitchenStep } from '@/api/contracts';
import { useAdminWorkspace } from '@/components/admin/shell/AdminWorkspace';
import { Button, Icon } from '@/components/ui';
import { cx } from '@/lib/cx';
import {
  isScheduled,
  justChanged,
  minutesLeft,
  nextKitchenStep,
  stationItems,
  ticketStartBy,
  ticketUrgency,
  type CategoryOf,
  type KitchenTicket,
  type StationFilter,
} from '@/lib/kitchenBoard';
import { allergensIn, stockIssue } from '@/lib/kitchenItems';
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
  /**
   * Stable callbacks (one for every ticket), so a card re-renders only when its ticket does.
   * An item's tick is the ticket's own (`plated`, shared by every kitchen screen).
   */
  onTogglePlated: (ticket: KitchenTicket, index: number) => void;
  /** A step forward, or (`back`) a recall. */
  onStep: (ticket: KitchenTicket, step: KitchenStep, back?: boolean) => void;
  /** Takes a cancelled ticket off the board before it goes by itself. */
  onDismiss?: (key: string) => void;
  /** Opens a message to the waiters about the order (running late, an item off, a question). */
  onMessage?: (key: string) => void;
  /** Take a dish off the menu (sold out, off today). */
  onOutOfStock: (dish: Dish) => void;
  /** A step was sent and the server hasn't answered yet. */
  pending: boolean;
  /** Picked from the keyboard (or a bump bar). */
  picked?: boolean;
  /** Opens the ticket large; the place in its head is the button. */
  onOpen?: (key: string) => void;
  /** Drawn large (the ticket opened on its own). */
  large?: boolean;
}

/**
 * One ticket, read from a step back: where it goes (table, pickup, delivery) and the day's token
 * in large type, the minutes it has waited (green, amber when due soon, red when late, on the
 * card's edge too), then in smaller type the order and round, the guest and whether they
 * ordered on their phone or a waiter took it; when it's due, the kitchen note, the items (TicketItem: each choice by its slot, what to
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
  onTogglePlated,
  onStep,
  onDismiss,
  onMessage,
  onOutOfStock,
  pending,
  picked = false,
  onOpen,
  large = false,
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
  const cancelled = ticket.stage === 'cancelled';
  // Changed by the guest or a waiter in the last few minutes: read it again.
  const changed = now !== null && justChanged(ticket, now);
  // Items still to cook that can't be made now: the waiter has to tell the guest.
  const offMenu = toCook
    ? ticket.items.filter((item) => stockIssue(item, dishOf(item.dishSlug))).length
    : 0;
  // An allergy named in a note: flagged above everything else.
  const allergy = allergensIn([ticket.kitchenNote, ...ticket.items.map((item) => item.note)]);

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
        : t('ticket.pickupAt', { time: clock.dateTime(ticket.pickupAt) })
      : ticket.mode === 'delivery' && ticket.deliveryArea
        ? t('ticket.deliveryTo', { area: ticket.deliveryArea })
        : null;

  return (
    <article
      className={cx(styles.ticket, large && styles.large)}
      data-ticket={ticket.key}
      data-picked={picked || undefined}
      data-stage={ticket.stage}
      data-changed={changed || undefined}
      data-rush={(ticket.rush && !cancelled) || undefined}
      data-urgency={urgency}
      data-fresh={fresh || undefined}
      aria-label={t('ticket.label', { order: ticket.orderId, where })}
    >
      <header className={styles.head}>
        <div className={styles.where}>
          {onOpen ? (
            <button
              type="button"
              className={cx(styles.place, styles.placeButton)}
              onClick={() => onOpen(ticket.key)}
              aria-label={t('ticket.open', { where })}
            >
              {ticket.table === undefined && (
                <Icon name={ticket.mode === 'delivery' ? 'scooter' : 'bag'} size="sm" />
              )}
              {where}
              <Icon name="expand" size="xs" className={styles.openIcon} />
            </button>
          ) : (
            <span className={styles.place}>
              {ticket.table === undefined && (
                <Icon name={ticket.mode === 'delivery' ? 'scooter' : 'bag'} size="sm" />
              )}
              {where}
            </span>
          )}
          {ticket.rush && !cancelled && (
            <span className={styles.rush}>
              <Icon name="flame" size="xs" />
              {t('ticket.rush')}
            </span>
          )}
          {/* The day's token: what the pass calls out. */}
          {ticket.token !== undefined && (
            <span className={styles.token}>{t('ticket.token', { token: ticket.token })}</span>
          )}
        </div>
        {!cancelled && (
          <div className={styles.clock}>
            <span className={styles.timer}>
              <span className={styles.dot} aria-hidden="true" />
              <TicketTimer
                since={
                  ticket.stage === 'ready' ? (ticket.readyAt ?? ticket.placedAt) : ticket.placedAt
                }
                label={(time) =>
                  t(ticket.stage === 'ready' ? 'ticket.timer.ready' : 'ticket.timer.open', { time })
                }
              />
            </span>
            <span className={styles.urgency}>{t(`ticket.urgency.${urgency}`)}</span>
          </div>
        )}
      </header>

      <div className={styles.title}>
        <h3 className={styles.order}>
          {t('ticket.order', { order: ticket.orderId })}
          {fresh && <span className={styles.fresh}>{t('ticket.fresh')}</span>}
          {changed && ticket.changedAt && (
            <span className={styles.changed}>
              {t('ticket.changed', { time: clock.time(ticket.changedAt) })}
            </span>
          )}
          {ticket.roundCount > 1 && (
            <span className={styles.round}>
              {t('ticket.round', { round: ticket.round, count: ticket.roundCount })}
            </span>
          )}
        </h3>
        <p className={styles.meta}>
          <span>{ticket.customerName}</span>
          <span className={styles.source} data-source={ticket.source}>
            <Icon name={ticket.source === 'guest' ? 'mobile' : 'user'} size="xs" />
            {ticket.takenBy ?? t(`ticket.source.${ticket.source}`)}
          </span>
        </p>
      </div>

      {!cancelled && (due || place || scheduled) && (
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

      {allergy.flagged && (
        <p className={styles.allergy} role="note">
          <Icon name="alert" size="sm" />
          {allergy.allergens.length > 0
            ? t('ticket.allergyWith', { list: allergy.allergens.join(', ') })
            : t('ticket.allergy')}
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
              plated={item.plated === true}
              onTogglePlated={cancelled ? undefined : () => onTogglePlated(ticket, index)}
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
              iconStart="flame"
              className={styles.primary}
              loading={pending}
              onClick={() => onStep(ticket, 'preparing')}
              aria-label={t('ticket.actions.startLabel', { order: ticket.orderId })}
            >
              {t('ticket.actions.start')}
            </Button>
            <Button
              variant="secondary"
              className={styles.skip}
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
        {ticket.stage === 'ready' && (
          <Button
            variant="secondary"
            size="sm"
            iconStart="back"
            className={styles.recall}
            disabled={pending}
            onClick={() => onStep(ticket, 'preparing', true)}
            aria-label={t('ticket.actions.recallLabel', { order: ticket.orderId })}
          >
            {t('ticket.actions.recall')}
          </Button>
        )}
        {ticket.stage === 'ready' && ticket.kitchen?.ready && (
          <p className={styles.by}>{t('ticket.markedBy', { name: ticket.kitchen.ready.by })}</p>
        )}
        {!cancelled && onMessage && (
          <button
            type="button"
            className={styles.message}
            onClick={() => onMessage(ticket.key)}
            aria-label={t('ticket.messageLabel', { order: ticket.orderId })}
          >
            <Icon name="msg" size="xs" />
            {t('ticket.message')}
          </button>
        )}
        {cancelled && (
          <>
            <p className={styles.cancelled} role="alert">
              <Icon name="xc" size="sm" />
              {t('ticket.cancelled')}
            </p>
            {onDismiss && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onDismiss(ticket.key)}
                aria-label={t('ticket.dismissLabel', { order: ticket.orderId })}
              >
                {t('ticket.dismiss')}
              </Button>
            )}
          </>
        )}
      </footer>
    </article>
  );
});
