import { useContent } from '@/api/hooks';
import { Icon, VegMark } from '@/components/ui';
import { cx } from '@/lib/cx';
import { kitchenItem, stockIssue } from '@/lib/kitchenItems';
import type { Dish } from '@/types/menu';
import type { OrderItem } from '@/types/order';
import styles from './TicketCard.module.css';

export interface TicketItemProps {
  item: OrderItem;
  /** The dish on the menu now (its choices' names, whether it's in stock); undefined if it's gone. */
  dish: Dish | undefined;
  plated: boolean;
  /** Ticks it off or on; none on a ticket that's been cancelled. */
  onTogglePlated?: () => void;
  /** Offered on tickets still to cook: the kitchen can't make (some of) it. */
  onCantMake?: () => void;
}

/**
 * One item on a ticket, the way a cook reads it: the quantity, the dish and its size, each
 * choice by its slot (a thali's curry, bread, rice…), add-ons, what to leave out (highlighted),
 * the guest's note, and a warning when the dish has gone off the menu since. Tap it when it's
 * plated; Can't make takes it off the guest's bill (and, if chosen, the dish off the menu). What
 * the kitchen couldn't make shows struck through.
 */
export function TicketItem({ item, dish, plated, onTogglePlated, onCantMake }: TicketItemProps) {
  const t = useContent('kitchen');
  const view = kitchenItem(item, dish);
  const issue = stockIssue(item, dish);
  // None of it to make: struck through, nothing to tap.
  const gone = item.quantity === 0;

  return (
    <li className={styles.itemRow}>
      <button
        type="button"
        className={cx(styles.item, plated && styles.plated, gone && styles.gone)}
        aria-pressed={plated}
        aria-label={t(plated ? 'ticket.plated' : 'ticket.plate', { item: item.name })}
        onClick={onTogglePlated}
        disabled={!onTogglePlated || gone}
      >
        <span className={styles.qty}>{gone ? item.unavailable : item.quantity}</span>
        <span className={styles.itemBody}>
          <span className={styles.itemName}>
            <VegMark veg={item.veg} decorative />
            {item.name}
            {view.size && <span className={styles.variant}>{view.size}</span>}
          </span>
          {view.choices.length > 0 && (
            <span className={styles.choices}>
              {view.choices.map((c) => (
                <span key={`${c.group ?? ''}${c.choice}`} className={styles.choice}>
                  {c.group && <span className={styles.choiceGroup}>{c.group}</span>}
                  <span>{c.choice}</span>
                </span>
              ))}
            </span>
          )}
          {view.addOns.map((name) => (
            <span key={name} className={styles.detail}>
              {t('ticket.addOn', { item: name })}
            </span>
          ))}
          {view.removals.length > 0 && (
            <span className={styles.removals}>
              {view.removals.map((name) => (
                <span key={name} className={styles.removal}>
                  {t('ticket.without', { item: name.toLowerCase() })}
                </span>
              ))}
            </span>
          )}
          {view.fallback.map((line) => (
            <span key={line} className={styles.detail}>
              {line}
            </span>
          ))}
          {item.note && (
            <span className={styles.itemNote}>
              <span className="visually-hidden">{t('ticket.itemNote')}</span>
              {item.note}
            </span>
          )}
          {item.unavailable ? (
            <span className={styles.stockIssue}>
              <Icon name="xc" size="xs" />
              {t.plural('ticket.stock.unavailable', item.unavailable)}
            </span>
          ) : null}
          {issue && !gone && (
            <span className={styles.stockIssue}>
              <Icon name="alert" size="xs" />
              {t(`ticket.stock.issue.${issue}`)}
            </span>
          )}
        </span>
        <span className={styles.tick} aria-hidden="true">
          {plated && <Icon name="check" size="xs" />}
        </span>
      </button>
      {onCantMake && !gone && !plated && (
        <button
          type="button"
          className={styles.outOfStock}
          onClick={onCantMake}
          aria-label={t('ticket.stock.markLabel', { dish: item.name })}
        >
          {t('ticket.stock.mark')}
        </button>
      )}
    </li>
  );
}
