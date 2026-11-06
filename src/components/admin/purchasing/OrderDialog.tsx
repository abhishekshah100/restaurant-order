'use client';

import { useMemo, useState } from 'react';
import { isApiError } from '@/api/client';
import { useContent, useIngredients, usePurchaseOrder, useSuppliers } from '@/api/hooks';
import { usePurchaseOrderStep, useSavePurchaseOrder } from '@/api/mutations';
import { Button, Dialog, IconButton, Input, Select, Textarea } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { cx } from '@/lib/cx';
import { parseCost, parseQuantity, quantityText, unitsLike } from '@/lib/inventory';
import type { InventoryUnit } from '@/types/inventory';
import type { OrderLineInput, PurchaseOrder } from '@/types/purchasing';
import styles from '../inventory/Inventory.module.css';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { StatusChip } from './StatusChip';
import { docNumber, usePurchasingText } from './usePurchasingText';

interface Draft {
  key: number;
  ingredientId: string;
  /** "pack:<id>", a unit code, or "" (the supplier's pack, else the ingredient's unit). */
  measure: string;
  quantity: string;
  price: string;
  tax: string;
}
let nextKey = 1;

/** A new order, or a draft (or approved, unsent) one changed: its supplier, lines, date, note. */
function OrderEditor({ order, onDone }: { order?: PurchaseOrder; onDone: () => void }) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const text = usePurchasingText();
  const { showToast } = useToast();
  const save = useSavePurchaseOrder();
  const suppliers = useSuppliers(branch.id).data?.suppliers ?? [];
  const ingredients = useIngredients(branch.id).data?.ingredients ?? [];
  const [supplierId, setSupplierId] = useState(order?.supplier.id ?? '');
  const [expectedOn, setExpectedOn] = useState(order?.expectedOn ?? '');
  const [note, setNote] = useState(order?.note ?? '');
  const [lines, setLines] = useState<Draft[]>(
    () =>
      order?.lines.map((l) => ({
        key: nextKey++,
        ingredientId: l.ingredientId,
        measure: '',
        quantity: quantityText(l.quantity),
        price: l.price !== undefined ? String(l.price) : '',
        tax: l.taxRate ? String(l.taxRate) : '',
      })) ?? [{ key: nextKey++, ingredientId: '', measure: '', quantity: '', price: '', tax: '' }],
  );
  const [tried, setTried] = useState(false);
  const supplier = suppliers.find((s) => s.id === supplierId);
  const sold = new Map(supplier?.items.map((i) => [i.ingredientId, i]) ?? []);
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  // What the supplier sells first, then everything else.
  const choices = [
    ...ingredients.filter((i) => sold.has(i.id)),
    ...ingredients.filter((i) => !sold.has(i.id)),
  ];
  const update = (key: number, change: Partial<Draft>) =>
    setLines((all) => all.map((l) => (l.key === key ? { ...l, ...change } : l)));
  const problems = lines.map((l) => {
    if (!l.ingredientId) return 'ingredient';
    const q = parseQuantity(l.quantity);
    if (q === null || q <= 0) return 'quantity';
    if (l.price.trim() && parseCost(l.price) === null) return 'price';
    if (l.tax.trim() && (parseCost(l.tax) === null || Number(l.tax) > 100)) return 'tax';
    return null;
  });
  const ready = Boolean(supplierId) && lines.length > 0 && problems.every((p) => p === null);

  const submit = () => {
    setTried(true);
    if (!ready) return;
    const body = {
      supplierId,
      ...(expectedOn ? { expectedOn } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
      lines: lines.map<OrderLineInput>((l) => ({
        ingredientId: l.ingredientId,
        ...(l.measure.startsWith('pack:')
          ? { packId: l.measure.slice(5) }
          : l.measure
            ? { unit: l.measure as InventoryUnit }
            : {}),
        quantity: parseQuantity(l.quantity) ?? 0,
        ...(l.price.trim() ? { price: parseCost(l.price) ?? 0 } : {}),
        ...(l.tax.trim() ? { taxRate: Number(l.tax) } : {}),
      })),
    };
    save.mutate(
      { branchId: branch.id, ...(order ? { id: order.id } : {}), body },
      {
        onSuccess: (saved) => {
          showToast(t('adminPurchasing.orders.saved', { number: docNumber('PO', saved.number) }), {
            tone: 'success',
          });
          onDone();
        },
        onError: (error) =>
          showToast(
            isApiError(error, 'po_not_editable')
              ? t('adminPurchasing.errors.notEditable')
              : t('adminInventory.errors.failed'),
            { tone: 'error' },
          ),
      },
    );
  };

  return (
    <div className={styles.form}>
      <div className={styles.fieldRow}>
        <Select
          id="po-supplier"
          label={t('adminPurchasing.orders.supplier')}
          value={supplierId}
          disabled={Boolean(order)}
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
        <Input
          id="po-expected"
          type="date"
          label={t('adminPurchasing.orders.expectedOn')}
          optional
          value={expectedOn}
          onChange={(event) => setExpectedOn(event.target.value)}
        />
      </div>
      {lines.map((line, index) => {
        const ingredient = byId.get(line.ingredientId);
        const item = sold.get(line.ingredientId);
        const problem = tried ? problems[index] : null;
        return (
          <fieldset key={line.key} className={styles.line}>
            <div className={styles.lineHead}>
              <legend className={styles.label}>
                {t('adminInventory.entry.line', { number: index + 1 })}
              </legend>
              {lines.length > 1 && (
                <IconButton
                  icon="trash"
                  label={t('adminInventory.entry.removeLine')}
                  onClick={() => setLines((all) => all.filter((l) => l.key !== line.key))}
                />
              )}
            </div>
            <Select
              id={`po-${line.key}-ingredient`}
              label={t('adminInventory.entry.ingredient')}
              value={line.ingredientId}
              error={problem === 'ingredient' ? t('adminInventory.entry.pick') : undefined}
              onChange={(event) => {
                const next = sold.get(event.target.value);
                update(line.key, {
                  ingredientId: event.target.value,
                  measure: '',
                  price: next?.price !== undefined ? String(next.price) : '',
                });
              }}
            >
              <option value="" disabled>
                {t('adminInventory.entry.pickPlaceholder')}
              </option>
              {choices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </Select>
            <div className={styles.fieldRow}>
              <Input
                id={`po-${line.key}-quantity`}
                label={t('adminPurchasing.orders.packs')}
                inputMode="decimal"
                value={line.quantity}
                error={problem === 'quantity' ? t('adminInventory.entry.quantityError') : undefined}
                onChange={(event) => update(line.key, { quantity: event.target.value })}
              />
              {ingredient && (
                <Select
                  id={`po-${line.key}-pack`}
                  label={t('adminPurchasing.orders.pack')}
                  value={line.measure}
                  onChange={(event) => update(line.key, { measure: event.target.value })}
                >
                  <option value="">
                    {item ? text.pack(item.pack) : text.unit(ingredient.unit)}
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
              <Input
                id={`po-${line.key}-price`}
                label={t('adminPurchasing.orders.price')}
                optional
                inputMode="decimal"
                value={line.price}
                error={problem === 'price' ? t('adminInventory.entry.costError') : undefined}
                onChange={(event) => update(line.key, { price: event.target.value })}
              />
              <Input
                id={`po-${line.key}-tax`}
                label={t('adminPurchasing.orders.tax')}
                optional
                inputMode="decimal"
                value={line.tax}
                error={problem === 'tax' ? t('adminPurchasing.orders.taxError') : undefined}
                onChange={(event) => update(line.key, { tax: event.target.value })}
              />
            </div>
          </fieldset>
        );
      })}
      <Button
        variant="secondary"
        iconStart="plus"
        onClick={() =>
          setLines((all) => [
            ...all,
            { key: nextKey++, ingredientId: '', measure: '', quantity: '', price: '', tax: '' },
          ])
        }
      >
        {t('adminInventory.entry.addLine')}
      </Button>
      <Textarea
        id="po-note"
        label={t('adminInventory.entry.note')}
        optional
        rows={2}
        maxLength={300}
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <Button block iconStart="check" loading={save.isPending} onClick={submit}>
        {order ? t('adminPurchasing.orders.save') : t('adminPurchasing.orders.create')}
      </Button>
    </div>
  );
}

/** The order as a message to the supplier: its lines, date and note. */
function orderMessage(
  order: PurchaseOrder,
  line: (l: PurchaseOrder['lines'][number]) => string,
  intro: string,
) {
  return [intro, ...order.lines.map(line), order.note ?? ''].filter(Boolean).join('\n');
}

/**
 * One purchase order: its lines and what came in, and what can happen next by its status and the
 * staff member's permissions: edit, approve, send (WhatsApp, email, print), receive, cancel,
 * close short. A new one opens as the editor.
 */
export function OrderDialog({
  id,
  onReceive,
  onClose,
}: {
  /** None: a new order. */
  id?: string;
  onReceive: (orderId: string) => void;
  onClose: () => void;
}) {
  const t = useContent('common');
  const { branch, brand, can, clock } = useAdminWorkspace();
  const text = usePurchasingText();
  const { showToast } = useToast();
  const step = usePurchaseOrderStep();
  const query = usePurchaseOrder(branch.id, id ?? '');
  const order = id ? query.data : undefined;
  const [editing, setEditing] = useState(!id);
  const message = useMemo(
    () =>
      order
        ? orderMessage(
            order,
            (l) => `• ${l.name}: ${text.packs(l.quantity, l.pack)}`,
            t('adminPurchasing.orders.message', {
              number: docNumber('PO', order.number),
              brand,
              date: order.expectedOn ? clock.date(`${order.expectedOn}T12:00:00Z`) : '',
            }),
          )
        : '',
    [order, text, t, brand, clock],
  );

  const run = (s: 'approve' | 'send' | 'cancel' | 'close') =>
    order &&
    step.mutate(
      { branchId: branch.id, id: order.id, step: s },
      {
        onSuccess: () => showToast(t(`adminPurchasing.orders.done.${s}`), { tone: 'success' }),
        onError: (error) =>
          showToast(
            isApiError(error, 'po_not_approved')
              ? t('adminPurchasing.errors.notApproved')
              : isApiError(error, 'po_not_editable')
                ? t('adminPurchasing.errors.notEditable')
                : t('adminInventory.errors.failed'),
            { tone: 'error' },
          ),
      },
    );

  const title = order
    ? t('adminPurchasing.orders.title', { number: docNumber('PO', order.number) })
    : t('adminPurchasing.orders.newTitle');
  let body;
  if (id && !order) {
    body = (
      <p className={styles.muted} aria-busy={!query.isError}>
        {query.isError ? t('adminInventory.failed') : t('adminInventory.loading')}
      </p>
    );
  } else if (editing) {
    body = <OrderEditor order={order} onDone={id ? () => setEditing(false) : onClose} />;
  } else if (order) {
    const editable = ['draft', 'approved'].includes(order.status) && can('purchase.manage');
    const receivable = ['approved', 'sent', 'partly_received'].includes(order.status);
    const phone = order.supplier.phone?.replace(/\D/g, '');
    body = (
      <div className={styles.form}>
        <div className={styles.lineHead}>
          <span className={styles.rowName}>{order.supplier.name}</span>
          <StatusChip status={order.status} />
        </div>
        <p className={styles.muted}>
          {[
            t('adminPurchasing.orders.createdBy', {
              time: clock.dateTime(order.createdAt),
              name: order.createdBy ?? '—',
            }),
            order.approvedBy && t('adminPurchasing.orders.approvedBy', { name: order.approvedBy }),
            order.expectedOn &&
              t('adminPurchasing.orders.expected', {
                date: clock.date(`${order.expectedOn}T12:00:00Z`),
              }),
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {order.needsApproval && (
          <p className={cx(styles.chip, styles.low)}>{t('adminPurchasing.orders.needsApproval')}</p>
        )}
        <ul className={styles.list}>
          {order.lines.map((l) => (
            <li key={l.id} className={styles.row}>
              <span className={styles.rowMain}>
                <span className={styles.rowName}>{l.name}</span>
                <span className={styles.muted}>
                  {[
                    text.packs(l.quantity, l.pack),
                    l.price !== undefined ? text.perPack(l.price, l.pack) : null,
                    l.taxRate ? t('adminPurchasing.orders.taxRate', { rate: l.taxRate }) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <span className={styles.rowSide}>
                {l.total !== undefined && (
                  <span className={styles.quantity}>{text.money(l.total)}</span>
                )}
                {l.received > 0 && (
                  <span className={styles.muted}>
                    {t('adminPurchasing.orders.received', {
                      quantity: text.packs(l.received, l.pack),
                    })}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
        {order.total !== undefined && (
          <p className={styles.blockTitle}>
            {t('adminPurchasing.orders.total', {
              total: text.money(order.total),
              tax: text.money(order.tax ?? 0),
            })}
          </p>
        )}
        {order.note && <p className={styles.muted}>{order.note}</p>}
        <div className={styles.actions}>
          {editable && (
            <Button variant="secondary" iconStart="pencil" onClick={() => setEditing(true)}>
              {t('adminPurchasing.orders.edit')}
            </Button>
          )}
          {order.status === 'draft' && can('purchase.approve') && (
            <Button iconStart="check" loading={step.isPending} onClick={() => run('approve')}>
              {t('adminPurchasing.orders.approve')}
            </Button>
          )}
          {order.status === 'approved' && can('purchase.manage') && (
            <Button iconStart="arrow" loading={step.isPending} onClick={() => run('send')}>
              {t('adminPurchasing.orders.markSent')}
            </Button>
          )}
          {receivable && can('purchase.receive', 'purchase.manage') && (
            <Button iconStart="bag" onClick={() => onReceive(order.id)}>
              {t('adminPurchasing.orders.receive')}
            </Button>
          )}
          {['sent', 'approved', 'partly_received'].includes(order.status) && (
            <>
              {phone && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    window.open(
                      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
                      '_blank',
                      'noopener',
                    )
                  }
                >
                  {t('adminPurchasing.orders.whatsApp')}
                </Button>
              )}
              {order.supplier.email && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    window.location.href = `mailto:${order.supplier.email ?? ''}?subject=${encodeURIComponent(
                      docNumber('PO', order.number),
                    )}&body=${encodeURIComponent(message)}`;
                  }}
                >
                  {t('adminPurchasing.orders.email')}
                </Button>
              )}
              <Button variant="secondary" iconStart="printer" onClick={() => window.print()}>
                {t('adminPurchasing.orders.print')}
              </Button>
            </>
          )}
          {['draft', 'approved', 'sent'].includes(order.status) && can('purchase.manage') && (
            <Button variant="ghost" onClick={() => run('cancel')}>
              {t('adminPurchasing.orders.cancel')}
            </Button>
          )}
          {order.status === 'partly_received' && can('purchase.manage') && (
            <Button variant="ghost" onClick={() => run('close')}>
              {t('adminPurchasing.orders.close')}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <Dialog open onClose={onClose} presentation="adaptive" title={title}>
      {body}
    </Dialog>
  );
}
