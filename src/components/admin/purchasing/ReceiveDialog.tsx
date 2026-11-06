'use client';

import { useMemo, useState } from 'react';
import { isApiError } from '@/api/client';
import {
  useContent,
  useIngredients,
  usePurchaseOrder,
  usePurchaseOrders,
  useSuppliers,
} from '@/api/hooks';
import { useReceive } from '@/api/mutations';
import { Button, Dialog, IconButton, Input, Select, Textarea } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { newEntryId, parseCost, parseQuantity, quantityText, unitsLike } from '@/lib/inventory';
import type { InventoryUnit } from '@/types/inventory';
import type { ReceiptLineInput } from '@/types/purchasing';
import styles from '../inventory/Inventory.module.css';
import { ProofPicker } from '../payments/ProofPicker';
import { useProofPhotos } from '../payments/useProofPhotos';
import { useNow } from '@/hooks/useNow';
import { isDayKey, shiftDay } from '@/lib/dayRange';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { docNumber, usePurchasingText } from './usePurchasingText';

interface Draft {
  key: number;
  orderLineId?: string;
  ingredientId: string;
  measure: string;
  quantity: string;
  rejected: string;
  rejectReason: string;
  price: string;
  /** Items that track expiry: its last good day (none typed: today + shelf life), its code. */
  expires?: string;
  lot?: string;
}
let nextKey = 1;
const PHOTO = 'invoice';
const blankLine = (): Draft => ({
  key: nextKey++,
  ingredientId: '',
  measure: '',
  quantity: '',
  rejected: '',
  rejectReason: '',
  price: '',
});

/**
 * A delivery received: against an open order (its lines, what's still to come) or straight from
 * a supplier (the market, the milk van). Each line: how much came, what was refused at the door
 * and why, and, for staff who see prices, what it cost (else the expected price, to confirm). An
 * invoice photo can go with it. Sent with an entry id, so a retry records it once.
 */
