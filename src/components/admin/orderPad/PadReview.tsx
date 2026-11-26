'use client';

import type { ReactNode } from 'react';
import { useContent } from '@/api/hooks';
import { Icon, Input, QuantityStepper, Textarea, VegMark } from '@/components/ui';
import { describeInstructions, describeOptionsShort, type CartLineLabels } from '@/lib/cartLine';
import type { MenuCatalog } from '@/lib/menu';
import type { Bill } from '@/lib/pricing';
import type { CartLine } from '@/types/cart';
import type { AppliedOffer } from '@/types/promotion';
import { BillSummary, billRows } from '../../cart/PriceSummary';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import type { PadTarget } from './OrderPad';
import { PadPrice } from './PadMenu';
import styles from './OrderPad.module.css';

/**
 * The pad before it's sent: who it's for (a new order), each line with its choices and a
 * stepper (down to 0 takes it off), a note for the kitchen and the bill: the item total, service
 * charge, taxes (CGST and SGST, or VAT) and round off, as the guest's cart lists them, and the
 * total. An offer on (happy hour) shows on each line it covers (its price, the menu price struck
 * through) and on the bill as a discount, as the server will take it off.
 */
export function PadReview({
  target,
  menu,
  labels,
  lines,
  bill,
  onQuantity,
  removed,
  onAddMore,
  guest,
  onGuest,
  kitchenNote,
  onKitchenNote,
  details,
  shortBy,
}: {
  target: PadTarget;
  menu: MenuCatalog;
  labels: CartLineLabels;
  /** The lines, each with the offer on it now (happy hour), and their bill. */
  lines: readonly (CartLine & { offer?: AppliedOffer })[];
  bill: Bill;
  onQuantity: (key: string, quantity: number) => void;
  /** Dishes on the round that can't be ordered now, so they come off. */
  removed: readonly string[];
  /** Back to the menu to add more dishes. */
  onAddMore: () => void;
  guest: string;
  onGuest: (name: string) => void;
  kitchenNote: string;
  onKitchenNote: (note: string) => void;
  /** A phone order's customer, pickup or address and payment, above the items. */
  details?: ReactNode;
  /** How far the items are from the minimum order (a phone order), in words. */
  shortBy?: string | undefined;
}) {
  const t = useContent('common');
  const cart = useContent('cart');
  const { region, money } = useAdminWorkspace();

  return (
    <div className={styles.review}>
      {details}
      {target.kind === 'new' && (
        <Input
          id="pad-guest"
          label={t('adminOrderPad.guest.label')}
          optional
          autoComplete="off"
          placeholder={t('adminOrderPad.guest.placeholder', { table: target.table })}
          value={guest}
          onChange={(event) => onGuest(event.target.value)}
        />
      )}

      {removed.length > 0 && (
        <p className={styles.removed}>
          {t('adminOrderPad.removed', { items: removed.join(', ') })}
        </p>
      )}

      {lines.length > 0 ? (
        <ul className={styles.lines}>
          {lines.map((line) => {
            const dish = menu.getDish(line.dishSlug);
            if (!dish) return null;
            const options = describeOptionsShort(dish, line, labels);
            const note = describeInstructions(line);
            return (
              <li key={line.key} className={styles.line}>
                <VegMark veg={dish.veg} className={styles.veg} />
                <span className={styles.lineText}>
                  <span className={styles.dishName}>{dish.name}</span>
                  {options && <span className={styles.lineOptions}>{options}</span>}
                  {note && <span className={styles.lineNote}>{note}</span>}
                </span>
                <span className={styles.lineEnd}>
                  <QuantityStepper
                    value={line.quantity}
                    min={0}
                    size="sm"
                    itemName={dish.name}
                    onChange={(next) => onQuantity(line.key, next)}
                  />
                  <span className={styles.linePrice}>
                    <PadPrice
                      price={line.unitPrice * line.quantity - (line.offer?.discount ?? 0)}
                      was={line.unitPrice * line.quantity}
                    />
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.none}>{t('adminOrderPad.empty')}</p>
      )}

      <button type="button" className={styles.addMore} onClick={onAddMore}>
        <Icon name="plus" size="xs" />
        {t('adminOrderPad.addMore')}
      </button>

      <Textarea
        id="pad-kitchen-note"
        label={t('adminOrderPad.kitchenNote.label')}
        optional
        rows={2}
        placeholder={t('adminOrderPad.kitchenNote.placeholder')}
        value={kitchenNote}
        onChange={(event) => onKitchenNote(event.target.value)}
      />

      {shortBy && (
        <p className={styles.removed} role="status">
          {shortBy}
        </p>
      )}

      <BillSummary
        rows={billRows(bill, { t: cart, money, tax: region.tax })}
        totalLabel={t('adminOrderPad.total')}
        total={money.format(bill.total)}
      />
    </div>
  );
}
