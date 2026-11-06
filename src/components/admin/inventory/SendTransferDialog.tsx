'use client';

import { useMemo, useState } from 'react';
import { ApiError, isApiError } from '@/api/client';
import { useContent, useIngredients, useInventoryStock } from '@/api/hooks';
import { useSendTransfer } from '@/api/mutations';
import { Button, Dialog, IconButton, Input, Select, Textarea } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { newEntryId, parseQuantity, unitsLike } from '@/lib/inventory';
import type { InventoryUnit } from '@/types/inventory';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { useInventoryText } from './useInventoryText';
import styles from './Inventory.module.css';

interface Draft {
  key: number;
  ingredientId: string;
  quantity: string;
  /** A unit code, or "pack:<id>". */
  measure: string;
}

let nextKey = 1;
const blank = (): Draft => ({ key: nextKey++, ingredientId: '', quantity: '', measure: '' });

/**
 * Sending stock to another of the restaurant's branches: it leaves here now, at what it cost
 * here, and that branch receives it. Sent with an entry id, so a retry never sends it twice.
 */
export function SendTransferDialog({
  branches,
  onClose,
}: {
  branches: { id: string; name: string }[];
  onClose: () => void;
}) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const text = useInventoryText();
  const { showToast } = useToast();
  const ingredients = useIngredients(branch.id).data;
  const stock = useInventoryStock(branch.id).data;
  const send = useSendTransfer();
  const [entryId] = useState(newEntryId);
  const [to, setTo] = useState(branches.length === 1 ? (branches[0]?.id ?? '') : '');
  const [lines, setLines] = useState<Draft[]>(() => [blank()]);
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);

  const byId = useMemo(
    () => new Map((ingredients?.ingredients ?? []).map((i) => [i.id, i])),
    [ingredients],
  );
  const onHand = useMemo(
    () => new Map((stock?.items ?? []).map((i) => [i.ingredientId, i])),
    [stock],
  );
  const choices = (ingredients?.ingredients ?? []).filter((i) => i.tracked);
  const picked = new Set(lines.map((l) => l.ingredientId).filter(Boolean));
  const problemOf = (l: Draft) => {
    if (!l.ingredientId) return 'ingredient';
    const n = parseQuantity(l.quantity);
    return n === null || n <= 0 ? 'quantity' : null;
  };
  const problems = lines.map(problemOf);
  const update = (key: number, change: Partial<Draft>) =>
    setLines((all) => all.map((l) => (l.key === key ? { ...l, ...change } : l)));

  const submit = () => {
    setTried(true);
    if (!to || problems.some(Boolean)) return;
    send.mutate(
      {
        branchId: branch.id,
        body: {
          entryId,
          toBranchId: to,
          ...(note.trim() ? { note: note.trim() } : {}),
          lines: lines.map((l) => {
            const unit = byId.get(l.ingredientId)?.unit;
            return {
              ingredientId: l.ingredientId,
              quantity: parseQuantity(l.quantity) ?? 0,
              ...(l.measure.startsWith('pack:')
                ? { packId: l.measure.slice(5) }
                : l.measure && l.measure !== unit
                  ? { unit: l.measure as InventoryUnit }
                  : {}),
            };
          }),
        },
      },
      {
        onSuccess: () => {
          showToast(t('adminInventory.transfers.done.send'), { tone: 'success' });
          onClose();
        },
        onError: (error) => {
          const names = error instanceof ApiError ? error.body?.ingredients : undefined;
          showToast(
            isApiError(error, 'not_tracked')
              ? t('adminInventory.errors.notTracked', { names: names?.join(', ') ?? '' })
              : t('adminInventory.errors.failed'),
            { tone: 'error' },
          );
        },
      },
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminInventory.transfers.send')}
      description={t('adminInventory.transfers.sendBody')}
      footer={
        <Button block iconStart="swap" loading={send.isPending} onClick={submit}>
          {t.plural('adminInventory.transfers.sendConfirm', lines.length)}
        </Button>
      }
    >
      <div className={styles.form}>
        <Select
          id="transfer-to"
          label={t('adminInventory.transfers.toBranch')}
          value={to}
          error={tried && !to ? t('adminInventory.entry.pick') : undefined}
          onChange={(event) => setTo(event.target.value)}
        >
          <option value="" disabled>
            {t('adminInventory.entry.pickPlaceholder')}
          </option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
        {lines.map((line, index) => {
          const ingredient = byId.get(line.ingredientId);
          const item = onHand.get(line.ingredientId);
          const problem = tried ? problems[index] : null;
          const id = `transfer-${line.key}`;
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
                id={`${id}-ingredient`}
                label={t('adminInventory.entry.ingredient')}
                value={line.ingredientId}
                error={problem === 'ingredient' ? t('adminInventory.entry.pick') : undefined}
                onChange={(event) =>
                  update(line.key, { ingredientId: event.target.value, measure: '' })
                }
              >
                <option value="" disabled>
                  {t('adminInventory.entry.pickPlaceholder')}
                </option>
                {choices
                  .filter((c) => c.id === line.ingredientId || !picked.has(c.id))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </Select>
              {item && (
                <p className={styles.muted}>
                  {t('adminInventory.entry.onHand', {
                    quantity: text.quantity(item.onHand, item.unit),
                  })}
                </p>
              )}
              <div className={styles.fieldRow}>
                <Input
                  id={`${id}-quantity`}
                  label={t('adminInventory.entry.quantity')}
                  inputMode="decimal"
                  autoComplete="off"
                  value={line.quantity}
                  error={
                    problem === 'quantity' ? t('adminInventory.entry.quantityError') : undefined
                  }
                  onChange={(event) => update(line.key, { quantity: event.target.value })}
                />
                {ingredient && (
                  <Select
                    id={`${id}-measure`}
                    label={t('adminInventory.entry.in')}
                    value={line.measure || ingredient.unit}
                    onChange={(event) => update(line.key, { measure: event.target.value })}
                  >
                    {unitsLike(ingredient.unit).map((u) => (
                      <option key={u} value={u}>
                        {text.unit(u)}
                      </option>
                    ))}
                    {ingredient.packs.map((p) => (
                      <option key={p.id} value={`pack:${p.id}`}>
                        {t('adminInventory.packOption', {
                          name: p.name,
                          quantity: text.quantity(p.quantity, ingredient.unit),
                        })}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
            </fieldset>
          );
        })}
        {ingredients && lines.length < choices.length && (
          <Button
            variant="secondary"
            iconStart="plus"
            onClick={() => setLines((all) => [...all, blank()])}
          >
            {t('adminInventory.entry.addLine')}
          </Button>
        )}
        <Textarea
          id="transfer-note"
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
