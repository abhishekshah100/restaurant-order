'use client';

import { useState } from 'react';
import { isApiError } from '@/api/client';
import { useContent, useIngredients, useSuppliers } from '@/api/hooks';
import { useArchiveSupplier, useSaveSupplier, useSetSupplierItems } from '@/api/mutations';
import {
  Button,
  Dialog,
  Icon,
  IconButton,
  Input,
  SearchField,
  Select,
  Textarea,
} from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { cx } from '@/lib/cx';
import { parseCost, unitsLike } from '@/lib/inventory';
import type { InventoryUnit } from '@/types/inventory';
import type { Supplier, SupplierInput } from '@/types/purchasing';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { usePurchasingText } from './usePurchasingText';
import styles from './Purchasing.module.css';

interface ItemDraft {
  key: number;
  ingredientId: string;
  measure: string;
  price: string;
  code: string;
  preferred: boolean;
}
let nextKey = 1;

type Pane = 'details' | 'items';

/**
 * A supplier, in two parts: Details (name and phone first; the rest under "More details") and
 * What they sell (searchable; each item's pack, price and whether they're the one to buy it
 * from; "Add from my ingredients" ticks several at once). A new supplier starts with Details and
 * goes on to What they sell once saved. Archive at the bottom of Details.
 */
