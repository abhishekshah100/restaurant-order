'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { isApiError } from '@/api/client';
import { useContent, useIngredients, useInventoryStock, useSuppliers } from '@/api/hooks';
import { useSavePurchaseOrder } from '@/api/mutations';
import { Button, Icon, IconButton, Input, SearchField, Select, Textarea } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { INVENTORY_READERS } from '@/lib/adminNav';
import { cx } from '@/lib/cx';
import { parseCost, parseQuantity, quantityText, unitsLike } from '@/lib/inventory';
import { editableLines, lowSuggestions } from '@/lib/purchasingFlow';
import type { InventoryUnit } from '@/types/inventory';
import type { OrderLineInput, PurchaseOrder, SupplierItemView } from '@/types/purchasing';
import { InfoTip } from '../inventory/InfoTip';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { Qty } from './Qty';
import { useSendOrder } from './useSendOrder';
import { docNumber, usePurchasingText } from './usePurchasingText';
import styles from './Purchasing.module.css';

/** Something not on the supplier's list, added by hand. */
interface Extra {
  key: number;
  ingredientId: string;
  /** "pack:<id>", a unit code, or "" (the ingredient's unit). */
  measure: string;
  quantity: string;
  price: string;
}
let nextKey = 1;

const ISO_DAY = (d: Date) => d.toISOString().slice(0, 10);

/**
 * A new order, or one not sent yet changed. Pick the supplier; their items are listed (search
 * them) with what's in stock, the pack, the last price and, for what's low, how many to order
 * ("Fill what's low" fills them all). Anything else is added by hand. When it's due (Today,
 * Tomorrow or a date), a note, and under More options the tax and prices. A running total;
 * Save, or Save and send on WhatsApp (sent at once when no approval is needed).
 */
