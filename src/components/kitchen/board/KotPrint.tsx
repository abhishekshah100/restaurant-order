'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useContent } from '@/api/hooks';
import { useAdminWorkspace } from '@/components/admin/shell/AdminWorkspace';
import type { KitchenTicket } from '@/lib/kitchenBoard';
import { allergensIn, kitchenItem } from '@/lib/kitchenItems';
import type { Dish } from '@/types/menu';
import { useTicketWhere } from '../useTicketWhere';
import styles from './KotPrint.module.css';

/** Set on <html> while tickets print: everything else on the page is hidden. */
const PRINTING = 'printing-kot';

/**
 * Printing kitchen order tickets (KOT) from the board: `print(tickets)` puts them on the page
 * (one after another, a cut between each), opens the browser's print dialog and takes them away
 * after. 80 mm wide, black on white, large where a cook looks: where it goes, the token, the
 * quantities.
 */
export function useKotPrint(dishOf: (slug: string) => Dish | undefined) {
  const [tickets, setTickets] = useState<readonly KitchenTicket[] | null>(null);

  useEffect(() => {
    if (!tickets) return;
    const root = document.documentElement;
    const done = () => {
      root.classList.remove(PRINTING);
      setTickets(null);
    };
    root.classList.add(PRINTING);
    window.addEventListener('afterprint', done, { once: true });
    const id = window.setTimeout(() => window.print(), 50);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('afterprint', done);
      root.classList.remove(PRINTING);
    };
  }, [tickets]);

  const sheet =
    tickets &&
    createPortal(
      <div className={styles.sheet} data-print-sheet="">
        {tickets.map((ticket) => (
          <Kot key={ticket.key} ticket={ticket} dishOf={dishOf} />
        ))}
      </div>,
      document.body,
    );

  return { print: setTickets, sheet };
}

function Kot({
  ticket,
  dishOf,
}: {
  ticket: KitchenTicket;
  dishOf: (slug: string) => Dish | undefined;
}) {
  const t = useContent('kitchen');
  const { clock } = useAdminWorkspace();
  const whereOf = useTicketWhere();
  const allergy = allergensIn([ticket.kitchenNote, ...ticket.items.map((i) => i.note)]);
  const now = new Date();

  return (
    <article className={styles.kot}>
      <p className={styles.title}>{t('kot.title')}</p>
      <p className={styles.where}>{whereOf(ticket)}</p>
      <p className={styles.line}>
        {ticket.token !== undefined && <strong>{t('kot.token', { token: ticket.token })}</strong>}
        <span>{t('kot.order', { order: ticket.orderId })}</span>
        <span>{clock.dateTime(ticket.placedAt)}</span>
      </p>
      {ticket.roundCount > 1 && (
        <p className={styles.small}>
          {t('ticket.round', { round: ticket.round, count: ticket.roundCount })}
        </p>
      )}
      {allergy.flagged && (
        <p className={styles.allergy}>
          {allergy.allergens.length > 0
            ? t('ticket.allergyWith', { list: allergy.allergens.join(', ') })
            : t('ticket.allergy')}
        </p>
      )}
      {ticket.kitchenNote && (
        <p className={styles.note}>{t('kot.note', { note: ticket.kitchenNote })}</p>
      )}
      <ul className={styles.items}>
        {ticket.items.map((item, index) => {
          const view = kitchenItem(item, dishOf(item.dishSlug));
          return (
            <li key={`${item.dishSlug}-${index}`}>
              <span className={styles.qty}>{item.quantity}</span>
              <span>
                <strong>{item.name}</strong>
                {view.size && <span className={styles.small}>{view.size}</span>}
                {view.choices.map((c) => (
                  <span key={`${c.group ?? ''}${c.choice}`} className={styles.small}>
                    {c.choice}
                  </span>
                ))}
                {view.addOns.map((name) => (
                  <span key={name} className={styles.small}>
                    {t('ticket.addOn', { item: name })}
                  </span>
                ))}
                {view.removals.map((name) => (
                  <span key={name} className={styles.removal}>
                    {t('ticket.without', { item: name.toLowerCase() })}
                  </span>
                ))}
                {item.note && <span className={styles.itemNote}>{item.note}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      <p className={styles.printed}>{t('kot.printed', { time: clock.dateTime(now) })}</p>
    </article>
  );
}