export function ReceiveDialog({
  orderId: initialOrder,
  onClose,
}: {
  orderId?: string;
  onClose: () => void;
}) {
  const t = useContent('common');
  const { branch, can, clock } = useAdminWorkspace();
  const prices = can('purchase.manage', 'purchase.approve', 'inventory.manage', 'reports.view');
  const text = usePurchasingText();
  const { showToast } = useToast();
  const receive = useReceive();
  const photos = useProofPhotos(branch.id, 'purchasing');
  const suppliers = useSuppliers(branch.id).data?.suppliers ?? [];
  const ingredients = useIngredients(branch.id).data?.ingredients ?? [];
  const open = (usePurchaseOrders(branch.id, {}).data?.orders ?? []).filter((o) =>
    ['approved', 'sent', 'partly_received'].includes(o.status),
  );
  const [entryId] = useState(newEntryId);
  const [orderId, setOrderId] = useState(initialOrder ?? '');
  const order = usePurchaseOrder(branch.id, orderId).data;
  const [supplierId, setSupplierId] = useState('');
  // Straight from a supplier: one empty line to start; against an order: its lines (below).
  const [lines, setLines] = useState<Draft[] | null>(() => (initialOrder ? null : [blankLine()]));
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);

  // An order's lines, once it's read: what's still to come of each.
  const fromOrder: Draft[] | null = useMemo(
    () =>
      orderId && order
        ? order.lines.map((l) => ({
            key: nextKey++,
            orderLineId: l.id,
            ingredientId: l.ingredientId,
            measure: '',
            quantity: quantityText(Math.max(0, l.quantity - l.received)),
            rejected: '',
            rejectReason: '',
            price: l.price !== undefined ? String(l.price) : '',
          }))
        : null,
    [orderId, order],
  );
  const shown = lines ?? fromOrder ?? [];
  const supplierOf = order?.supplier.id ?? supplierId;
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const orderLine = new Map(order?.lines.map((l) => [l.id, l]) ?? []);
  const sold = new Map(
    suppliers.find((s) => s.id === supplierOf)?.items.map((i) => [i.ingredientId, i]) ?? [],
  );
  const update = (key: number, change: Partial<Draft>) =>
    setLines(shown.map((l) => (l.key === key ? { ...l, ...change } : l)));
  const now = useNow();
  /** An item that tracks expiry: the date typed, else today + its shelf life ("" to type). */
  const expiresOf = (draft: Draft): string | undefined => {
    const expiry = byId.get(draft.ingredientId)?.expiry;
    if (!expiry) return undefined;
    if (draft.expires !== undefined) return draft.expires;
    return expiry.shelfLifeDays && now ? shiftDay(clock.dayKey(now), expiry.shelfLifeDays) : '';
  };

  const problems = shown.map((l) => {
    if (!l.ingredientId) return 'ingredient';
    const q = parseQuantity(l.quantity);
    if (q === null || q <= 0) return 'quantity';
    const r = l.rejected.trim() ? parseQuantity(l.rejected) : 0;
    if (r === null || r > q) return 'rejected';
    if (prices && l.price.trim() && parseCost(l.price) === null) return 'price';
    const expires = expiresOf(l);
    if (expires !== undefined && q - r > 0 && !isDayKey(expires)) return 'expires';
    return null;
  });
  const uploading = photos.unsettled([PHOTO]);
  const ready =
    Boolean(supplierOf) && shown.length > 0 && problems.every((p) => p === null) && !uploading;

  const submit = () => {
    setTried(true);
    if (!ready) return;
    const proofKey = photos.keysOf(PHOTO)[0];
    receive.mutate(
      {
        branchId: branch.id,
        body: {
          entryId,
          supplierId: supplierOf,
          ...(orderId ? { orderId } : {}),
          ...(invoiceNumber.trim() ? { invoiceNumber: invoiceNumber.trim() } : {}),
          ...(proofKey ? { proofKey } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
          lines: shown
            // A line of the order that brought nothing this time stays out.
            .filter((l) => (parseQuantity(l.quantity) ?? 0) > 0)
            .map<ReceiptLineInput>((l) => ({
              ...(l.orderLineId
                ? { orderLineId: l.orderLineId }
                : {
                    ingredientId: l.ingredientId,
                    ...(l.measure.startsWith('pack:')
                      ? { packId: l.measure.slice(5) }
                      : l.measure
                        ? { unit: l.measure as InventoryUnit }
                        : {}),
                  }),
              quantity: parseQuantity(l.quantity) ?? 0,
              ...(l.rejected.trim() ? { rejected: parseQuantity(l.rejected) ?? 0 } : {}),
              ...(l.rejectReason.trim() ? { rejectReason: l.rejectReason.trim() } : {}),
              ...(prices && l.price.trim() ? { price: parseCost(l.price) ?? 0 } : {}),
              ...(expiresOf(l) ? { expiresOn: expiresOf(l) } : {}),
              ...(expiresOf(l) && l.lot?.trim() ? { lot: l.lot.trim() } : {}),
            })),
        },
      },
      {
        onSuccess: (saved) => {
          showToast(t('adminPurchasing.receive.done', { number: docNumber('GRN', saved.number) }), {
            tone: 'success',
          });
          onClose();
        },
        onError: (error) =>
          showToast(
            isApiError(error, 'po_closed')
              ? t('adminPurchasing.errors.closed')
              : t('adminInventory.errors.failed'),
            { tone: 'error' },
          ),
      },
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={
        order
          ? t('adminPurchasing.receive.titleOrder', { number: docNumber('PO', order.number) })
          : t('adminPurchasing.receive.title')
      }
      description={prices ? undefined : t('adminPurchasing.receive.noPrices')}
      footer={
        <Button
          block
          iconStart="check"
          disabled={uploading}
          loading={receive.isPending}
          onClick={submit}
        >
          {t('adminPurchasing.receive.confirm')}
        </Button>
      }
    >
      <div className={styles.form}>
        {!initialOrder && (
          <div className={styles.fieldRow}>
            <Select
              id="grn-order"
              label={t('adminPurchasing.receive.order')}
              value={orderId}
              onChange={(event) => {
                setOrderId(event.target.value);
                setLines(event.target.value ? null : [blankLine()]);
              }}
            >
              <option value="">{t('adminPurchasing.receive.noOrder')}</option>
              {open.map((o) => (
                <option key={o.id} value={o.id}>
                  {[docNumber('PO', o.number), o.supplier.name].join(' · ')}
                </option>
              ))}
            </Select>
            {!orderId && (
              <Select
                id="grn-supplier"
                label={t('adminPurchasing.orders.supplier')}
                value={supplierId}
                error={tried && !supplierId ? t('adminPurchasing.orders.pickSupplier') : undefined}
                onChange={(event) => setSupplierId(event.target.value)}
              >
                <option value="" disabled>
                  {t('adminPurchasing.orders.pickSupplier')}
                </option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
          </div>
        )}
        {orderId && !order && <p className={styles.muted}>{t('adminInventory.loading')}</p>}
        {shown.map((line, index) => {
          const ingredient = byId.get(line.ingredientId);
          const ordered = line.orderLineId ? orderLine.get(line.orderLineId) : undefined;
          const problem = tried ? problems[index] : null;
          const id = `grn-${line.key}`;
          return (
            <fieldset key={line.key} className={styles.line}>
              <div className={styles.lineHead}>
                <legend className={styles.label}>
                  {ordered
                    ? `${ordered.name} · ${t('adminPurchasing.receive.ordered', {
                        quantity: text.packs(ordered.quantity, ordered.pack),
                        received: text.packs(ordered.received, ordered.pack),
                      })}`
                    : t('adminInventory.entry.line', { number: index + 1 })}
                </legend>
                {!ordered && shown.length > 1 && (
                  <IconButton
                    icon="trash"
                    label={t('adminInventory.entry.removeLine')}
                    onClick={() => setLines(shown.filter((l) => l.key !== line.key))}
                  />
                )}
              </div>
              {!ordered && (
                <div className={styles.fieldRow}>
                  <Select
                    id={`${id}-ingredient`}
                    label={t('adminInventory.entry.ingredient')}
                    value={line.ingredientId}
                    error={problem === 'ingredient' ? t('adminInventory.entry.pick') : undefined}
                    onChange={(event) => {
                      const item = sold.get(event.target.value);
                      update(line.key, {
                        ingredientId: event.target.value,
                        measure: '',
                        price: item?.price !== undefined ? String(item.price) : '',
                      });
                    }}
                  >
                    <option value="" disabled>
                      {t('adminInventory.entry.pickPlaceholder')}
                    </option>
                    {ingredients.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </Select>
                  {ingredient && (
                    <Select
                      id={`${id}-pack`}
                      label={t('adminPurchasing.orders.pack')}
                      value={line.measure}
                      onChange={(event) => update(line.key, { measure: event.target.value })}
                    >
                      <option value="">
                        {sold.get(ingredient.id)
                          ? text.pack(
                              sold.get(ingredient.id)?.pack ?? {
                                name: '',
                                size: 1,
                                unit: ingredient.unit,
                              },
                            )
                          : text.unit(ingredient.unit)}
                      </option>
                      {ingredient.packs.map((p) => (
                        <option key={p.id} value={`pack:${p.id}`}>
                          {text.pack({ name: p.name, size: p.quantity, unit: ingredient.unit })}
                        </option>
                      ))}
                      {unitsLike(ingredient.unit).map((u) => (
                        <option key={u} value={u}>
                          {text.unit(u)}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
              )}
              <div className={styles.fieldRow}>
                <Input
                  id={`${id}-quantity`}
                  label={t('adminPurchasing.receive.came')}
                  inputMode="decimal"
                  value={line.quantity}
                  error={
                    problem === 'quantity' ? t('adminInventory.entry.quantityError') : undefined
                  }
                  onChange={(event) => update(line.key, { quantity: event.target.value })}
                />
                <Input
                  id={`${id}-rejected`}
                  label={t('adminPurchasing.receive.rejected')}
                  optional
                  inputMode="decimal"
                  value={line.rejected}
                  error={
                    problem === 'rejected' ? t('adminPurchasing.receive.rejectedError') : undefined
                  }
                  onChange={(event) => update(line.key, { rejected: event.target.value })}
                />
                {prices && (
                  <Input
                    id={`${id}-price`}
                    label={t('adminPurchasing.orders.price')}
                    optional
                    inputMode="decimal"
                    value={line.price}
                    error={problem === 'price' ? t('adminInventory.entry.costError') : undefined}
                    onChange={(event) => update(line.key, { price: event.target.value })}
                  />
                )}
              </div>
              {expiresOf(line) !== undefined && (
                <div className={styles.fieldRow}>
                  <Input
                    id={`${id}-expires`}
                    type="date"
                    label={t('adminInventory.expiry.expires')}
                    value={expiresOf(line) ?? ''}
                    error={problem === 'expires' ? t('adminInventory.expiry.dateError') : undefined}
                    onChange={(event) => update(line.key, { expires: event.target.value })}
                  />
                  <Input
                    id={`${id}-lot`}
                    label={t('adminInventory.expiry.lot')}
                    optional
                    maxLength={40}
                    autoComplete="off"
                    value={line.lot ?? ''}
                    onChange={(event) => update(line.key, { lot: event.target.value })}
                  />
                </div>
              )}
              {(parseQuantity(line.rejected) ?? 0) > 0 && (
                <Input
                  id={`${id}-why`}
                  label={t('adminPurchasing.receive.rejectReason')}
                  maxLength={100}
                  value={line.rejectReason}
                  onChange={(event) => update(line.key, { rejectReason: event.target.value })}
                />
              )}
            </fieldset>
          );
        })}
        {!orderId && (
          <Button
            variant="secondary"
            iconStart="plus"
            onClick={() => setLines([...shown, blankLine()])}
          >
            {t('adminInventory.entry.addLine')}
          </Button>
        )}
        <Input
          id="grn-invoice"
          label={t('adminPurchasing.receive.invoice')}
          optional
          maxLength={40}
          value={invoiceNumber}
          onChange={(event) => setInvoiceNumber(event.target.value)}
        />
        <ProofPicker
          id="grn-photo"
          photos={photos.photosOf(PHOTO)}
          onAdd={(files) => photos.add(PHOTO, files.slice(0, 1))}
          onRemove={(photoId) => photos.remove(PHOTO, photoId)}
        />
        <Textarea
          id="grn-note"
          label={t('adminInventory.entry.note')}
          optional
          rows={2}
          maxLength={300}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
    </Dialog>
  );
}