export function OrderEditor({
  order,
  supplierId: chosenSupplier,
  onDone,
  frame,
}: {
  order?: PurchaseOrder;
  /** A new order from a supplier's card: that supplier, chosen already. */
  supplierId?: string;
  onDone: () => void;
  /** Puts the form, and its total and buttons, in the dialog (they stay in its footer). */
  frame: (body: ReactNode, footer?: ReactNode) => ReactNode;
}) {
  const t = useContent('common');
  const { branch, can, clock } = useAdminWorkspace();
  const text = usePurchasingText();
  const { showToast } = useToast();
  const save = useSavePurchaseOrder();
  const { send } = useSendOrder();
  const seesStock = can(...INVENTORY_READERS);
  const suppliers = useSuppliers(branch.id).data?.suppliers;
  const ingredientsQuery = useIngredients(branch.id);
  const ingredients = ingredientsQuery.data?.ingredients ?? [];
  const stock = useInventoryStock(branch.id, seesStock).data?.items;
  const [supplierId, setSupplierId] = useState(order?.supplier.id ?? chosenSupplier ?? '');
  const supplier = suppliers?.find((s) => s.id === supplierId);
  const catalog = useMemo(() => supplier?.items ?? [], [supplier]);
  const inCatalog = new Set(catalog.map((i) => i.ingredientId));
  const [expectedOn, setExpectedOn] = useState(order?.expectedOn ?? '');
  const [note, setNote] = useState(order?.note ?? '');
  // An order being changed fills these in once its supplier and ingredients are read (below).
  const [qty, setQty] = useState<Record<string, string>>({});
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [extras, setExtras] = useState<Extra[]>([]);
  const [tax, setTax] = useState(() => {
    const rate = order?.lines.find((l) => l.taxRate > 0)?.taxRate;
    return rate ? String(rate) : '';
  });
  const [more, setMore] = useState(Boolean(tax));
  const [search, setSearch] = useState('');
  const [tried, setTried] = useState(false);

  // An order being changed, item by item in the pack it was ordered in: the supplier's usual
  // pack on their list, any other as an item by hand (lib/purchasingFlow › editableLines). Once.
  const [seeded, setSeeded] = useState(!order);
  if (!seeded && order && suppliers && ingredientsQuery.data) {
    setSeeded(true);
    const { listed, extras: byHand } = editableLines(
      order.lines,
      suppliers.find((s) => s.id === order.supplier.id)?.items ?? [],
      ingredients,
    );
    setQty(Object.fromEntries(listed.map((l) => [l.ingredientId, quantityText(l.quantity)])));
    setPrices(
      Object.fromEntries(
        listed.flatMap((l) => (l.price !== undefined ? [[l.ingredientId, String(l.price)]] : [])),
      ),
    );
    setExtras(
      byHand.map((e) => ({
        key: nextKey++,
        ingredientId: e.ingredientId,
        measure: e.measure,
        quantity: quantityText(e.quantity),
        price: e.price !== undefined ? String(e.price) : '',
      })),
    );
  }

  const suggested = useMemo(
    () => (stock ? lowSuggestions(catalog, stock) : new Map<string, number>()),
    [catalog, stock],
  );
  const levels = new Map(stock?.map((s) => [s.ingredientId, s]));
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const q = search.trim().toLowerCase();
  // What's low first, then by name.
  const rows = [...catalog]
    .filter((i) => !q || i.name.toLowerCase().includes(q))
    .sort(
      (a, b) =>
        Number(suggested.has(b.ingredientId)) - Number(suggested.has(a.ingredientId)) ||
        a.name.localeCompare(b.name),
    );

  const priceOf = (item: SupplierItemView) => {
    const typed = prices[item.ingredientId];
    return typed?.trim() ? parseCost(typed) : (item.price ?? null);
  };
  const chosen = catalog.filter((i) => (parseQuantity(qty[i.ingredientId] ?? '') ?? 0) > 0);
  const extraProblems = extras.map((e) => {
    if (!e.ingredientId) return 'ingredient';
    const n = parseQuantity(e.quantity);
    if (n === null || n <= 0) return 'quantity';
    if (e.price.trim() && parseCost(e.price) === null) return 'price';
    return null;
  });
  const taxRate = tax.trim() ? parseCost(tax) : 0;
  const taxBad = taxRate === null || (taxRate ?? 0) > 100;
  const subtotal =
    chosen.reduce(
      (sum, i) => sum + (parseQuantity(qty[i.ingredientId] ?? '') ?? 0) * (priceOf(i) ?? 0),
      0,
    ) +
    extras.reduce(
      (sum, e) => sum + (parseQuantity(e.quantity) ?? 0) * (parseCost(e.price) ?? 0),
      0,
    );
  const lineCount = chosen.length + extras.length;
  const ready =
    Boolean(supplierId) && lineCount > 0 && extraProblems.every((p) => p === null) && !taxBad;
  const phone = supplier?.phone?.replace(/\D/g, '');

  const fillLow = () =>
    setQty((all) => {
      const next = { ...all };
      for (const [id, packs] of suggested) next[id] = quantityText(packs);
      return next;
    });

  const submit = (sendNow: boolean) => {
    setTried(true);
    if (!ready) return;
    // Opened from the tap, so the browser lets it open; pointed at WhatsApp once saved.
    const win = sendNow && phone ? window.open('about:blank', '_blank') : null;
    const rate = taxRate && taxRate > 0 ? { taxRate } : {};
    const body = {
      supplierId,
      ...(expectedOn ? { expectedOn } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
      lines: [
        ...chosen.map<OrderLineInput>((i) => ({
          ingredientId: i.ingredientId,
          quantity: parseQuantity(qty[i.ingredientId] ?? '') ?? 0,
          ...(prices[i.ingredientId]?.trim()
            ? { price: parseCost(prices[i.ingredientId] ?? '') ?? 0 }
            : {}),
          ...rate,
        })),
        ...extras.map<OrderLineInput>((e) => ({
          ingredientId: e.ingredientId,
          ...(e.measure.startsWith('pack:')
            ? { packId: e.measure.slice(5) }
            : e.measure
              ? { unit: e.measure as InventoryUnit }
              : {}),
          quantity: parseQuantity(e.quantity) ?? 0,
          ...(e.price.trim() ? { price: parseCost(e.price) ?? 0 } : {}),
          ...rate,
        })),
      ],
    };
    save.mutate(
      { branchId: branch.id, ...(order ? { id: order.id } : {}), body },
      {
        onSuccess: (saved) => {
          if (sendNow && saved.status === 'approved') {
            send(saved, 'whatsApp', win);
          } else {
            win?.close();
            showToast(
              saved.status === 'draft'
                ? t('adminPurchasing.orders.savedForApproval', {
                    number: docNumber('PO', saved.number),
                  })
                : t('adminPurchasing.orders.saved', { number: docNumber('PO', saved.number) }),
              { tone: 'success' },
            );
          }
          onDone();
        },
        onError: (error) => {
          win?.close();
          showToast(
            isApiError(error, 'po_not_editable')
              ? t('adminPurchasing.errors.notEditable')
              : t('adminInventory.errors.failed'),
            { tone: 'error' },
          );
        },
      },
    );
  };

  if (!suppliers || !seeded) {
    return frame(
      <p className={styles.muted} aria-busy="true">
        {t('adminInventory.loading')}
      </p>,
    );
  }
  if (suppliers.length === 0) {
    return frame(
      <div className={styles.empty}>
        <Icon name="store" size="md" />
        <p>{t('adminPurchasing.orders.noSuppliers')}</p>
      </div>,
    );
  }

  const today = clock.dayKey(new Date());
  const tomorrow = ISO_DAY(new Date(Date.parse(`${today}T12:00:00Z`) + 86_400_000));

  const footer = supplier ? (
    <div className={styles.editorFoot}>
      <p className={styles.runningTotal}>
        <span>{t.plural('adminPurchasing.orders.lineCount', lineCount)}</span>
        <strong>
          {subtotal > 0
            ? t('adminPurchasing.orders.estimate', {
                total: text.money(subtotal * (1 + (taxRate ?? 0) / 100)),
              })
            : '—'}
        </strong>
      </p>
      <div className={styles.footButtons}>
        <Button
          variant={phone && can('purchase.manage') ? 'secondary' : 'primary'}
          iconStart="check"
          loading={save.isPending}
          onClick={() => submit(false)}
        >
          {order ? t('adminPurchasing.orders.save') : t('adminPurchasing.orders.saveOnly')}
        </Button>
        {phone && (
          <Button iconStart="whatsapp" loading={save.isPending} onClick={() => submit(true)}>
            {t('adminPurchasing.orders.saveAndSend')}
          </Button>
        )}
      </div>
    </div>
  ) : undefined;

  return frame(
    <div className={styles.editor}>
      <section className={styles.editorBlock}>
        <Select
          id="po-supplier"
          label={t('adminPurchasing.orders.supplierQuestion')}
          value={supplierId}
          disabled={Boolean(order)}
          error={tried && !supplierId ? t('adminPurchasing.orders.pickSupplier') : undefined}
          onChange={(event) => {
            setSupplierId(event.target.value);
            setQty({});
            setPrices({});
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
      </section>

      {supplier && (
        <section className={styles.editorBlock} aria-labelledby="po-items">
          <div className={styles.blockHead}>
            <h3 id="po-items" className={styles.blockTitle}>
              {t('adminPurchasing.orders.whatToOrder')}
              <InfoTip label={t('adminInventory.tips.label')}>
                {t('adminPurchasing.tips.suggested')}
              </InfoTip>
            </h3>
            {suggested.size > 0 && (
              <Button size="sm" variant="secondary" iconStart="sparkle" onClick={fillLow}>
                {t.plural('adminPurchasing.orders.fillLow', suggested.size)}
              </Button>
            )}
          </div>
          {catalog.length === 0 ? (
            <p className={styles.note}>
              <Icon name="info" size="xs" />
              {t('adminPurchasing.orders.noCatalog')}
            </p>
          ) : (
            <>
              {catalog.length > 6 && (
                <SearchField
                  value={search}
                  onChange={setSearch}
                  label={t('adminPurchasing.orders.searchItems')}
                  placeholder={t('adminPurchasing.orders.searchItems')}
                />
              )}
              <ul className={styles.items}>
                {rows.map((item) => {
                  const level = levels.get(item.ingredientId);
                  const want = suggested.get(item.ingredientId);
                  const price = priceOf(item);
                  const n = parseQuantity(qty[item.ingredientId] ?? '') ?? 0;
                  return (
                    <li key={item.ingredientId} className={cx(styles.item, n > 0 && styles.itemOn)}>
                      <span className={styles.itemText}>
                        <span className={styles.itemName}>
                          {item.name}
                          {want !== undefined && (
                            <span className={styles.lowBadge}>
                              {t('adminPurchasing.orders.low')}
                            </span>
                          )}
                        </span>
                        <span className={styles.itemMeta}>
                          {[
                            !(item.pack.size === 1 && item.pack.name === item.pack.unit) &&
                              text.pack(item.pack),
                            price !== null && text.perPack(price, item.pack),
                            level &&
                              t('adminPurchasing.orders.inStock', {
                                quantity: text.quantity(level.onHand, level.unit),
                              }),
                            want !== undefined &&
                              t('adminPurchasing.orders.suggest', { count: want }),
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                        {more && (
                          <Input
                            id={`po-price-${item.ingredientId}`}
                            label={t('adminPurchasing.orders.price')}
                            inputMode="decimal"
                            className={styles.itemPrice}
                            value={
                              prices[item.ingredientId] ??
                              (item.price !== undefined ? String(item.price) : '')
                            }
                            onChange={(e) =>
                              setPrices((all) => ({ ...all, [item.ingredientId]: e.target.value }))
                            }
                          />
                        )}
                      </span>
                      <Qty
                        id={`po-qty-${item.ingredientId}`}
                        label={t('adminPurchasing.orders.qtyLabel', { item: item.name })}
                        less={t('adminPurchasing.orders.less', { item: item.name })}
                        more={t('adminPurchasing.orders.moreOf', { item: item.name })}
                        value={qty[item.ingredientId] ?? ''}
                        onChange={(v) => setQty((all) => ({ ...all, [item.ingredientId]: v }))}
                      />
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {extras.map((extra, index) => {
            const ingredient = byId.get(extra.ingredientId);
            const problem = tried ? extraProblems[index] : null;
            const update = (change: Partial<Extra>) =>
              setExtras((all) => all.map((e) => (e.key === extra.key ? { ...e, ...change } : e)));
            return (
              <fieldset key={extra.key} className={styles.extra}>
                <div className={styles.blockHead}>
                  <legend className={styles.extraTitle}>
                    {t('adminPurchasing.orders.extraTitle')}
                  </legend>
                  <IconButton
                    icon="trash"
                    size="sm"
                    label={t('adminInventory.entry.removeLine')}
                    onClick={() => setExtras((all) => all.filter((e) => e.key !== extra.key))}
                  />
                </div>
                <Select
                  id={`po-x-${extra.key}`}
                  label={t('adminInventory.entry.ingredient')}
                  value={extra.ingredientId}
                  error={problem === 'ingredient' ? t('adminInventory.entry.pick') : undefined}
                  onChange={(e) => update({ ingredientId: e.target.value, measure: '' })}
                >
                  <option value="" disabled>
                    {t('adminInventory.entry.pickPlaceholder')}
                  </option>
                  {ingredients
                    .filter((i) => !inCatalog.has(i.id) || i.id === extra.ingredientId)
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                </Select>
                <div className={styles.extraRow}>
                  <Input
                    id={`po-x-${extra.key}-q`}
                    label={t('adminPurchasing.orders.packs')}
                    inputMode="decimal"
                    value={extra.quantity}
                    error={
                      problem === 'quantity' ? t('adminInventory.entry.quantityError') : undefined
                    }
                    onChange={(e) => update({ quantity: e.target.value })}
                  />
                  {ingredient && (
                    <Select
                      id={`po-x-${extra.key}-m`}
                      label={t('adminPurchasing.orders.pack')}
                      value={extra.measure}
                      onChange={(e) => update({ measure: e.target.value })}
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
                  <Input
                    id={`po-x-${extra.key}-p`}
                    label={t('adminPurchasing.orders.price')}
                    optional
                    inputMode="decimal"
                    value={extra.price}
                    error={problem === 'price' ? t('adminInventory.entry.costError') : undefined}
                    onChange={(e) => update({ price: e.target.value })}
                  />
                </div>
              </fieldset>
            );
          })}
          <Button
            variant="ghost"
            size="sm"
            iconStart="plus"
            className={styles.addExtra}
            onClick={() =>
              setExtras((all) => [
                ...all,
                { key: nextKey++, ingredientId: '', measure: '', quantity: '', price: '' },
              ])
            }
          >
            {t('adminPurchasing.orders.addExtra')}
          </Button>
          {tried && lineCount === 0 && (
            <p className={styles.error} role="alert">
              {t('adminPurchasing.orders.nothingChosen')}
            </p>
          )}
        </section>
      )}

      {supplier && (
        <section className={styles.editorBlock}>
          <span className={styles.blockTitle}>{t('adminPurchasing.orders.whenQuestion')}</span>
          <div className={styles.dayChips}>
            {(
              [
                { key: 'today', day: today },
                { key: 'tomorrow', day: tomorrow },
              ] as const
            ).map(({ key, day }) => (
              <button
                key={key}
                type="button"
                className={styles.dayChip}
                aria-pressed={expectedOn === day}
                onClick={() => setExpectedOn(expectedOn === day ? '' : day)}
              >
                {t(`adminPurchasing.orders.days.${key}`)}
              </button>
            ))}
            <Input
              id="po-expected"
              type="date"
              label={t('adminPurchasing.orders.days.pick')}
              hideLabel
              className={styles.dayPick}
              value={expectedOn}
              onChange={(event) => setExpectedOn(event.target.value)}
            />
          </div>
          <Textarea
            id="po-note"
            label={t('adminPurchasing.orders.noteLabel')}
            optional
            rows={2}
            maxLength={300}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <button
            type="button"
            className={styles.moreToggle}
            aria-expanded={more}
            onClick={() => setMore(!more)}
          >
            <Icon name={more ? 'chevd' : 'chev'} size="xs" />
            {t('adminPurchasing.orders.moreOptions')}
          </button>
          {more && (
            <Input
              id="po-tax"
              label={t('adminPurchasing.orders.taxAll')}
              hint={t('adminPurchasing.orders.taxAllHint')}
              optional
              inputMode="decimal"
              value={tax}
              error={taxBad ? t('adminPurchasing.orders.taxError') : undefined}
              onChange={(e) => setTax(e.target.value)}
            />
          )}
        </section>
      )}
    </div>,
    footer,
  );
}
