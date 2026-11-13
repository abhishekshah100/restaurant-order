'use client';

import { useState } from 'react';
import { ApiError, isApiError } from '@/api/client';
import { useContent } from '@/api/hooks';
import {
  useArchiveIngredient,
  useCreateIngredient,
  useUpdateIngredient,
  useUpdateStockItem,
} from '@/api/mutations';
import { Button, Dialog, IconButton, Input, Select } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { UNIT_CODES, parseQuantity, quantityText, unitsLike } from '@/lib/inventory';
import type { Ingredient, IngredientCategory, InventoryUnit } from '@/types/inventory';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { useInventoryText } from './useInventoryText';
import styles from './Inventory.module.css';
import stock from './Stock.module.css';

interface InputDraft {
  key: number;
  ingredientId: string;
  quantity: string;
  unit: InventoryUnit | '';
}

interface PackDraft {
  key: number;
  name: string;
  quantity: string;
}

let nextKey = 1;

/**
 * A new ingredient, or one to change, for every branch of the restaurant: its name, the unit it's
 * kept in, its category and code, and the packs it comes in. A new one is tracked here at once
 * (with a reorder level); an existing one can be tracked here, or archived.
 */
export function IngredientDialog({
  ingredient,
  categories,
  ingredients,
  onClose,
}: {
  /** None: a new ingredient. */
  ingredient?: Ingredient;
  categories: readonly IngredientCategory[];
  /** The restaurant's ingredients (a batch recipe uses bought ones). */
  ingredients: readonly Ingredient[];
  onClose: () => void;
}) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const text = useInventoryText();
  const { showToast } = useToast();
  const create = useCreateIngredient();
  const update = useUpdateIngredient();
  const archive = useArchiveIngredient();
  const track = useUpdateStockItem();
  const [name, setName] = useState(ingredient?.name ?? '');
  const [unit, setUnit] = useState<InventoryUnit>(ingredient?.unit ?? 'kg');
  const [categoryId, setCategoryId] = useState(ingredient?.categoryId ?? '');
  const [sku, setSku] = useState(ingredient?.sku ?? '');
  const [reorder, setReorder] = useState('');
  const [packs, setPacks] = useState<PackDraft[]>(
    () =>
      ingredient?.packs.map((p) => ({
        key: nextKey++,
        name: p.name,
        quantity: quantityText(p.quantity),
      })) ?? [],
  );
  const [tried, setTried] = useState(false);
  const [taken, setTaken] = useState(false);
  // Made here in batches: how much a batch makes, and what it uses.
  const [prepOn, setPrepOn] = useState(Boolean(ingredient?.prep));
  const [expiryOn, setExpiryOn] = useState(Boolean(ingredient?.expiry));
  const [shelfLife, setShelfLife] = useState(String(ingredient?.expiry?.shelfLifeDays ?? ''));
  const [warnDays, setWarnDays] = useState(String(ingredient?.expiry?.warnDays ?? 2));
  const [batch, setBatch] = useState(quantityText(ingredient?.prep?.batchQuantity ?? 0));
  const [inputs, setInputs] = useState<InputDraft[]>(
    () =>
      ingredient?.prep?.lines.map((l) => ({
        key: nextKey++,
        ingredientId: l.ingredientId,
        quantity: quantityText(l.quantity),
        unit: l.unit,
      })) ?? [],
  );
  const raw = ingredients.filter((i) => !i.prep && i.id !== ingredient?.id);
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const batchValue = parseQuantity(batch);
  const inputRows = inputs.map((l) => ({ ...l, value: parseQuantity(l.quantity) }));
  const prepOk =
    !prepOn ||
    (batchValue !== null &&
      batchValue > 0 &&
      inputRows.length > 0 &&
      inputRows.every((l) => l.ingredientId && l.value !== null && l.value > 0) &&
      new Set(inputRows.map((l) => l.ingredientId)).size === inputRows.length);

  const packRows = packs.map((p) => ({ name: p.name.trim(), quantity: parseQuantity(p.quantity) }));
  const packsOk = packRows.every((p) => p.name && p.quantity !== null && p.quantity > 0);
  const reorderValue = reorder.trim() ? parseQuantity(reorder) : 0;
  const days = (text: string, min: number, max: number) => {
    const n = Number(text.trim());
    return Number.isInteger(n) && n >= min && n <= max ? n : null;
  };
  const shelfValue = shelfLife.trim() ? days(shelfLife, 1, 3650) : undefined;
  const warnValue = days(warnDays, 0, 60);
  const expiryOk = !expiryOn || (shelfValue !== null && warnValue !== null);
  const ready = name.trim().length > 0 && packsOk && reorderValue !== null && prepOk && expiryOk;
  const prep = prepOn
    ? {
        batchQuantity: batchValue ?? 0,
        lines: inputRows.map((l) => ({
          ingredientId: l.ingredientId,
          quantity: l.value ?? 0,
          ...(l.unit ? { unit: l.unit } : {}),
        })),
      }
    : null;

  const failed = (error: unknown) => {
    if (isApiError(error, 'name_taken')) {
      setTaken(true);
      return;
    }
    showToast(
      isApiError(error, 'ingredient_in_use')
        ? error instanceof ApiError && error.body?.branches
          ? t('adminInventory.errors.held', { branches: error.body.branches.join(', ') })
          : t('adminInventory.errors.measure')
        : t('adminInventory.errors.failed'),
      { tone: 'error' },
    );
  };

  const submit = () => {
    setTried(true);
    if (!ready) return;
    const body = {
      name: name.trim(),
      unit,
      categoryId: categoryId || null,
      packs: packRows.map((p) => ({ name: p.name, quantity: p.quantity ?? 0 })),
      ...(prepOn || ingredient?.prep ? { prep } : {}),
    };
    const expiry = expiryOn
      ? { shelfLifeDays: shelfValue ?? null, warnDays: warnValue ?? 2 }
      : null;
    if (ingredient) {
      update.mutate(
        {
          branchId: branch.id,
          id: ingredient.id,
          body: {
            ...body,
            sku: sku.trim() || null,
            // Switching it off stops batches; untouched, nothing is sent.
            ...(expiry || ingredient.expiry ? { expiry } : {}),
          },
        },
        {
          onSuccess: () => {
            showToast(t('adminInventory.ingredients.saved', { name: body.name }), {
              tone: 'success',
            });
            onClose();
          },
          onError: failed,
        },
      );
    } else {
      create.mutate(
        {
          branchId: branch.id,
          body: {
            ...body,
            ...(sku.trim() ? { sku: sku.trim() } : {}),
            ...(reorderValue ? { reorderLevel: reorderValue } : {}),
            ...(expiry ? { expiry } : {}),
          },
        },
        {
          onSuccess: () => {
            showToast(t('adminInventory.ingredients.added', { name: body.name }), {
              tone: 'success',
            });
            onClose();
          },
          onError: failed,
        },
      );
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={
        ingredient
          ? t('adminInventory.ingredients.editTitle', { name: ingredient.name })
          : t('adminInventory.ingredients.newTitle')
      }
      description={t('adminInventory.ingredients.shared')}
      footer={
        <Button
          block
          iconStart="check"
          loading={create.isPending || update.isPending}
          onClick={submit}
        >
          {ingredient ? t('adminInventory.ingredients.save') : t('adminInventory.ingredients.add')}
        </Button>
      }
    >
      <div className={styles.form}>
        <Input
          id="ingredient-name"
          label={t('adminInventory.ingredients.name')}
          placeholder={t('adminInventory.ingredients.namePlaceholder')}
          maxLength={80}
          value={name}
          error={
            taken
              ? t('adminInventory.errors.nameTaken')
              : tried && !name.trim()
                ? t('adminInventory.ingredients.nameRequired')
                : undefined
          }
          onChange={(event) => {
            setName(event.target.value);
            setTaken(false);
          }}
        />
        <div className={styles.fieldRow}>
          <Select
            id="ingredient-unit"
            label={t('adminInventory.ingredients.unit')}
            hint={t('adminInventory.ingredients.unitHint')}
            value={unit}
            onChange={(event) => setUnit(event.target.value as InventoryUnit)}
          >
            {UNIT_CODES.map((u) => (
              <option key={u} value={u}>
                {t(`adminInventory.unitNames.${u}`)}
              </option>
            ))}
          </Select>
          <Select
            id="ingredient-category"
            label={t('adminInventory.ingredients.category')}
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">{t('adminInventory.stock.noCategory')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Input
            id="ingredient-sku"
            label={t('adminInventory.ingredients.sku')}
            optional
            maxLength={40}
            value={sku}
            onChange={(event) => setSku(event.target.value)}
          />
        </div>
        {!ingredient && (
          <Input
            id="ingredient-reorder"
            label={t('adminInventory.item.reorderLevel', { unit: text.unit(unit) })}
            hint={t('adminInventory.item.reorderHint')}
            optional
            inputMode="decimal"
            value={reorder}
            error={reorderValue === null ? t('adminInventory.entry.quantityError') : undefined}
            onChange={(event) => setReorder(event.target.value)}
          />
        )}

        {/* Packs, expiry dates and made here: most ingredients need none, so they're folded. */}
        <details
          className={stock.settings}
          open={
            Boolean(ingredient?.prep || ingredient?.expiry) || (ingredient?.packs.length ?? 0) > 0
          }
        >
          <summary>{t('adminInventory.ingredients.more')}</summary>
          <div className={stock.settingsBody}>
            <section className={styles.block} aria-labelledby="ingredient-packs">
              <h3 id="ingredient-packs" className={styles.blockTitle}>
                {t('adminInventory.ingredients.packs')}
              </h3>
              <p className={styles.muted}>{t('adminInventory.ingredients.packsHint')}</p>
              {packs.map((pack, index) => {
                const row = packRows[index];
                return (
                  <div key={pack.key} className={styles.ingredientLine}>
                    <Input
                      id={`pack-${pack.key}-name`}
                      label={t('adminInventory.ingredients.packName')}
                      placeholder={t('adminInventory.ingredients.packNamePlaceholder')}
                      maxLength={30}
                      value={pack.name}
                      error={
                        tried && !row?.name
                          ? t('adminInventory.ingredients.nameRequired')
                          : undefined
                      }
                      onChange={(event) =>
                        setPacks((all) =>
                          all.map((p) =>
                            p.key === pack.key ? { ...p, name: event.target.value } : p,
                          ),
                        )
                      }
                    />
                    <Input
                      id={`pack-${pack.key}-quantity`}
                      label={t('adminInventory.ingredients.packHolds', { unit: text.unit(unit) })}
                      inputMode="decimal"
                      value={pack.quantity}
                      error={
                        tried && !(row?.quantity && row.quantity > 0)
                          ? t('adminInventory.entry.quantityError')
                          : undefined
                      }
                      onChange={(event) =>
                        setPacks((all) =>
                          all.map((p) =>
                            p.key === pack.key ? { ...p, quantity: event.target.value } : p,
                          ),
                        )
                      }
                    />
                    <IconButton
                      icon="trash"
                      label={t('adminInventory.ingredients.removePack')}
                      onClick={() => setPacks((all) => all.filter((p) => p.key !== pack.key))}
                    />
                  </div>
                );
              })}
              {packs.length < 10 && (
                <Button
                  variant="ghost"
                  iconStart="plus"
                  onClick={() =>
                    setPacks((all) => [...all, { key: nextKey++, name: '', quantity: '' }])
                  }
                >
                  {t('adminInventory.ingredients.addPack')}
                </Button>
              )}
            </section>

            <section className={styles.block} aria-labelledby="ingredient-expiry">
              <h3 id="ingredient-expiry" className={styles.blockTitle}>
                {t('adminInventory.expiry.title')}
              </h3>
              <label className={styles.actions}>
                <input
                  type="checkbox"
                  checked={expiryOn}
                  onChange={(event) => setExpiryOn(event.target.checked)}
                />
                <span>{t('adminInventory.expiry.toggle')}</span>
              </label>
              <p className={styles.muted}>
                {expiryOn && !ingredient?.expiry && ingredient
                  ? t('adminInventory.expiry.startHint')
                  : t('adminInventory.expiry.hint')}
              </p>
              {expiryOn && (
                <div className={styles.fieldRow}>
                  <Input
                    id="expiry-shelf-life"
                    label={t('adminInventory.expiry.shelfLife')}
                    hint={t('adminInventory.expiry.shelfLifeHint')}
                    inputMode="numeric"
                    autoComplete="off"
                    value={shelfLife}
                    error={
                      tried && shelfValue === null
                        ? t('adminInventory.expiry.shelfLifeError')
                        : undefined
                    }
                    onChange={(event) => setShelfLife(event.target.value)}
                  />
                  <Input
                    id="expiry-warn"
                    label={t('adminInventory.expiry.warnDays')}
                    inputMode="numeric"
                    autoComplete="off"
                    value={warnDays}
                    error={
                      tried && warnValue === null ? t('adminInventory.expiry.warnError') : undefined
                    }
                    onChange={(event) => setWarnDays(event.target.value)}
                  />
                </div>
              )}
            </section>

            <section className={styles.block} aria-labelledby="ingredient-prep">
              <h3 id="ingredient-prep" className={styles.blockTitle}>
                {t('adminInventory.prep.title')}
              </h3>
              <label className={styles.actions}>
                <input
                  type="checkbox"
                  checked={prepOn}
                  onChange={(event) => setPrepOn(event.target.checked)}
                />
                <span>{t('adminInventory.prep.toggle')}</span>
              </label>
              <p className={styles.muted}>{t('adminInventory.prep.hint')}</p>
              {prepOn && (
                <>
                  <Input
                    id="prep-batch"
                    label={t('adminInventory.prep.batch', { unit: text.unit(unit) })}
                    inputMode="decimal"
                    value={batch}
                    error={
                      tried && !(batchValue && batchValue > 0)
                        ? t('adminInventory.entry.quantityError')
                        : undefined
                    }
                    onChange={(event) => setBatch(event.target.value)}
                  />
                  {inputs.map((input, index) => {
                    const row = inputRows[index];
                    const chosen = byId.get(input.ingredientId);
                    return (
                      <div key={input.key} className={styles.ingredientLine}>
                        <Select
                          id={`prep-${input.key}-ingredient`}
                          label={t('adminInventory.entry.ingredient')}
                          value={input.ingredientId}
                          error={
                            tried && !input.ingredientId
                              ? t('adminInventory.entry.pick')
                              : undefined
                          }
                          onChange={(event) =>
                            setInputs((all) =>
                              all.map((l) =>
                                l.key === input.key
                                  ? { ...l, ingredientId: event.target.value, unit: '' }
                                  : l,
                              ),
                            )
                          }
                        >
                          <option value="" disabled>
                            {t('adminInventory.entry.pickPlaceholder')}
                          </option>
                          {raw.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name}
                            </option>
                          ))}
                        </Select>
                        <Input
                          id={`prep-${input.key}-quantity`}
                          label={t('adminInventory.prep.perBatch')}
                          inputMode="decimal"
                          value={input.quantity}
                          error={
                            tried && !(row?.value && row.value > 0)
                              ? t('adminInventory.entry.quantityError')
                              : undefined
                          }
                          onChange={(event) =>
                            setInputs((all) =>
                              all.map((l) =>
                                l.key === input.key ? { ...l, quantity: event.target.value } : l,
                              ),
                            )
                          }
                        />
                        {chosen && (
                          <Select
                            id={`prep-${input.key}-unit`}
                            label={t('adminInventory.entry.in')}
                            value={input.unit || chosen.unit}
                            onChange={(event) =>
                              setInputs((all) =>
                                all.map((l) =>
                                  l.key === input.key
                                    ? { ...l, unit: event.target.value as InventoryUnit }
                                    : l,
                                ),
                              )
                            }
                          >
                            {unitsLike(chosen.unit).map((u) => (
                              <option key={u} value={u}>
                                {text.unit(u)}
                              </option>
                            ))}
                          </Select>
                        )}
                        <IconButton
                          icon="trash"
                          label={t('adminInventory.recipes.removeLine')}
                          onClick={() => setInputs((all) => all.filter((l) => l.key !== input.key))}
                        />
                      </div>
                    );
                  })}
                  <Button
                    variant="ghost"
                    iconStart="plus"
                    onClick={() =>
                      setInputs((all) => [
                        ...all,
                        { key: nextKey++, ingredientId: '', quantity: '', unit: '' },
                      ])
                    }
                  >
                    {t('adminInventory.recipes.addLine')}
                  </Button>
                </>
              )}
            </section>
          </div>
        </details>
        {ingredient && (
          <div className={styles.actions}>
            {!ingredient.tracked && (
              <Button
                variant="secondary"
                iconStart="plus"
                loading={track.isPending}
                onClick={() =>
                  track.mutate(
                    { branchId: branch.id, ingredientId: ingredient.id, body: { tracked: true } },
                    {
                      onSuccess: () => {
                        showToast(
                          t('adminInventory.ingredients.nowTracked', { name: ingredient.name }),
                          {
                            tone: 'success',
                          },
                        );
                        onClose();
                      },
                      onError: failed,
                    },
                  )
                }
              >
                {t('adminInventory.ingredients.track')}
              </Button>
            )}
            <Button
              variant="ghost"
              iconStart="trash"
              loading={archive.isPending}
              onClick={() =>
                archive.mutate(
                  { branchId: branch.id, id: ingredient.id },
                  {
                    onSuccess: () => {
                      showToast(
                        t('adminInventory.ingredients.archived', { name: ingredient.name }),
                        {
                          tone: 'success',
                        },
                      );
                      onClose();
                    },
                    onError: failed,
                  },
                )
              }
            >
              {t('adminInventory.ingredients.archive')}
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
