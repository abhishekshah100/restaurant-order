'use client';

import { useState } from 'react';
import { useContent } from '@/api/hooks';
import { Button, Chip, Icon, SearchField } from '@/components/ui';
import {
  KITCHEN_EVENT_KINDS,
  eventCounts,
  filterEvents,
  type KitchenEvent,
  type KitchenEventKind,
} from '@/lib/kitchenActivity';
import { ticketMinutes } from '@/lib/kitchenBoard';
import { useTicketWhere } from '../useTicketWhere';
import styles from './ActivityFeed.module.css';

/** Events listed at first, and added with each Show more. */
const PAGE_SIZE = 25;

const KIND_ICONS = {
  received: 'bell',
  started: 'flame',
  ready: 'cloche',
  served: 'check',
  cancelled: 'xc',
} as const;

type EventLabel = KitchenEventKind | 'readyDelivery' | 'collected' | 'delivered';

/** What an event is called for its order type: ready is "With the rider" for a delivery… */
function eventLabel({ kind, ticket }: KitchenEvent): EventLabel {
  if (kind === 'ready' && ticket.mode === 'delivery') return 'readyDelivery';
  if (kind === 'served' && ticket.mode === 'takeaway') return 'collected';
  if (kind === 'served' && ticket.mode === 'delivery') return 'delivered';
  return kind;
}

/**
 * Everything that happened to today's tickets, newest first: when each came in, was started,
 * was ready, was served (collected, delivered) or cancelled, with who marked it and how long
 * the kitchen took. Filter by what happened and search by order, table, guest, dish or staff.
 */
export function ActivityFeed({ events }: { events: readonly KitchenEvent[] }) {
  const t = useContent('kitchen');
  const whereOf = useTicketWhere();
  const [kind, setKind] = useState<KitchenEventKind | 'all'>('all');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const counts = eventCounts(events, query);
  const listed = filterEvents(events, kind, query);
  const shown = listed.slice(0, limit);

  let empty = t('activity.feed.empty');
  if (query.trim()) empty = t('activity.feed.emptySearch', { query: query.trim() });
  else if (kind !== 'all') empty = t('activity.feed.emptyKind');

  return (
    <section className={styles.feed} aria-labelledby="kitchen-feed">
      <header className={styles.head}>
        <div>
          <h2 id="kitchen-feed" className={styles.title}>
            {t('activity.feed.title')}
          </h2>
          <p className={styles.subtitle}>{t('activity.feed.subtitle')}</p>
        </div>
        <SearchField
          value={query}
          onChange={(value) => {
            setQuery(value);
            setLimit(PAGE_SIZE);
          }}
          label={t('activity.feed.search')}
          placeholder={t('activity.feed.search')}
          className={styles.search}
        />
      </header>
      <div className={styles.kinds} role="group" aria-label={t('activity.feed.kinds.label')}>
        {(['all', ...KITCHEN_EVENT_KINDS] as const).map((k) => (
          <Chip
            key={k}
            pressed={kind === k}
            count={counts[k]}
            onClick={() => {
              setKind(k);
              setLimit(PAGE_SIZE);
            }}
          >
            {t(`activity.feed.kinds.${k}`)}
          </Chip>
        ))}
      </div>

      {shown.length > 0 ? (
        <ol className={styles.list}>
          {shown.map((event) => {
            const { ticket } = event;
            const took = event.kind === 'ready' ? ticketMinutes(ticket) : null;
            const meta = [
              whereOf(ticket),
              ticket.customerName,
              t.plural('ticket.items', ticket.itemCount),
              event.by && t('activity.feed.by', { name: event.by }),
              took !== null && t('activity.feed.took', { count: took }),
              event.kind !== 'started' && event.kind !== 'ready' && event.note,
            ].filter(Boolean);
            return (
              <li key={event.key} className={styles.event} data-kind={event.kind}>
                <time className={styles.time} dateTime={event.at}>
                  {event.time}
                </time>
                <span className={styles.icon} aria-hidden="true">
                  <Icon name={KIND_ICONS[event.kind]} size="xs" />
                </span>
                <div className={styles.body}>
                  <p className={styles.what}>
                    <span className={styles.kind}>
                      {t(`activity.feed.events.${eventLabel(event)}`)}
                    </span>
                    <span className={styles.order}>
                      {t('activity.feed.order', { order: ticket.orderId })}
                    </span>
                    {ticket.roundCount > 1 && (
                      <span className={styles.round}>
                        {t('activity.feed.round', { round: ticket.round })}
                      </span>
                    )}
                  </p>
                  <p className={styles.meta}>{meta.join(' · ')}</p>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className={styles.empty}>{empty}</p>
      )}

      {listed.length > shown.length && (
        <Button
          variant="secondary"
          size="sm"
          className={styles.more}
          onClick={() => setLimit((n) => n + PAGE_SIZE)}
        >
          {t('activity.feed.more')}
        </Button>
      )}
    </section>
  );
}
