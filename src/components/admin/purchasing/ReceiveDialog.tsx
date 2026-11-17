'use client';

import { useState } from 'react';
import { isApiError } from '@/api/client';
import {
  useContent,
  useIngredients,
  usePurchaseOrder,
  usePurchaseOrders,
  useSuppliers,
} from '@/api/hooks';
import { useReceive } from '@/api/mutations';
import { Button, Dialog, Icon, IconButton, Input, Select, Textarea } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useNow } from '@/hooks/useNow';
import { cx } from '@/lib/cx';
import { isDayKey, shiftDay } from '@/lib/dayRange';
import { newEntryId, parseCost, parseQuantity, quantityText, unitsLike } from '@/lib/inventory';
import type { InventoryUnit } from '@/types/inventory';
import type { PackView, PurchaseOrder, ReceiptLineInput, ReturnReason } from '@/types/purchasing';
import { ProofPicker } from '../payments/ProofPicker';
import { useProofPhotos } from '../payments/useProofPhotos';
import { InfoTip } from '../inventory/InfoTip';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { Qty } from './Qty';
import { docNumber, usePurchasingText } from './usePurchasingText';
import styles from './Purchasing.module.css';

/** Why something was refused at the door (said on the delivery, in the staff's words). */
const REFUSE_REASONS: readonly ReturnReason[] = [
  'damaged',
  'wrong_item',
  'expired',
  'excess',
  'other',
];
const ON_THE_WAY = ['approved', 'sent', 'partly_received'];
const PHOTO = 'invoice';

/** An item of the order: not checked yet, came as ordered, or something was different. */
type Check = 'open' | 'ok' | 'different';

interface Line {
  key: number;
  /** Against an order: its line, and how much of it is still to come. */
  orderLineId?: string;
  expected?: number;
  ingredientId: string;
  name?: string;
  pack?: PackView;
  /** Bought without an order, not on the supplier's list: "pack:<id>", a unit, or "". */
  measure: string;
  check: Check;
  /** What came (when different, or bought without an order). */
  quantity: string;
  rejected: string;
  reason: ReturnReason | '';
  price: string;
  expectedPrice?: number;
  expires?: string;
  lot?: string;
}
let nextKey = 1;

const orderLines = (order: PurchaseOrder): Line[] =>
  order.lines
    .filter((l) => l.quantity - l.received > 0)
    .map((l) => ({
      key: nextKey++,
      orderLineId: l.id,
      expected: l.quantity - l.received,
      ingredientId: l.ingredientId,
      name: l.name,
      pack: l.pack,
      measure: '',
      check: 'open',
      quantity: '',
      rejected: '',
      reason: '',
      price: '',
      ...(l.price !== undefined ? { expectedPrice: l.price } : {}),
    }));

