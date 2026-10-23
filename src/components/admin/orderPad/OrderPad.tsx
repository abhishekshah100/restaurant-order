'use client';

import { useMemo, useState } from 'react';
import { useBranchMenu } from '@/api/adminDashboard';
import { useContent } from '@/api/hooks';
import { useAddStaffRound, useEditStaffRound, useTakeTableOrder } from '@/api/mutations';
import { Button, Dialog, IconButton } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { cartLineLabels } from '@/hooks/useCartLineLabels';
import { defaultConfig } from '@/lib/cartLine';
import { reorderLines } from '@/lib/lifecycle';
import { addLine, padRequest, padTotals, setQuantity } from '@/lib/orderPad';
import type { CartLine, LineConfig } from '@/types/cart';
import type { Dish } from '@/types/menu';
import type { Order, OrderRound } from '@/types/order';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { PadChoose } from './PadChoose';
import { PadMenu } from './PadMenu';
import { PadReview } from './PadReview';
import styles from './OrderPad.module.css';

/**
 * What the pad is for: a new order at the table, more items on one of its orders, or changing
 * the items of an order's round (the kitchen hasn't finished it).
 */
export type PadTarget =
  | { kind: 'new'; table: number }
  | { kind: 'add'; table: number; order: Pick<Order, 'id' | 'customerName'> }
  | {
      kind: 'edit';
      table: number;
      order: Pick<Order, 'id' | 'customerName'>;
      round: Pick<OrderRound, 'number' | 'items' | 'kitchenNote'>;
    };

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
 * (PATCH …/orders/:id/rounds/:round) and opens on the review with them. Fresh each time.
 */
export function OrderPad({ target, onClose }: { target: PadTarget | null; onClose: () => void }) {
  if (!target) return null;
  return <Pad target={target} onClose={onClose} />;
}

function Pad({ target, onClose }: { target: PadTarget; onClose: () => void }) {
  const t = useContent('common');
  const cart = useContent('cart');
  const { branch, region, money } = useAdminWorkspace();
  const { showToast } = useToast();
  const { menu } = useBranchMenu(region);
  const labels = useMemo(() => cartLineLabels(cart, money), [cart, money]);
  const take = useTakeTableOrder();
  const addRound = useAddStaffRound();
  const editRound = useEditStaffRound();
  const sending = take.isPending || addRound.isPending || editRound.isPending;
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
  const [guest, setGuest] = useState('');
  const [kitchenNote, setKitchenNote] = useState(
    target.kind === 'edit' ? (target.round.kitchenNote ?? '') : '',
  );
  const totals = padTotals(lines);

  let title = t('adminOrderPad.titleNew', { table: target.table });
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
    if (target.kind === 'edit') {
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
        meta={money.format(
          padTotals(addLine([], choosing.dish, choosing.config, choosing.quantity)).total,
        )}
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
        lines={lines}
        onQuantity={(key, quantity) => setLines(setQuantity(lines, key, quantity))}
        removed={start.skipped}
        onAddMore={() => setStep('menu')}
        guest={guest}
        onGuest={setGuest}
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
        meta={money.format(totals.total)}
        onClick={send}
      >
        {target.kind === 'edit' ? t('adminOrderPad.save') : t('adminOrderPad.send')}
      </Button>
    );
  } else {
    body = menu && (
      <PadMenu
        menu={menu}
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
            ? [t.plural('adminOrderPad.items', totals.items), money.format(totals.total)].join(
                ' · ',
              )
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