function SupplierDialog({
  supplier,
  pane: startPane,
  onSaved,
  onClose,
}: {
  supplier?: Supplier;
  pane?: Pane;
  /** A new supplier saved: shown again, at What they sell. */
  onSaved: (saved: Supplier) => void;
  onClose: () => void;
}) {
  const t = useContent('common');
  const { branch, can } = useAdminWorkspace();
  const manage = can('purchase.manage');
  const text = usePurchasingText();
  const { showToast } = useToast();
  const save = useSaveSupplier();
  const setItems = useSetSupplierItems();
  const archive = useArchiveSupplier();
  const ingredients = useIngredients(branch.id).data?.ingredients ?? [];
  const [pane, setPane] = useState<Pane>(supplier ? (startPane ?? 'details') : 'details');
  const [moreDetails, setMoreDetails] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [form, setForm] = useState<SupplierInput>({
    name: supplier?.name ?? '',
    contactName: supplier?.contactName ?? '',
    phone: supplier?.phone ?? '',
    email: supplier?.email ?? '',
    address: supplier?.address ?? '',
    taxId: supplier?.taxId ?? '',
    notes: supplier?.notes ?? '',
    ...(supplier?.paymentTermsDays !== undefined
      ? { paymentTermsDays: supplier.paymentTermsDays }
      : {}),
  });
  const [items, setItemDrafts] = useState<ItemDraft[]>(
    () =>
      supplier?.items.map((i) => ({
        key: nextKey++,
        ingredientId: i.ingredientId,
        measure: '',
        price: i.price !== undefined ? String(i.price) : '',
        code: i.supplierCode ?? '',
        preferred: i.preferred,
      })) ?? [],
  );
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pickSearch, setPickSearch] = useState('');
  const [tried, setTried] = useState(false);

  const field = (key: keyof SupplierInput) => (event: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: event.target.value }));
  const failed = (error: unknown) =>
    showToast(
      isApiError(error, 'name_taken')
        ? t('adminInventory.errors.nameTaken')
        : isApiError(error, 'supplier_in_use')
          ? t('adminPurchasing.errors.supplierInUse')
          : t('adminInventory.errors.failed'),
      { tone: 'error' },
    );
  const body = (): SupplierInput => ({
    name: form.name.trim(),
    ...Object.fromEntries(
      (['contactName', 'phone', 'email', 'address', 'taxId', 'notes'] as const)
        .map((k) => [k, (form[k] ?? '').trim()] as const)
        .filter(([, v]) => v),
    ),
    ...(form.paymentTermsDays !== undefined
      ? { paymentTermsDays: Number(form.paymentTermsDays) }
      : {}),
  });
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const priceBad = (i: ItemDraft) => parseCost(i.price) === null;
  const itemsOk = items.every((i) => i.ingredientId && !priceBad(i));
  const listed = new Set(items.map((i) => i.ingredientId));
  const q = search.trim().toLowerCase();
  const shownItems = items.filter(
    (i) => !q || (byId.get(i.ingredientId)?.name ?? '').toLowerCase().includes(q),
  );
  const pq = pickSearch.trim().toLowerCase();
  const addable = ingredients.filter(
    (i) => !listed.has(i.id) && (!pq || i.name.toLowerCase().includes(pq)),
  );

  const saveDetails = () =>
    save.mutate(
      { branchId: branch.id, ...(supplier ? { id: supplier.id } : {}), body: body() },
      {
        onSuccess: (saved) => {
          showToast(t('adminPurchasing.suppliers.saved', { name: saved.name }), {
            tone: 'success',
          });
          if (!supplier) onSaved(saved);
        },
        onError: failed,
      },
    );

  const saveItems = () => {
    setTried(true);
    if (!supplier || !itemsOk) return;
    setItems.mutate(
      {
        branchId: branch.id,
        id: supplier.id,
        items: items.map((i) => {
          const current = supplier.items.find((c) => c.ingredientId === i.ingredientId);
          const ingredient = byId.get(i.ingredientId);
          // Unchanged pack: send the one it had (as a pack or unit of the ingredient).
          const keep =
            !i.measure && current && ingredient
              ? ingredient.packs.find(
                  (p) => p.name === current.pack.name && p.quantity === current.pack.size,
                )
              : undefined;
          return {
            ingredientId: i.ingredientId,
            ...(i.measure.startsWith('pack:')
              ? { packId: i.measure.slice(5) }
              : i.measure
                ? { unit: i.measure as InventoryUnit }
                : keep
                  ? { packId: keep.id }
                  : current
                    ? { unit: current.pack.unit }
                    : {}),
            price: parseCost(i.price) ?? 0,
            ...(i.code.trim() ? { supplierCode: i.code.trim() } : {}),
            preferred: i.preferred,
          };
        }),
      },
      {
        onSuccess: () => showToast(t('adminPurchasing.suppliers.itemsSaved'), { tone: 'success' }),
        onError: failed,
      },
    );
  };

  const footer = !manage ? undefined : pane === 'details' ? (
    <Button
      block
      iconStart="check"
      disabled={!form.name.trim()}
      loading={save.isPending}
      onClick={saveDetails}
    >
      {supplier ? t('adminPurchasing.suppliers.save') : t('adminPurchasing.suppliers.addNext')}
    </Button>
  ) : adding ? (
    <div className={styles.footButtons}>
      <Button variant="secondary" onClick={() => setAdding(false)}>
        {t('adminPurchasing.returns.cancel')}
      </Button>
      <Button
        iconStart="plus"
        disabled={picked.size === 0}
        onClick={() => {
          setItemDrafts((all) => [
            ...all,
            ...[...picked].map((ingredientId) => ({
              key: nextKey++,
              ingredientId,
              measure: '',
              price: '',
              code: '',
              preferred: true,
            })),
          ]);
          setPicked(new Set());
          setAdding(false);
        }}
      >
        {t.plural('adminPurchasing.suppliers.addPicked', picked.size)}
      </Button>
    </div>
  ) : (
    <Button block iconStart="check" loading={setItems.isPending} onClick={saveItems}>
      {t('adminPurchasing.suppliers.saveItems')}
    </Button>
  );

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      className={styles.orderDialog}
      title={supplier ? supplier.name : t('adminPurchasing.suppliers.newTitle')}
      {...(footer ? { footer } : {})}
    >
      <div className={styles.editor}>
        {supplier && (
          <div
            className={styles.panes}
            role="tablist"
            aria-label={t('adminPurchasing.suppliers.panes')}
          >
            {(['details', 'items'] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={pane === p}
                className={styles.paneTab}
                onClick={() => setPane(p)}
              >
                {t(`adminPurchasing.suppliers.pane.${p}`)}
                {p === 'items' && <span className={styles.viewCount}>{items.length}</span>}
              </button>
            ))}
          </div>
        )}

        {pane === 'details' && (
          <section className={styles.editorBlock}>
            <Input
              id="sup-name"
              label={t('adminPurchasing.suppliers.name')}
              placeholder={t('adminPurchasing.suppliers.namePlaceholder')}
              maxLength={80}
              value={form.name}
              onChange={field('name')}
              disabled={!manage}
            />
            <Input
              id="sup-phone"
              type="tel"
              label={t('adminPurchasing.suppliers.phone')}
              hint={t('adminPurchasing.suppliers.phoneHint')}
              optional
              maxLength={16}
              value={form.phone ?? ''}
              onChange={field('phone')}
              disabled={!manage}
            />
            <Input
              id="sup-contact"
              label={t('adminPurchasing.suppliers.contact')}
              optional
              maxLength={80}
              value={form.contactName ?? ''}
              onChange={field('contactName')}
              disabled={!manage}
            />
            <button
              type="button"
              className={styles.moreToggle}
              aria-expanded={moreDetails}
              onClick={() => setMoreDetails(!moreDetails)}
            >
              <Icon name={moreDetails ? 'chevd' : 'chev'} size="xs" />
              {t('adminPurchasing.suppliers.moreDetails')}
            </button>
            {moreDetails && (
              <>
                <div className={styles.extraRow}>
                  <Input
                    id="sup-email"
                    type="email"
                    label={t('adminPurchasing.suppliers.email')}
                    optional
                    maxLength={254}
                    value={form.email ?? ''}
                    onChange={field('email')}
                    disabled={!manage}
                  />
                  <Input
                    id="sup-tax"
                    label={t('adminPurchasing.suppliers.taxId')}
                    optional
                    maxLength={20}
                    value={form.taxId ?? ''}
                    onChange={field('taxId')}
                    disabled={!manage}
                  />
                  <Input
                    id="sup-terms"
                    label={t('adminPurchasing.suppliers.terms')}
                    optional
                    inputMode="numeric"
                    value={form.paymentTermsDays !== undefined ? String(form.paymentTermsDays) : ''}
                    onChange={(event) => {
                      const value = event.target.value.replace(/\D/g, '');
                      setForm((f) => {
                        const { paymentTermsDays: _, ...rest } = f;
                        return value ? { ...rest, paymentTermsDays: Number(value) } : rest;
                      });
                    }}
                    disabled={!manage}
                  />
                </div>
                <Textarea
                  id="sup-address"
                  label={t('adminPurchasing.suppliers.address')}
                  optional
                  rows={2}
                  maxLength={300}
                  value={form.address ?? ''}
                  onChange={field('address')}
                  disabled={!manage}
                />
                <Textarea
                  id="sup-notes"
                  label={t('adminInventory.entry.note')}
                  optional
                  rows={2}
                  maxLength={300}
                  value={form.notes ?? ''}
                  onChange={field('notes')}
                  disabled={!manage}
                />
              </>
            )}
            {!supplier && <p className={styles.note}>{t('adminPurchasing.suppliers.nextHint')}</p>}
            {supplier && manage && (
              <Button
                variant={confirmArchive ? 'primary' : 'ghost'}
                size="sm"
                iconStart="trash"
                className={styles.addExtra}
                loading={archive.isPending}
                onClick={() =>
                  confirmArchive
                    ? archive.mutate(
                        { branchId: branch.id, id: supplier.id },
                        {
                          onSuccess: () => {
                            showToast(
                              t('adminPurchasing.suppliers.archived', { name: supplier.name }),
                              {
                                tone: 'success',
                              },
                            );
                            onClose();
                          },
                          onError: failed,
                        },
                      )
                    : setConfirmArchive(true)
                }
              >
                {confirmArchive
                  ? t('adminPurchasing.suppliers.confirmArchive')
                  : t('adminPurchasing.suppliers.archive')}
              </Button>
            )}
          </section>
        )}

        {pane === 'items' && supplier && adding && (
          <section className={styles.editorBlock}>
            <span className={styles.blockTitle}>{t('adminPurchasing.suppliers.pickTitle')}</span>
            <SearchField
              value={pickSearch}
              onChange={setPickSearch}
              label={t('adminPurchasing.suppliers.searchIngredients')}
              placeholder={t('adminPurchasing.suppliers.searchIngredients')}
            />
            {addable.length === 0 ? (
              <p className={styles.note}>{t('adminPurchasing.suppliers.nothingToAdd')}</p>
            ) : (
              <ul className={styles.items}>
                {addable.map((i) => {
                  const on = picked.has(i.id);
                  return (
                    <li key={i.id} className={cx(styles.item, on && styles.itemOn)}>
                      <label className={styles.pickRow}>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() =>
                            setPicked((all) => {
                              const next = new Set(all);
                              if (next.has(i.id)) next.delete(i.id);
                              else next.add(i.id);
                              return next;
                            })
                          }
                        />
                        <span className={styles.itemName}>{i.name}</span>
                        <span className={styles.itemMeta}>{text.unit(i.unit)}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {pane === 'items' && supplier && !adding && (
          <section className={styles.editorBlock}>
            <p className={styles.muted}>{t('adminPurchasing.suppliers.itemsHint')}</p>
            {items.length > 6 && (
              <SearchField
                value={search}
                onChange={setSearch}
                label={t('adminPurchasing.orders.searchItems')}
                placeholder={t('adminPurchasing.orders.searchItems')}
              />
            )}
            {items.length === 0 ? (
              <div className={styles.empty}>
                <Icon name="list" size="md" />
                <p>{t('adminPurchasing.suppliers.noItems')}</p>
              </div>
            ) : (
              <ul className={styles.items}>
                {shownItems.map((item) => {
                  const ingredient = byId.get(item.ingredientId);
                  const current = supplier.items.find((i) => i.ingredientId === item.ingredientId);
                  const update = (change: Partial<ItemDraft>) =>
                    setItemDrafts((all) =>
                      all.map((i) => (i.key === item.key ? { ...i, ...change } : i)),
                    );
                  return (
                    <li key={item.key} className={styles.supplierItem}>
                      <span className={styles.supplierItemName}>
                        <button
                          type="button"
                          className={styles.star}
                          aria-pressed={item.preferred}
                          aria-label={t('adminPurchasing.suppliers.preferredFor', {
                            item: ingredient?.name ?? '',
                          })}
                          title={t('adminPurchasing.suppliers.preferred')}
                          disabled={!manage}
                          onClick={() => update({ preferred: !item.preferred })}
                        >
                          <Icon name={item.preferred ? 'starfill' : 'star'} size="sm" />
                        </button>
                        <span className={styles.itemName}>{ingredient?.name ?? '—'}</span>
                      </span>
                      {ingredient && (
                        <Select
                          id={`item-${item.key}-pack`}
                          label={t('adminPurchasing.suppliers.comesIn')}
                          value={item.measure}
                          disabled={!manage}
                          onChange={(event) => update({ measure: event.target.value })}
                        >
                          <option value="">
                            {current ? text.pack(current.pack) : text.unit(ingredient.unit)}
                          </option>
                          {ingredient.packs.map((p) => (
                            <option key={p.id} value={`pack:${p.id}`}>
                              {text.pack({ name: p.name, size: p.quantity, unit: ingredient.unit })}
                            </option>
                          ))}
                          {unitsLike(ingredient.unit)
                            .filter((u) => !(current === undefined && u === ingredient.unit))
                            .map((u) => (
                              <option key={u} value={u}>
                                {text.unit(u)}
                              </option>
                            ))}
                        </Select>
                      )}
                      <Input
                        id={`item-${item.key}-price`}
                        label={t('adminPurchasing.suppliers.price')}
                        inputMode="decimal"
                        value={item.price}
                        disabled={!manage}
                        error={
                          tried && priceBad(item)
                            ? t('adminPurchasing.suppliers.priceError')
                            : undefined
                        }
                        onChange={(event) => update({ price: event.target.value })}
                      />
                      {manage && (
                        <IconButton
                          icon="trash"
                          size="sm"
                          label={t('adminInventory.recipes.removeLine')}
                          onClick={() =>
                            setItemDrafts((all) => all.filter((i) => i.key !== item.key))
                          }
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {manage && (
              <Button
                variant="secondary"
                iconStart="plus"
                className={styles.addExtra}
                onClick={() => setAdding(true)}
              >
                {t('adminPurchasing.suppliers.addFromIngredients')}
              </Button>
            )}
          </section>
        )}
      </div>
    </Dialog>
  );
}

/**
 * Purchasing › Suppliers: each supplier as a card (name, who to ask for, phone with Call and
 * WhatsApp, how many items they sell, open orders) with Order from them; search by name. A card
 * opens the supplier; New supplier adds one.
 */
export function SuppliersTab({ onNewOrder }: { onNewOrder: (supplierId: string) => void }) {
  const t = useContent('common');
  const { branch, can } = useAdminWorkspace();
  const query = useSuppliers(branch.id);
  const [open, setOpen] = useState<{ id: string | 'new'; pane?: Pane; saved?: Supplier } | null>(
    null,
  );
  const [search, setSearch] = useState('');
  if (!query.data) {
    return (
      <p className={styles.muted} aria-busy={!query.isError}>
        {query.isError ? t('adminInventory.failed') : t('adminInventory.loading')}
      </p>
    );
  }
  const { suppliers } = query.data;
  const q = search.trim().toLowerCase();
  const shown = suppliers.filter(
    (s) =>
      !q || s.name.toLowerCase().includes(q) || (s.contactName ?? '').toLowerCase().includes(q),
  );
  // Just saved: the list may not have it yet.
  const current =
    open && open.id !== 'new' ? (suppliers.find((s) => s.id === open.id) ?? open.saved) : undefined;

  return (
    <div className={styles.today}>
      <div className={styles.toolbar}>
        {can('purchase.manage') && (
          <Button iconStart="plus" onClick={() => setOpen({ id: 'new' })}>
            {t('adminPurchasing.suppliers.new')}
          </Button>
        )}
        {suppliers.length > 4 && (
          <SearchField
            value={search}
            onChange={setSearch}
            label={t('adminPurchasing.suppliers.search')}
            placeholder={t('adminPurchasing.suppliers.search')}
            className={styles.search}
          />
        )}
      </div>
      {suppliers.length === 0 ? (
        <div className={styles.empty}>
          <Icon name="store" size="md" />
          <p>{t('adminPurchasing.suppliers.empty')}</p>
        </div>
      ) : (
        <ul className={styles.orderCards}>
          {shown.map((s) => {
            const phone = s.phone?.replace(/[^\d+]/g, '');
            const wa = s.phone?.replace(/\D/g, '');
            return (
              <li key={s.id}>
                <article className={styles.orderCard}>
                  <button
                    type="button"
                    className={styles.orderOpen}
                    onClick={() => setOpen({ id: s.id })}
                  >
                    <span className={styles.orderTop}>
                      <span className={styles.orderSupplier}>{s.name}</span>
                      {s.openOrders > 0 && (
                        <span className={styles.badge} data-tone="info">
                          {t.plural('adminPurchasing.suppliers.openOrders', s.openOrders)}
                        </span>
                      )}
                    </span>
                    <span className={styles.orderMeta}>
                      {[s.contactName, s.phone].filter(Boolean).join(' · ') ||
                        t('adminPurchasing.suppliers.noPhone')}
                    </span>
                    <span
                      className={cx(styles.orderDue, s.items.length === 0 && styles.orderDueLate)}
                    >
                      <Icon name="list" size="xs" />
                      {s.items.length > 0
                        ? t.plural('adminPurchasing.suppliers.itemCount', s.items.length)
                        : t('adminPurchasing.suppliers.noItemsYet')}
                    </span>
                  </button>
                  <div className={styles.orderFoot}>
                    <span className={styles.contactButtons}>
                      {phone && (
                        <Button
                          size="sm"
                          variant="secondary"
                          iconStart="phone"
                          href={`tel:${phone}`}
                        >
                          {t('adminPurchasing.suppliers.call')}
                        </Button>
                      )}
                      {wa && (
                        <Button
                          size="sm"
                          variant="secondary"
                          iconStart="whatsapp"
                          onClick={() => window.open(`https://wa.me/${wa}`, '_blank', 'noopener')}
                        >
                          {t('adminPurchasing.suppliers.whatsApp')}
                        </Button>
                      )}
                    </span>
                    {can('purchase.manage') &&
                      (s.items.length > 0 ? (
                        <Button size="sm" iconStart="plus" onClick={() => onNewOrder(s.id)}>
                          {t('adminPurchasing.suppliers.order')}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          iconStart="plus"
                          onClick={() => setOpen({ id: s.id, pane: 'items' })}
                        >
                          {t('adminPurchasing.suppliers.addItems')}
                        </Button>
                      ))}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
      {open && (
        <SupplierDialog
          key={open.id}
          supplier={current}
          {...(open.pane ? { pane: open.pane } : {})}
          onSaved={(saved) => setOpen({ id: saved.id, pane: 'items', saved })}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
