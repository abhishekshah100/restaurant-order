'use client';

import { useMemo, useState } from 'react';
import { ApiError } from '@/api/client';
import { useQuery } from '@tanstack/react-query';
import { useBranchMenu } from '@/api/adminDashboard';
import { useContent } from '@/api/hooks';
import {
  useAddStaffRound,
  useEditStaffRound,
  useTakePhoneOrder,
  useTakeTableOrder,
} from '@/api/mutations';
import { branchPromotionsQuery } from '@/api/queries';
import { Button, Dialog, IconButton } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { cartLineLabels } from '@/hooks/useCartLineLabels';
import { useMinute } from '@/hooks/useOffers';
import { defaultConfig } from '@/lib/cartLine';
import { reorderLines } from '@/lib/lifecycle';
import {
  deliveryAreas,
  findZone,
  minimumOrder,
  pickupOptions,
  quoteDelivery,
} from '@/lib/fulfilment';
import {
  addLine,
  emptyPhoneDraft,
  hasErrors,
  padRequest,
  padTotals,
  phoneDraftErrors,
  phoneRequest,
  pickupToSend,
  setQuantity,
  type PhoneDraft,
  type PhoneMode,
} from '@/lib/orderPad';
import { calculateBill, itemTotal } from '@/lib/pricing';
import { activeOffers, applyOffers, offerDiscounts } from '@/lib/promotions';
import type { CartLine, LineConfig } from '@/types/cart';
import type { Dish } from '@/types/menu';
import type { Order, OrderRound } from '@/types/order';
import type { AppliedOffer } from '@/types/promotion';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { PadChoose } from './PadChoose';
import { PadMenu } from './PadMenu';
import { PadReview } from './PadReview';
import { PhoneDetails } from './PhoneDetails';
import styles from './OrderPad.module.css';

/**
 * What the pad is for: a new order at the table, more items on one of its orders, or changing
 * the items of an order's round (the kitchen hasn't finished it).
 */
export type PadTarget =
  /** A new bill at the table; `guest` fills in the name (a new order for the same guest). */
  | { kind: 'new'; table: number; guest?: string }
  | { kind: 'add'; table: number; order: Pick<Order, 'id' | 'customerName'> }
  | {
      kind: 'edit';
      table: number;
      order: Pick<Order, 'id' | 'customerName'>;
      round: Pick<OrderRound, 'number' | 'items' | 'kitchenNote'>;
    }
  /** A customer called: takeaway or delivery, no table. */
  | { kind: 'phone'; mode: PhoneMode };

/** The server's refusals a phone order words itself (the rest: "Couldn't send the order"). */
const PHONE_REFUSALS = [
  'pickup_unavailable',
  'area_not_served',
  'below_minimum',
  'ordering_unavailable',
  'mode_unavailable',
] as const;

/** The dish being set up before it's added: its choices and how many. */
interface Choosing {
  dish: Dish;
  config: LineConfig;
  quantity: number;
}

/**
 * The waiter's order pad, for guests who don't order on their phone: pick dishes from the
 * branch's menu (search, categories, one tap for a dish without choices), set sizes and
 * choices where a dish has them, then review — guest name, quantities, a note for the kitchen
 * — and send. A new order goes on its own bill (POST …/tables/:table/orders); added items go on
 * the order's bill as a new round (POST …/orders/:id/rounds); a change replaces a round's items
 * (PATCH …/orders/:id/rounds/:round) and opens on the review with them. A phone order
 * (POST …/orders/phone) reviews the customer, the pickup time or address and how they pay;
 * `onPhoneTaken` hears of it (to take a payment made now). Fresh each time.
 */
export function OrderPad({
  target,
  onClose,
  onPhoneTaken,
}: {
  target: PadTarget | null;
  onClose: () => void;
  onPhoneTaken?: (order: Order, paidNow: boolean) => void;
}) {
  if (!target) return null;
  return <Pad target={target} onClose={onClose} onPhoneTaken={onPhoneTaken} />;
}