/**
 * A delivery received, made quick. First, what arrived: one of the orders on the way (late ones
 * first), or something bought without an order. Against an order, its items as a checklist:
 * "Everything came as ordered" ticks them all; an item that was different says how many came,
 * how many were refused at the door and why (reason chips), and the price on the bill. Without
 * an order: the supplier, then how many of each of their items came, and anything else. Then a
 * photo of the supplier's bill (a big button), with its number and a note under "More". Items
 * that track expiry ask for their last good day (filled from their shelf life). Sent with an
 * entry id, so a retry records it once.
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
  const onTheWay = (usePurchaseOrders(branch.id, {}).data?.orders ?? [])
    .filter((o) => ON_THE_WAY.includes(o.status))
    .sort((a, b) => (a.expectedOn ?? '9999').localeCompare(b.expectedOn ?? '9999'));
  const [entryId] = useState(newEntryId);
  // What arrived: an order's id, "direct" (bought without an order), or not chosen yet.
  const [source, setSource] = useState<string | 'direct' | null>(initialOrder ?? null);
  const orderId = source && source !== 'direct' ? source : '';
  const order = usePurchaseOrder(branch.id, orderId).data;
  const [supplierId, setSupplierId] = useState('');
  const [lines, setLines] = useState<Line[] | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [note, setNote] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [tried, setTried] = useState(false);
  const now = useNow();
  const today = clock.dayKey(now ?? new Date());

  // An order's items, once it's read.
  if (order && order.id === orderId && lines === null) setLines(orderLines(order));
  const shown = lines ?? [];
  const supplierOf = order?.supplier.id ?? supplierId;
  const supplier = suppliers.find((s) => s.id === supplierOf);
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const update = (key: number, change: Partial<Line>) =>
    setLines((all) => (all ?? []).map((l) => (l.key === key ? { ...l, ...change } : l)));

  /** How much came: as ordered when ticked, else what was typed. */
  const cameOf = (l: Line) =>
    l.orderLineId && l.check === 'ok' ? (l.expected ?? 0) : (parseQuantity(l.quantity) ?? 0);
  /** An item that tracks expiry: the date typed, else today + its shelf life ("" to type). */
  const expiresOf = (l: Line): string | undefined => {
    const expiry = byId.get(l.ingredientId)?.expiry;
    if (!expiry) return undefined;
    if (l.expires !== undefined) return l.expires;
    return expiry.shelfLifeDays ? shiftDay(today, expiry.shelfLifeDays) : '';
  };
  const counted = (l: Line) => (l.orderLineId ? l.check !== 'open' : cameOf(l) > 0);

  const problems = shown.map((l) => {
    if (!counted(l)) return null;
    if (!l.ingredientId) return 'ingredient';
    const q = cameOf(l);
    if ((l.check === 'different' || !l.orderLineId) && parseQuantity(l.quantity) === null) {
      return 'quantity';
    }
    const r = l.rejected.trim() ? parseQuantity(l.rejected) : 0;
    if (r === null || r > q) return 'rejected';
    if (prices && l.price.trim() && parseCost(l.price) === null) return 'price';
    const expires = expiresOf(l);
    if (expires !== undefined && q - r > 0 && !isDayKey(expires)) return 'expires';
    return null;
  });
  const arriving = shown.filter((l) => counted(l) && cameOf(l) > 0);
  const uploading = photos.unsettled([PHOTO]);
  const ready =
    Boolean(supplierOf) && arriving.length > 0 && problems.every((p) => p === null) && !uploading;
  const checkedCount = shown.filter((l) => l.orderLineId && l.check !== 'open').length;

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
          lines: arriving.map<ReceiptLineInput>((l) => {
            const rejected = l.rejected.trim() ? (parseQuantity(l.rejected) ?? 0) : 0;
            const expires = expiresOf(l);
            return {
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
              quantity: cameOf(l),
              ...(rejected > 0
                ? {
                    rejected,
                    ...(l.reason
                      ? { rejectReason: t(`adminPurchasing.returns.reasons.${l.reason}`) }
                      : {}),
                  }
                : {}),
              ...(prices && l.price.trim() ? { price: parseCost(l.price) ?? 0 } : {}),
              ...(expires ? { expiresOn: expires } : {}),
              ...(expires && l.lot?.trim() ? { lot: l.lot.trim() } : {}),
            };
          }),
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

  /* ---------- What arrived? ---------- */
  if (source === null) {
    return (
      <Dialog
        open
        onClose={onClose}
        presentation="adaptive"
        title={t('adminPurchasing.receive.title')}
        description={t('adminPurchasing.receive.whichIntro')}
      >
        <div className={styles.editor}>
          {onTheWay.length > 0 ? (
            <ul className={styles.pickList}>
              {onTheWay.map((o) => {
                const late = o.expectedOn !== undefined && o.expectedOn < today;
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      className={styles.pick}
                      onClick={() => {
                        setLines(null);
                        setSource(o.id);
                      }}
                    >
                      <span className={styles.pickIcon} aria-hidden="true">
                        <Icon name="bag" size="sm" />
                      </span>
                      <span className={styles.rowMain}>
                        <span className={styles.rowTitle}>{o.supplier.name}</span>
                        <span className={cx(styles.rowMeta, late && styles.lateText)}>
                          {[
                            docNumber('PO', o.number),
                            t.plural('adminPurchasing.orders.lineCount', o.lines.length),
                            o.expectedOn &&
                              (late
                                ? t('adminPurchasing.today.lateSince', {
                                    date: clock.date(`${o.expectedOn}T12:00:00Z`),
                                  })
                                : t('adminPurchasing.orders.expected', {
                                    date: clock.date(`${o.expectedOn}T12:00:00Z`),
                                  })),
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                      <Icon name="chev" size="sm" className={styles.rowChev} />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={styles.note}>
              <Icon name="info" size="xs" />
              {t('adminPurchasing.receive.noneOnTheWay')}
            </p>
          )}
          <button
            type="button"
            className={cx(styles.pick, styles.pickDirect)}
            onClick={() => {
              setLines([]);
              setSource('direct');
            }}
          >
            <span className={styles.pickIcon} aria-hidden="true">
              <Icon name="store" size="sm" />
            </span>
            <span className={styles.rowMain}>
              <span className={styles.rowTitle}>{t('adminPurchasing.receive.direct')}</span>
              <span className={styles.rowMeta}>{t('adminPurchasing.receive.directHint')}</span>
            </span>
            <Icon name="chev" size="sm" className={styles.rowChev} />
          </button>
        </div>
      </Dialog>
    );
  }

  /* ---------- Checking it in ---------- */
  const catalog = source === 'direct' ? (supplier?.items ?? []) : [];
  const catalogQty = (ingredientId: string) =>
    shown.find((l) => !l.orderLineId && l.ingredientId === ingredientId && l.name !== undefined);
  const setCatalogQty = (ingredientId: string, value: string) =>
    setLines((all) => {
      const list = all ?? [];
      const found = list.find(
        (l) => !l.orderLineId && l.ingredientId === ingredientId && l.name !== undefined,
      );
      if (found) return list.map((l) => (l === found ? { ...l, quantity: value } : l));
      const item = catalog.find((i) => i.ingredientId === ingredientId);
      return [
        ...list,
        {
          key: nextKey++,
          ingredientId,
          name: item?.name ?? '',
          ...(item ? { pack: item.pack } : {}),
          measure: '',
          check: 'ok',
          quantity: value,
          rejected: '',
          reason: '',
          price: '',
          ...(item?.price !== undefined ? { expectedPrice: item.price } : {}),
        },
      ];
    });
  const extras = shown.filter((l) => !l.orderLineId && l.name === undefined);

  const details = (l: Line, index: number) => {
    const problem = tried ? problems[index] : null;
    const id = `grn-${l.key}`;
    const rejected = parseQuantity(l.rejected) ?? 0;
    const expires = expiresOf(l);
    return (
      <div className={styles.different}>
        <div className={styles.extraRow}>
          {(l.orderLineId || l.name === undefined) && (
            <Input
              id={`${id}-q`}
              label={t('adminPurchasing.receive.came')}
              inputMode="decimal"
              value={l.quantity}
              error={problem === 'quantity' ? t('adminInventory.entry.quantityError') : undefined}
              onChange={(e) => update(l.key, { quantity: e.target.value })}
            />
          )}
          <Input
            id={`${id}-r`}
            label={t('adminPurchasing.receive.rejected')}
            optional
            inputMode="decimal"
            value={l.rejected}
            error={problem === 'rejected' ? t('adminPurchasing.receive.rejectedError') : undefined}
            onChange={(e) => update(l.key, { rejected: e.target.value })}
          />
          {prices && (
            <Input
              id={`${id}-p`}
              label={t('adminPurchasing.receive.billPrice')}
              optional
              inputMode="decimal"
              placeholder={l.expectedPrice !== undefined ? String(l.expectedPrice) : undefined}
              value={l.price}
              error={problem === 'price' ? t('adminInventory.entry.costError') : undefined}
              onChange={(e) => update(l.key, { price: e.target.value })}
            />
          )}
        </div>
        {rejected > 0 && (
          <div
            className={styles.reasons}
            role="group"
            aria-label={t('adminPurchasing.receive.rejectReason')}
          >
            <span className={styles.reasonsLabel}>
              {t('adminPurchasing.receive.rejectReason')}
              <InfoTip label={t('adminInventory.tips.label')}>
                {t('adminPurchasing.tips.refused')}
              </InfoTip>
            </span>
            {REFUSE_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                className={styles.dayChip}
                aria-pressed={l.reason === r}
                onClick={() => update(l.key, { reason: l.reason === r ? '' : r })}
              >
                {t(`adminPurchasing.returns.reasons.${r}`)}
              </button>
            ))}
          </div>
        )}
        {expires !== undefined && (
          <div className={styles.extraRow}>
            <Input
              id={`${id}-x`}
              type="date"
              label={t('adminInventory.expiry.expires')}
              value={expires}
              error={problem === 'expires' ? t('adminInventory.expiry.dateError') : undefined}
              onChange={(e) => update(l.key, { expires: e.target.value })}
            />
            <Input
              id={`${id}-lot`}
              label={t('adminInventory.expiry.lot')}
              optional
              maxLength={40}
              autoComplete="off"
              value={l.lot ?? ''}
              onChange={(e) => update(l.key, { lot: e.target.value })}
            />
          </div>
        )}
      </div>
    );
  };

  const title = order
    ? t('adminPurchasing.receive.titleOrder', { number: docNumber('PO', order.number) })
    : t('adminPurchasing.receive.titleDirect');

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={title}
      className={styles.orderDialog}
      footer={
        <div className={styles.editorFoot}>
          <p className={styles.runningTotal}>
            <span>
              {orderId
                ? t('adminPurchasing.receive.checked', { done: checkedCount, total: shown.length })
                : t.plural('adminPurchasing.orders.lineCount', arriving.length)}
            </span>
            {uploading && <span>{t('adminPurchasing.receive.uploading')}</span>}
          </p>
          <Button
            block
            iconStart="check"
            disabled={uploading}
            loading={receive.isPending}
            onClick={submit}
          >
            {t('adminPurchasing.receive.confirm')}
          </Button>
        </div>
      }
    >
      <div className={styles.editor}>
        {!initialOrder && (
          <button type="button" className={styles.moreToggle} onClick={() => setSource(null)}>
            <Icon name="back" size="xs" />
            {t('adminPurchasing.receive.changeSource')}
          </button>
        )}
        {!prices && <p className={styles.note}>{t('adminPurchasing.receive.noPrices')}</p>}

        {/* Against an order: its items as a checklist. */}
        {orderId && !order && (
          <p className={styles.muted} aria-busy="true">
            {t('adminInventory.loading')}
          </p>
        )}
        {order && (
          <section className={styles.editorBlock}>
            <div className={styles.blockHead}>
              <span className={styles.rowMain}>
                <span className={styles.orderSupplierBig}>{order.supplier.name}</span>
                <span className={styles.muted}>{t('adminPurchasing.receive.checkIntro')}</span>
              </span>
            </div>
            <Button
              variant={shown.every((l) => l.check === 'ok') ? 'secondary' : 'primary'}
              iconStart="checkc"
              onClick={() =>
                setLines((all) =>
                  (all ?? []).map((l) => ({
                    ...l,
                    check: 'ok',
                    quantity: '',
                    rejected: '',
                    reason: '',
                  })),
                )
              }
            >
              {t('adminPurchasing.receive.allCame')}
            </Button>
            {shown.length === 0 && (
              <p className={styles.note}>{t('adminPurchasing.receive.nothingLeft')}</p>
            )}
            <ul className={styles.checklist}>
              {shown.map((l, index) => (
                <li key={l.key} className={styles.checkItem} data-check={l.check}>
                  <div className={styles.checkRow}>
                    <button
                      type="button"
                      className={styles.tick}
                      aria-pressed={l.check === 'ok'}
                      aria-label={t('adminPurchasing.receive.tick', { item: l.name ?? '' })}
                      onClick={() =>
                        update(l.key, { check: l.check === 'ok' ? 'open' : 'ok', quantity: '' })
                      }
                    >
                      {l.check === 'ok' && <Icon name="check" size="sm" />}
                    </button>
                    <span className={styles.rowMain}>
                      <span className={styles.rowTitle}>{l.name}</span>
                      <span className={styles.rowMeta}>
                        {[
                          l.pack && l.expected !== undefined && text.packs(l.expected, l.pack),
                          prices &&
                            l.expectedPrice !== undefined &&
                            l.pack &&
                            text.perPack(l.expectedPrice, l.pack),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    <button
                      type="button"
                      className={styles.differentToggle}
                      aria-pressed={l.check === 'different'}
                      onClick={() =>
                        update(l.key, {
                          check: l.check === 'different' ? 'open' : 'different',
                          quantity: l.check === 'different' ? '' : quantityText(l.expected ?? 0),
                        })
                      }
                    >
                      {t('adminPurchasing.receive.different')}
                    </button>
                  </div>
                  {l.check === 'different' && details(l, index)}
                  {l.check === 'ok' && expiresOf(l) !== undefined && details(l, index)}
                </li>
              ))}
            </ul>
            {tried && arriving.length === 0 && (
              <p className={styles.error} role="alert">
                {t('adminPurchasing.receive.nothingChecked')}
              </p>
            )}
          </section>
        )}

        {/* Bought without an order: the supplier, then what came. */}
        {source === 'direct' && (
          <section className={styles.editorBlock}>
            <Select
              id="grn-supplier"
              label={t('adminPurchasing.receive.fromWho')}
              value={supplierId}
              error={tried && !supplierId ? t('adminPurchasing.orders.pickSupplier') : undefined}
              onChange={(event) => {
                setSupplierId(event.target.value);
                setLines([]);
              }}
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
            {supplier && catalog.length > 0 && (
              <ul className={styles.items}>
                {catalog.map((item) => {
                  const line = catalogQty(item.ingredientId);
                  const index = line ? shown.indexOf(line) : -1;
                  const n = line ? (parseQuantity(line.quantity) ?? 0) : 0;
                  return (
                    <li
                      key={item.ingredientId}
                      className={cx(styles.itemStack, n > 0 && styles.itemOn)}
                    >
                      <div className={styles.item}>
                        <span className={styles.itemText}>
                          <span className={styles.itemName}>{item.name}</span>
                          <span className={styles.itemMeta}>
                            {[
                              text.pack(item.pack),
                              prices &&
                                item.price !== undefined &&
                                text.perPack(item.price, item.pack),
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </span>
                        <Qty
                          id={`grn-qty-${item.ingredientId}`}
                          label={t('adminPurchasing.receive.cameOf', { item: item.name })}
                          less={t('adminPurchasing.orders.less', { item: item.name })}
                          more={t('adminPurchasing.orders.moreOf', { item: item.name })}
                          value={line?.quantity ?? ''}
                          onChange={(v) => setCatalogQty(item.ingredientId, v)}
                        />
                      </div>
                      {line && n > 0 && details(line, index)}
                    </li>
                  );
                })}
              </ul>
            )}
            {supplier &&
              extras.map((l) => {
                const index = shown.indexOf(l);
                const problem = tried ? problems[index] : null;
                const ingredient = byId.get(l.ingredientId);
                return (
                  <fieldset key={l.key} className={styles.extra}>
                    <div className={styles.blockHead}>
                      <legend className={styles.extraTitle}>
                        {t('adminPurchasing.orders.extraTitle')}
                      </legend>
                      <IconButton
                        icon="trash"
                        size="sm"
                        label={t('adminInventory.entry.removeLine')}
                        onClick={() =>
                          setLines((all) => (all ?? []).filter((x) => x.key !== l.key))
                        }
                      />
                    </div>
                    <div className={styles.extraRow}>
                      <Select
                        id={`grn-${l.key}-i`}
                        label={t('adminInventory.entry.ingredient')}
                        value={l.ingredientId}
                        error={
                          problem === 'ingredient' ? t('adminInventory.entry.pick') : undefined
                        }
                        onChange={(e) =>
                          update(l.key, { ingredientId: e.target.value, measure: '' })
                        }
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
                          id={`grn-${l.key}-m`}
                          label={t('adminPurchasing.orders.pack')}
                          value={l.measure}
                          onChange={(e) => update(l.key, { measure: e.target.value })}
                        >
                          <option value="">{text.unit(ingredient.unit)}</option>
                          {ingredient.packs.map((p) => (
                            <option key={p.id} value={`pack:${p.id}`}>
                              {text.pack({ name: p.name, size: p.quantity, unit: ingredient.unit })}
                            </option>
                          ))}
                          {unitsLike(ingredient.unit)
                            .filter((u) => u !== ingredient.unit)
                            .map((u) => (
                              <option key={u} value={u}>
                                {text.unit(u)}
                              </option>
                            ))}
                        </Select>
                      )}
                    </div>
                    {details(l, index)}
                  </fieldset>
                );
              })}
            {supplier && (
              <Button
                variant="ghost"
                size="sm"
                iconStart="plus"
                className={styles.addExtra}
                onClick={() =>
                  setLines((all) => [
                    ...(all ?? []),
                    {
                      key: nextKey++,
                      ingredientId: '',
                      measure: '',
                      check: 'ok',
                      quantity: '',
                      rejected: '',
                      reason: '',
                      price: '',
                    },
                  ])
                }
              >
                {catalog.length > 0
                  ? t('adminPurchasing.orders.addExtra')
                  : t('adminPurchasing.receive.addItem')}
              </Button>
            )}
            {tried && supplier && arriving.length === 0 && (
              <p className={styles.error} role="alert">
                {t('adminPurchasing.receive.nothingCame')}
              </p>
            )}
          </section>
        )}

        {/* The supplier's bill: a photo first, its number and a note if wanted. */}
        {(order || supplier) && (
          <section className={styles.billBox}>
            <span className={styles.blockTitle}>
              {t('adminPurchasing.receive.billTitle')}
              <InfoTip label={t('adminInventory.tips.label')}>
                {t('adminPurchasing.tips.bill')}
              </InfoTip>
            </span>
            <span className={styles.muted}>{t('adminPurchasing.receive.billHint')}</span>
            <ProofPicker
              id="grn-photo"
              photos={photos.photosOf(PHOTO)}
              onAdd={(files) => photos.add(PHOTO, files.slice(0, 1))}
              onRemove={(photoId) => photos.remove(PHOTO, photoId)}
              label={t('adminPurchasing.receive.photoLabel')}
              max={1}
            />
            <button
              type="button"
              className={styles.moreToggle}
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen(!moreOpen)}
            >
              <Icon name={moreOpen ? 'chevd' : 'chev'} size="xs" />
              {t('adminPurchasing.receive.billMore')}
            </button>
            {moreOpen && (
              <>
                <Input
                  id="grn-invoice"
                  label={t('adminPurchasing.receive.invoice')}
                  optional
                  maxLength={40}
                  value={invoiceNumber}
                  onChange={(event) => setInvoiceNumber(event.target.value)}
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
              </>
            )}
          </section>
        )}
      </div>
    </Dialog>
  );
}
