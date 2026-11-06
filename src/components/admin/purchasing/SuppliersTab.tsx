'use client';

import { useState } from 'react';
import { isApiError } from '@/api/client';
import { useContent, useIngredients, useSuppliers } from '@/api/hooks';
import { useArchiveSupplier, useSaveSupplier, useSetSupplierItems } from '@/api/mutations';
import { Button, Dialog, IconButton, Input, Select, Textarea } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { parseCost, unitsLike } from '@/lib/inventory';
import type { InventoryUnit } from '@/types/inventory';
import type { Supplier, SupplierInput } from '@/types/purchasing';
import styles from '../inventory/Inventory.module.css';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { usePurchasingText } from './usePurchasingText';

interface ItemDraft {
  key: number;
  ingredientId: string;
  measure: string;
  price: string;
  code: string;
  preferred: boolean;
}
let nextKey = 1;

/** A supplier's details and what it sells (each saved on its own), or a new supplier. */
function SupplierDialog({ supplier, onClose }: { supplier?: Supplier; onClose: () => void }) {
  const t = useContent('common');
  const { branch, can } = useAdminWorkspace();
  const manage = can('purchase.manage');
  const text = usePurchasingText();
  const { showToast } = useToast();
  const save = useSaveSupplier();
  const setItems = useSetSupplierItems();
  const archive = useArchiveSupplier();
  const ingredients = useIngredients(branch.id).data?.ingredients ?? [];
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
  const itemsOk = items.every((i) => i.ingredientId && parseCost(i.price) !== null);
  const byId = new Map(ingredients.map((i) => [i.id, i]));

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={supplier ? supplier.name : t('adminPurchasing.suppliers.newTitle')}
    >
      <div className={styles.form}>
        <div className={styles.fieldRow}>
          <Input
            id="sup-name"
            label={t('adminPurchasing.suppliers.name')}
            maxLength={80}
            value={form.name}
            onChange={field('name')}
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
        {manage && (
          <Button
            iconStart="check"
            disabled={!form.name.trim()}
            loading={save.isPending}
            onClick={() =>
              save.mutate(
                { branchId: branch.id, ...(supplier ? { id: supplier.id } : {}), body: body() },
                {
                  onSuccess: (saved) => {
                    showToast(t('adminPurchasing.suppliers.saved', { name: saved.name }), {
                      tone: 'success',
                    });
                    if (!supplier) onClose();
                  },
                  onError: failed,
                },
              )
            }
          >
            {supplier ? t('adminPurchasing.suppliers.save') : t('adminPurchasing.suppliers.add')}
          </Button>
        )}

        {supplier && (
          <section className={styles.block} aria-labelledby="sup-items">
            <h3 id="sup-items" className={styles.blockTitle}>
              {t('adminPurchasing.suppliers.items')}
            </h3>
            <p className={styles.muted}>{t('adminPurchasing.suppliers.itemsHint')}</p>
            {items.map((item) => {
              const ingredient = byId.get(item.ingredientId);
              const current = supplier.items.find((i) => i.ingredientId === item.ingredientId);
              const update = (change: Partial<ItemDraft>) =>
                setItemDrafts((all) =>
                  all.map((i) => (i.key === item.key ? { ...i, ...change } : i)),
                );
              return (
                <div key={item.key} className={styles.line}>
                  <div className={styles.ingredientLine}>
                    <Select
                      id={`item-${item.key}-ingredient`}
                      label={t('adminInventory.entry.ingredient')}
                      value={item.ingredientId}
                      disabled={!manage}
                      onChange={(event) =>
                        update({ ingredientId: event.target.value, measure: '' })
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
                    {ingredient ? (
                      <Select
                        id={`item-${item.key}-pack`}
                        label={t('adminPurchasing.orders.pack')}
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
                        {unitsLike(ingredient.unit).map((u) => (
                          <option key={u} value={u}>
                            {text.unit(u)}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <span />
                    )}
                    <Input
                      id={`item-${item.key}-price`}
                      label={t('adminPurchasing.orders.price')}
                      inputMode="decimal"
                      value={item.price}
                      disabled={!manage}
                      onChange={(event) => update({ price: event.target.value })}
                    />
                    {manage && (
                      <IconButton
                        icon="trash"
                        label={t('adminInventory.recipes.removeLine')}
                        onClick={() =>
                          setItemDrafts((all) => all.filter((i) => i.key !== item.key))
                        }
                      />
                    )}
                  </div>
                  <label className={styles.actions}>
                    <input
                      type="checkbox"
                      checked={item.preferred}
                      disabled={!manage}
                      onChange={(event) => update({ preferred: event.target.checked })}
                    />
                    <span>{t('adminPurchasing.suppliers.preferred')}</span>
                  </label>
                </div>
              );
            })}
            {manage && (
              <>
                <Button
                  variant="ghost"
                  iconStart="plus"
                  onClick={() =>
                    setItemDrafts((all) => [
                      ...all,
                      {
                        key: nextKey++,
                        ingredientId: '',
                        measure: '',
                        price: '',
                        code: '',
                        preferred: false,
                      },
                    ])
                  }
                >
                  {t('adminInventory.recipes.addLine')}
                </Button>
                <Button
                  variant="secondary"
                  iconStart="check"
                  disabled={!itemsOk}
                  loading={setItems.isPending}
                  onClick={() =>
                    setItems.mutate(
                      {
                        branchId: branch.id,
                        id: supplier.id,
                        items: items.map((i) => {
                          const current = supplier.items.find(
                            (c) => c.ingredientId === i.ingredientId,
                          );
                          const ingredient = byId.get(i.ingredientId);
                          // Unchanged pack: send the one it had (as a pack or unit of the ingredient).
                          const keep =
                            !i.measure && current && ingredient
                              ? ingredient.packs.find(
                                  (p) =>
                                    p.name === current.pack.name &&
                                    p.quantity === current.pack.size,
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
                        onSuccess: () =>
                          showToast(t('adminPurchasing.suppliers.itemsSaved'), { tone: 'success' }),
                        onError: failed,
                      },
                    )
                  }
                >
                  {t('adminPurchasing.suppliers.saveItems')}
                </Button>
              </>
            )}
          </section>
        )}
        {supplier && manage && (
          <Button
            variant="ghost"
            iconStart="trash"
            loading={archive.isPending}
            onClick={() =>
              archive.mutate(
                { branchId: branch.id, id: supplier.id },
                {
                  onSuccess: () => {
                    showToast(t('adminPurchasing.suppliers.archived', { name: supplier.name }), {
                      tone: 'success',
                    });
                    onClose();
                  },
                  onError: failed,
                },
              )
            }
          >
            {t('adminPurchasing.suppliers.archive')}
          </Button>
        )}
      </div>
    </Dialog>
  );
}

/** The branch's suppliers: who they are, what they sell, their open orders. */
export function SuppliersTab() {
  const t = useContent('common');
  const { branch, can } = useAdminWorkspace();
  const query = useSuppliers(branch.id);
  const [open, setOpen] = useState<Supplier | 'new' | null>(null);
  if (!query.data) {
    return (
      <p className={styles.muted} aria-busy={!query.isError}>
        {query.isError ? t('adminInventory.failed') : t('adminInventory.loading')}
      </p>
    );
  }
  const { suppliers } = query.data;
  return (
    <>
      {can('purchase.manage') && (
        <div className={styles.actions}>
          <Button iconStart="plus" onClick={() => setOpen('new')}>
            {t('adminPurchasing.suppliers.new')}
          </Button>
        </div>
      )}
      {suppliers.length === 0 ? (
        <div className={styles.card}>
          <p>{t('adminPurchasing.suppliers.empty')}</p>
        </div>
      ) : (
        <ul className={styles.list}>
          {suppliers.map((s) => (
            <li key={s.id}>
              <button type="button" className={styles.row} onClick={() => setOpen(s)}>
                <span className={styles.rowMain}>
                  <span className={styles.rowName}>{s.name}</span>
                  <span className={styles.muted}>
                    {[
                      s.contactName,
                      s.phone,
                      t.plural('adminPurchasing.suppliers.itemCount', s.items.length),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                {s.openOrders > 0 && (
                  <span className={styles.muted}>
                    {t.plural('adminPurchasing.suppliers.openOrders', s.openOrders)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <SupplierDialog
          key={open === 'new' ? 'new' : open.id}
          supplier={open === 'new' ? undefined : (suppliers.find((s) => s.id === open.id) ?? open)}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