function Pad({
  target,
  onClose,
  onPhoneTaken,
}: {
  target: PadTarget;
  onClose: () => void;
  onPhoneTaken?: ((order: Order, paidNow: boolean) => void) | undefined;
}) {
  const t = useContent('common');
  const cart = useContent('cart');
  const { branch, region, money, can } = useAdminWorkspace();
  const mode = target.kind === 'phone' ? target.mode : 'dineIn';
  const { showToast } = useToast();
  const { menu } = useBranchMenu(region);
  // Happy hour: the server takes the dine-in offers on now off a waiter's order, so the pad
  // shows them too (offer price, menu price struck through, the discount on the bill).
  const promotions = useQuery(branchPromotionsQuery(region.id)).data;
  const minute = useMinute();
  const offers = useMemo(
    () =>
      promotions && minute !== null
        ? activeOffers(promotions.offers, new Date(minute), region.timezone, mode)
        : [],
    [promotions, minute, region.timezone, mode],
  );
  // A phone order's details; the delivery area sets the fee and the minimum.
  const [draft, setDraft] = useState<PhoneDraft>(emptyPhoneDraft);
  const [tried, setTried] = useState(false);
  const zone =
    mode === 'delivery' ? findZone(region.modes.delivery.zones, draft.address.area) : undefined;
  const quoteFor = (some: CartLine[]) =>
    zone ? quoteDelivery(zone, draft.address.area, itemTotal(some)) : undefined;
  const price = (some: CartLine[]) => {
    const offered: (CartLine & { offer?: AppliedOffer })[] = menu
      ? applyOffers(some, menu, offers)
      : some;
    const discounts = offerDiscounts(offered, region.currency.minorUnit);
    const quote = quoteFor(some);
    const delivery = quote
      ? { fee: quote.fee, taxable: region.modes.delivery.feeTaxable }
      : undefined;
    return { offered, bill: calculateBill(some, region, delivery, discounts) };
  };
  const labels = useMemo(() => cartLineLabels(cart, money), [cart, money]);
  const take = useTakeTableOrder();
  const takePhone = useTakePhoneOrder();
  const addRound = useAddStaffRound();
  const editRound = useEditStaffRound();
  const sending =
    take.isPending || takePhone.isPending || addRound.isPending || editRound.isPending;
  // One order per pad: sent again after a lost answer, the server returns the one it took.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  // A change starts from the round's items as they can be ordered today (the rest come off).
  const [start] = useState(() =>
    target.kind === 'edit' && menu
      ? reorderLines(target.round.items, menu)
      : { lines: [], skipped: [] },
  );
  const [lines, setLines] = useState<CartLine[]>(() =>
    start.lines.reduce<CartLine[]>((all, l) => addLine(all, l.dish, l.config, l.quantity), []),
  );
  const [step, setStep] = useState<'menu' | 'review'>(target.kind === 'edit' ? 'review' : 'menu');
  const [choosing, setChoosing] = useState<Choosing | null>(null);
  const [guest, setGuest] = useState(target.kind === 'new' ? (target.guest ?? '') : '');
  const [kitchenNote, setKitchenNote] = useState(
    target.kind === 'edit' ? (target.round.kitchenNote ?? '') : '',
  );
  const totals = padTotals(lines);
  // What the guest pays for these lines: offers off; taxes, service charge and round off in.
  const priced = price(lines);
  const billTotal = priced.bill.total;
  // A phone order: the pickup time it will go with, what's missing, and the minimum order.
  const pickupAt =
    target.kind === 'phone' && target.mode === 'takeaway' && minute !== null
      ? pickupToSend(draft.pickupAt, pickupOptions(region, new Date(minute)))
      : null;
  const phoneErrors =
    target.kind === 'phone'
      ? phoneDraftErrors(
          draft,
          target.mode,
          region.mobile,
          deliveryAreas(region.modes.delivery.zones),
          pickupAt,
        )
      : {};
  const short =
    target.kind === 'phone'
      ? minimumOrder(region, target.mode, itemTotal(lines), quoteFor(lines))
      : null;

  let title =
    target.kind === 'phone'
      ? t(`adminOrderPad.phone.title.${target.mode}`)
      : t('adminOrderPad.titleNew', { table: target.table });
  if (target.kind === 'add') title = t('adminOrderPad.titleAdd', { order: target.order.id });
  if (target.kind === 'edit') title = t('adminOrderPad.titleEdit', { order: target.order.id });
  // Setting up a dish: which order it's for. Otherwise: whose order, or the step.
  let subtitle = t(`adminOrderPad.steps.${step}`);
  if (target.kind === 'add') {
    subtitle = t('adminOrderPad.subtitleAdd', {
      name: target.order.customerName,
      table: target.table,
    });
  }
  if (target.kind === 'edit') {
    subtitle = t('adminOrderPad.subtitleEdit', {
      name: target.order.customerName,
      table: target.table,
      round: target.round.number,
    });
  }
  if (choosing) subtitle = title;
  // The dish being set up, at its offer price when one is on (before taxes, like the menu).
  const chosenTotal = ({ dish, config, quantity }: Choosing) => {
    const { bill } = price(addLine([], dish, config, quantity));
    return bill.itemTotal - bill.discountMinor / region.currency.minorUnit;
  };
  const back = choosing
    ? () => setChoosing(null)
    : step === 'review'
      ? () => setStep('menu')
      : undefined;

  const send = () => {
    const done = (order: Order) => {
      showToast(
        target.kind === 'new'
          ? t('adminOrderPad.sentNew', { order: order.id })
          : t('adminOrderPad.sentAdd', { order: order.id }),
        { tone: 'success' },
      );
      onClose();
    };
    const failed = () => showToast(t('adminOrderPad.failed'), { tone: 'error' });
    const note = kitchenNote.trim() || undefined;
    if (target.kind === 'phone') {
      setTried(true);
      if (hasErrors(phoneErrors) || pickupAt === undefined || (short && short.shortBy > 0)) return;
      takePhone.mutate(
        {
          branchId: branch.id,
          body: phoneRequest(draft, target.mode, lines, {
            ...(note ? { kitchenNote: note } : {}),
            idempotencyKey,
            pickupAt,
          }),
        },
        {
          onSuccess: (order) => {
            showToast(
              t('adminOrderPad.phone.sent', { token: order.token ?? '–', order: order.id }),
              {
                tone: 'success',
              },
            );
            onPhoneTaken?.(order, draft.paidNow);
            onClose();
          },
          onError: (error) => {
            const code = error instanceof ApiError ? error.code : undefined;
            const known = PHONE_REFUSALS.find((c) => c === code);
            showToast(
              known ? t(`adminOrderPad.phone.refused.${known}`) : t('adminOrderPad.failed'),
              {
                tone: 'error',
              },
            );
          },
        },
      );
    } else if (target.kind === 'edit') {
      editRound.mutate(
        {
          branchId: branch.id,
          orderId: target.order.id,
          round: target.round.number,
          body: { kitchenNote: note, lines: padRequest(lines) },
        },
        {
          onSuccess: ({ order, refunded }) => {
            const saved = t('adminOrderPad.saved', { order: order.id });
            showToast(
              refunded > 0
                ? `${saved} · ${t('adminOrderPad.refund', { amount: money.format(refunded) })}`
                : saved,
              { tone: 'success' },
            );
            onClose();
          },
          onError: failed,
        },
      );
    } else if (target.kind === 'new') {
      take.mutate(
        {
          branchId: branch.id,
          table: target.table,
          body: {
            customerName: guest.trim() || t('adminOrderPad.guest.default', { table: target.table }),
            kitchenNote: note,
            lines: padRequest(lines),
            idempotencyKey,
          },
        },
        { onSuccess: done, onError: failed },
      );
    } else {
      addRound.mutate(
        {
          branchId: branch.id,
          orderId: target.order.id,
          body: { kitchenNote: note, lines: padRequest(lines) },
        },
        { onSuccess: done, onError: failed },
      );
    }
  };

  let body;
  let footer;
  if (choosing) {
    body = (
      <PadChoose
        dish={choosing.dish}
        config={choosing.config}
        quantity={choosing.quantity}
        onChange={(config, quantity) => setChoosing({ ...choosing, config, quantity })}
      />
    );
    footer = (
      <Button
        block
        iconStart="plus"
        meta={money.format(chosenTotal(choosing))}
        onClick={() => {
          setLines(addLine(lines, choosing.dish, choosing.config, choosing.quantity));
          setChoosing(null);
        }}
      >
        {t('adminOrderPad.choose.add')}
      </Button>
    );
  } else if (step === 'review' && menu) {
    body = (
      <PadReview
        target={target}
        menu={menu}
        labels={labels}
        lines={priced.offered}
        bill={priced.bill}
        onQuantity={(key, quantity) => setLines(setQuantity(lines, key, quantity))}
        removed={start.skipped}
        onAddMore={() => setStep('menu')}
        guest={guest}
        onGuest={setGuest}
        details={
          target.kind === 'phone' ? (
            <PhoneDetails
              mode={target.mode}
              value={draft}
              onChange={setDraft}
              errors={tried ? phoneErrors : {}}
              canCollect={can('payments.collect')}
            />
          ) : undefined
        }
        shortBy={
          short && short.shortBy > 0
            ? t('adminOrderPad.phone.shortBy', {
                amount: money.format(short.shortBy),
                minimum: money.format(short.minimum),
              })
            : undefined
        }
        kitchenNote={kitchenNote}
        onKitchenNote={setKitchenNote}
      />
    );
    footer = (
      <Button
        block
        iconStart="check"
        loading={sending}
        disabled={totals.items === 0}
        meta={money.format(billTotal)}
        onClick={send}
      >
        {target.kind === 'edit' ? t('adminOrderPad.save') : t('adminOrderPad.send')}
      </Button>
    );
  } else {
    body = menu && (
      <PadMenu
        menu={menu}
        offers={offers}
        lines={lines}
        onAdd={(dish) => setLines(addLine(lines, dish, defaultConfig(dish)))}
        onChoose={(dish) => setChoosing({ dish, config: defaultConfig(dish), quantity: 1 })}
        onQuantity={(key, quantity) => setLines(setQuantity(lines, key, quantity))}
      />
    );
    footer = (
      <Button
        block
        iconEnd="arrow"
        disabled={totals.items === 0}
        meta={
          totals.items > 0
            ? [t.plural('adminOrderPad.items', totals.items), money.format(billTotal)].join(' · ')
            : undefined
        }
        onClick={() => setStep('review')}
      >
        {t('adminOrderPad.review')}
      </Button>
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="panel"
      className={styles.pad}
      page={choosing ? 'choose' : step}
      title={title}
      labelledBy="pad-title"
      header={
        <div className={styles.header}>
          {back && (
            <IconButton icon="back" label={t('adminOrderPad.back')} variant="soft" onClick={back} />
          )}
          <div className={styles.heading}>
            <h2 id="pad-title" className={styles.title}>
              {choosing ? choosing.dish.name : title}
            </h2>
            <p className={styles.subtitle}>{subtitle}</p>
          </div>
          <IconButton icon="x" label={t('adminOrderPad.close')} variant="soft" onClick={onClose} />
        </div>
      }
      footer={footer}
    >
      {body}
    </Dialog>
  );
}
