'use client';

import { useState } from 'react';
import { useContent, useInventoryItem } from '@/api/hooks';
import { useUpdateStockItem } from '@/api/mutations';
import { Button, Dialog, Input } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { parseCost, parseQuantity, quantityText } from '@/lib/inventory';
import type { StockItem, UpdateStockRequest } from '@/types/inventory';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { BatchList } from './BatchList';
import { MovementRow } from './MovementRow';
import { StatusChip } from './StockTab';
import type { StockEntryKind } from './StockEntryDialog';
import { useInventoryText } from './useInventoryText';
import styles from './Inventory.module.css';

/** Its reorder and par levels and its cost (managers), saved together. */
function LevelsForm({ item }: { item: StockItem }) {
  const t = useContent('common');
  const { branch, region } = useAdminWorkspace();
  const text = useInventoryText();
  const { showToast } = useToast();
  const save = useUpdateStockItem();
  const [reorder, setReorder] = useState(quantityText(item.reorderLevel));
  const [par, setPar] = useState(quantityText(item.parLevel));
  const [cost, setCost] = useState(item.cost ? String(item.cost) : '');
  const reorderValue = reorder.trim() ? parseQuantity(reorder) : 0;
  const parValue = par.trim() ? parseQuantity(par) : 0;
  const costValue = cost.trim() ? parseCost(cost) : null;
  const body: UpdateStockRequest = {
    ...(reorderValue !== null && reorderValue !== item.reorderLevel
      ? { reorderLevel: reorderValue }
      : {}),
    ...(parValue !== null && parValue !== item.parLevel ? { parLevel: parValue } : {}),
    ...(costValue !== null && costValue !== item.cost ? { cost: costValue } : {}),
  };
  const invalid = reorderValue === null || parValue === null || (cost.trim() && costValue === null);
  const unit = text.unit(item.unit);

  return (
    <section className={styles.block} aria-labelledby="stock-levels">
      <h3 id="stock-levels" className={styles.blockTitle}>
        {t('adminInventory.item.levels')}
      </h3>
      <div className={styles.fieldRow}>
        <Input
          id="stock-reorder"
          label={t('adminInventory.item.reorderLevel', { unit })}
          hint={t('adminInventory.item.reorderHint')}
          inputMode="decimal"
          value={reorder}
          error={reorderValue === null ? t('adminInventory.entry.quantityError') : undefined}
          onChange={(event) => setReorder(event.target.value)}
        />
        <Input
          id="stock-par"
          label={t('adminInventory.item.parLevel', { unit })}
          hint={t('adminInventory.item.parHint')}
          inputMode="decimal"
          value={par}
          error={parValue === null ? t('adminInventory.entry.quantityError') : undefined}
          onChange={(event) => setPar(event.target.value)}
        />
        <Input
          id="stock-cost"
          label={t('adminInventory.entry.cost', { symbol: region.currency.symbol, unit })}
          hint={t('adminInventory.item.costHint')}
          inputMode="decimal"
          value={cost}
          error={
            cost.trim() && costValue === null ? t('adminInventory.entry.costError') : undefined
          }
          onChange={(event) => setCost(event.target.value)}
        />
      </div>
      <Button
        variant="secondary"
        iconStart="check"
        disabled={Boolean(invalid) || Object.keys(body).length === 0}
        loading={save.isPending}
        onClick={() =>
          save.mutate(
            { branchId: branch.id, ingredientId: item.ingredientId, body },
            {
              onSuccess: () => showToast(t('adminInventory.item.saved'), { tone: 'success' }),
              onError: () => showToast(t('adminInventory.errors.failed'), { tone: 'error' }),
            },
          )
        }
      >
        {t('adminInventory.item.save')}
      </Button>
    </section>
  );
}

/**
 * One item at the branch: what's there and what it's worth, its levels and cost (managers), the
 * ways to adjust it or record waste, and its ledger, newest first.
 */
