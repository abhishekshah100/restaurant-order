'use client';

import { useContent } from '@/api/hooks';
import { Icon, Input, QuantityStepper, Textarea, VegMark } from '@/components/ui';
import { describeInstructions, describeOptionsShort, type CartLineLabels } from '@/lib/cartLine';
import type { MenuCatalog } from '@/lib/menu';
import type { PadLines } from '@/lib/orderPad';
import { calculateBill } from '@/lib/pricing';
import { BillSummary, billRows } from '../../cart/PriceSummary';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import type { PadTarget } from './OrderPad';
import styles from './OrderPad.module.css';

/**
 * The pad before it's sent: who it's for (a new order), each line with its choices and a
 * stepper (down to 0 takes it off), a note for the kitchen and the bill: the item total, service
 * charge, taxes (CGST and SGST, or VAT) and round off, as the guest's cart lists them, and the
 * total.
 */
export function PadReview({
  target,
  menu,
  labels,
  lines,
  onQuantity,
  removed,
  onAddMore,
  guest,
  onGuest,
  kitchenNote,
  onKitchenNote,
}: {
  target: PadTarget;
  menu: MenuCatalog;
  labels: CartLineLabels;
  lines: PadLines;
  onQuantity: (key: string, quantity: number) => void;
  /** Dishes on the round that can't be ordered now, so they come off. */
  removed: readonly string[];
  /** Back to the menu to add more dishes. */
  onAddMore: () => void;
  guest: string;
  onGuest: (name: string) => void;
  kitchenNote: string;
  onKitchenNote: (note: string) => void;
}) {
  const t = useContent('common');
  const cart = useContent('cart');
  const { region, money } = useAdminWorkspace();
  const bill = calculateBill(lines, region);

  return (
    <div className={styles.review}>
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
                    {money.format(line.unitPrice * line.quantity)}
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

      <BillSummary
        rows={billRows(bill, { t: cart, money, tax: region.tax })}
        totalLabel={t('adminOrderPad.total')}
        total={money.format(bill.total)}
      />
    </div>
  );
}