export function StockItemDialog({
  ingredientId,
  onRecord,
  onClose,
}: {
  ingredientId: string;
  /** Opens the adjustment or wastage form for this item. */
  onRecord: (kind: StockEntryKind) => void;
  onClose: () => void;
}) {
  const t = useContent('common');
  const { branch, clock, can } = useAdminWorkspace();
  const text = useInventoryText();
  const { showToast } = useToast();
  const query = useInventoryItem(branch.id, ingredientId);
  const untrack = useUpdateStockItem();
  const data = query.data;
  const item = data?.item;

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={item?.name ?? t('adminInventory.loading')}
    >
      {!data || !item ? (
        <p className={styles.muted} aria-busy={!query.isError}>
          {query.isError ? t('adminInventory.failed') : t('adminInventory.loading')}
        </p>
      ) : (
        <div className={styles.form}>
          <dl className={styles.facts}>
            <div>
              <dt>{t('adminInventory.item.onHand')}</dt>
              <dd className={item.onHand < 0 ? styles.negative : undefined}>
                {text.quantity(item.onHand, item.unit)}
              </dd>
            </div>
            <div>
              <dt>{t('adminInventory.item.status')}</dt>
              <dd>
                <StatusChip status={item.status} />
              </dd>
            </div>
            {item.cost !== undefined && (
              <div>
                <dt>{t('adminInventory.item.cost')}</dt>
                <dd>{text.cost(item.cost, item.unit)}</dd>
              </div>
            )}
            {item.value !== undefined && (
              <div>
                <dt>{t('adminInventory.item.value')}</dt>
                <dd>{text.value(item.value)}</dd>
              </div>
            )}
            {item.lastMovedAt && (
              <div>
                <dt>{t('adminInventory.item.lastMoved')}</dt>
                <dd>{clock.dateTime(item.lastMovedAt)}</dd>
              </div>
            )}
          </dl>
          <div className={styles.actions}>
            {can('inventory.adjust') && (
              <Button
                variant="secondary"
                iconStart="sliders"
                onClick={() => onRecord('adjustment')}
              >
                {t('adminInventory.actions.adjust')}
              </Button>
            )}
            {can('inventory.wastage') && (
              <Button variant="secondary" iconStart="trash" onClick={() => onRecord('wastage')}>
                {t('adminInventory.actions.waste')}
              </Button>
            )}
          </div>
          {can('inventory.manage') && <LevelsForm key={item.lastMovedAt} item={item} />}
          {item.expiry && <BatchList ingredientId={item.ingredientId} />}
          <section className={styles.block} aria-labelledby="stock-history">
            <h3 id="stock-history" className={styles.blockTitle}>
              {t('adminInventory.item.history')}
            </h3>
            {data.movements.length === 0 ? (
              <p className={styles.muted}>{t('adminInventory.item.noHistory')}</p>
            ) : (
              <ul className={styles.list}>
                {data.movements.map((m) => (
                  <li key={m.id}>
                    <MovementRow movement={m} showName={false} />
                  </li>
                ))}
              </ul>
            )}
            {data.next && <p className={styles.muted}>{t('adminInventory.item.moreInLedger')}</p>}
          </section>
          {can('inventory.manage') && (
            <button
              type="button"
              className={`${styles.linkButton} ${styles.danger}`}
              disabled={untrack.isPending}
              onClick={() =>
                untrack.mutate(
                  { branchId: branch.id, ingredientId, body: { tracked: false } },
                  {
                    onSuccess: () => {
                      showToast(t('adminInventory.item.untracked', { name: item.name }), {
                        tone: 'success',
                      });
                      onClose();
                    },
                    onError: () => showToast(t('adminInventory.errors.failed'), { tone: 'error' }),
                  },
                )
              }
            >
              {t('adminInventory.item.untrack')}
            </button>
          )}
        </div>
      )}
    </Dialog>
  );
}
