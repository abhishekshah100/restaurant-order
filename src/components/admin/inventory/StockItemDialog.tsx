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
import { DaysLeft, LevelBar, useStockLine } from './StockTab';
import { useDaysLeft } from './useDaysLeft';
import { InfoTip } from './InfoTip';
import type { StockEntryKind } from './StockEntryDialog';
import { useInventoryText } from './useInventoryText';
import { cx } from '@/lib/cx';
import styles from './Inventory.module.css';
import stock from './Stock.module.css';

/** Changes shown here; the rest are in Reports. */
const RECENT = 10;

/**
 * Settings for this item (managers), folded away: when to warn, how much to order up to, and the
 * price. A price change says first what the stock will then be worth. At the bottom, stop
 * counting it here (asked twice).
 */
function SettingsForm({ item, onStopped }: { item: StockItem; onStopped: () => void }) {
  const t = useContent('common');
  const { branch, region } = useAdminWorkspace();
  const text = useInventoryText();
  const { showToast } = useToast();
  const save = useUpdateStockItem();
  const untrack = useUpdateStockItem();
  const [reorder, setReorder] = useState(quantityText(item.reorderLevel));
  const [par, setPar] = useState(quantityText(item.parLevel));
  const [cost, setCost] = useState(item.cost ? String(item.cost) : '');
  const [stopping, setStopping] = useState(false);
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
  const priceChanges = body.cost !== undefined && item.onHand > 0 && item.value !== undefined;

  return (
    <details className={stock.settings}>
      <summary>{t('adminInventory.item.levels')}</summary>
      <div className={stock.settingsBody}>
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
            hint={t('adminInventory.item.costHint', { unit })}
            inputMode="decimal"
            value={cost}
            error={
              cost.trim() && costValue === null ? t('adminInventory.entry.costError') : undefined
            }
            onChange={(event) => setCost(event.target.value)}
          />
        </div>
        {priceChanges && (
          <p className={stock.priceNote} role="status">
            {t('adminInventory.item.priceChange', {
              quantity: text.quantity(item.onHand, item.unit),
              from: text.value(item.value ?? 0),
              to: text.value(item.onHand * (body.cost ?? 0)),
            })}
          </p>
        )}
        <Button
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
        <div className={stock.stopRow}>
          {stopping ? (
            <>
              <span>{t('adminInventory.item.untrackHint')}</span>
              <Button
                size="sm"
                variant="secondary"
                className={stock.stopButton}
                loading={untrack.isPending}
                onClick={() =>
                  untrack.mutate(
                    {
                      branchId: branch.id,
                      ingredientId: item.ingredientId,
                      body: { tracked: false },
                    },
                    {
                      onSuccess: () => {
                        showToast(t('adminInventory.item.untracked', { name: item.name }), {
                          tone: 'success',
                        });
                        onStopped();
                      },
                      onError: () =>
                        showToast(t('adminInventory.errors.failed'), { tone: 'error' }),
                    },
                  )
                }
              >
                {t('adminInventory.item.untrackConfirm')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setStopping(false)}>
                {t('adminInventory.item.cancel')}
              </Button>
            </>
          ) : (
            <button
              type="button"
              className={`${styles.linkButton} ${styles.danger}`}
              onClick={() => setStopping(true)}
            >
              {t('adminInventory.item.untrack')}
            </button>
          )}
        </div>
      </div>
    </details>
  );
}

/**
 * One item at the branch: how much there is (with its bar and how it stands), what it's worth,
 * the price and the last change; Correct, Record wastage and Order more; its expiry dates and
 * recent changes; and, folded away for managers, its settings.
 */
export function StockItemDialog({
  ingredientId,
  onRecord,
  onOrder,
  onClose,
}: {
  ingredientId: string;
  /** Opens Ready orders. */
  onOrder: () => void;
  /** Opens the adjustment or wastage form for this item. */
  onRecord: (kind: StockEntryKind) => void;
  onClose: () => void;
}) {
  const t = useContent('common');
  const { branch, clock, can } = useAdminWorkspace();
  const text = useInventoryText();
  const stockLine = useStockLine();
  const query = useInventoryItem(branch.id, ingredientId);
  const data = query.data;
  const item = data?.item;
  const state = item ? stockLine(item) : null;
  const { left, perDay } = useDaysLeft();
  const rate = perDay.get(ingredientId) ?? 0;

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={item?.name ?? t('adminInventory.loading')}
    >
      {!data || !item || !state ? (
        <p className={styles.muted} aria-busy={!query.isError}>
          {query.isError ? t('adminInventory.failed') : t('adminInventory.loading')}
        </p>
      ) : (
        <div className={styles.form}>
          <section className={stock.hero} aria-label={t('adminInventory.item.onHand')}>
            <div className={stock.heroTop}>
              <span className={cx(stock.heroAmount, item.onHand < 0 && styles.negative)}>
                {item.openingDue ? '—' : text.quantity(item.onHand, item.unit)}
              </span>
              <span className={cx(stock.line, stock[`line_${state.tone}`])}>
                {item.openingDue ? state.line : t(`adminInventory.status.${item.status}`)}
                {state.date && <span className={stock.date}>{state.date}</span>}
                {!item.openingDue && item.status !== 'out' && (
                  <DaysLeft days={left.get(ingredientId)} />
                )}
              </span>
            </div>
            <LevelBar item={item} />
            <span className={stock.heroLine}>
              {item.reorderLevel > 0
                ? [
                    t('adminInventory.item.warnAt', {
                      quantity: text.quantity(item.reorderLevel, item.unit),
                    }),
                    item.parLevel > 0 &&
                      t('adminInventory.item.orderUpTo', {
                        quantity: text.quantity(item.parLevel, item.unit),
                      }),
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : t('adminInventory.item.noWarn')}
            </span>
            {rate > 0 && (
              <span className={stock.heroLine}>
                {t('adminInventory.item.perDay', {
                  quantity: friendlyRate(rate, item.unit, text.quantity),
                })}
                <InfoTip label={t('adminInventory.tips.label')}>
                  {t('adminInventory.tips.daysLeft')}
                </InfoTip>
              </span>
            )}
          </section>
          <dl className={stock.facts}>
            {item.value !== undefined && (
              <div>
                <dt>{t('adminInventory.item.value')}</dt>
                <dd>{text.value(item.value)}</dd>
              </div>
            )}
            {item.cost !== undefined && item.cost > 0 && (
              <div>
                <dt>{t('adminInventory.item.cost')}</dt>
                <dd>{text.cost(item.cost, item.unit)}</dd>
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
            {can('purchase.manage') && item.status !== 'ok' && (
              <Button iconStart="tag" onClick={onOrder}>
                {t('adminInventory.item.orderMore')}
              </Button>
            )}
          </div>
          {item.expiry && <BatchList ingredientId={item.ingredientId} />}
          <section className={styles.block} aria-labelledby="stock-history">
            <h3 id="stock-history" className={styles.blockTitle}>
              {t('adminInventory.item.history')}
            </h3>
            {data.movements.length === 0 ? (
              <p className={styles.muted}>{t('adminInventory.item.noHistory')}</p>
            ) : (
              <ul className={styles.list}>
                {data.movements.slice(0, RECENT).map((m) => (
                  <li key={m.id}>
                    <MovementRow movement={m} showName={false} />
                  </li>
                ))}
              </ul>
            )}
            {(data.next || data.movements.length > RECENT) && (
              <p className={styles.muted}>{t('adminInventory.item.moreInLedger')}</p>
            )}
          </section>
          {can('inventory.manage') && (
            <SettingsForm key={item.lastMovedAt} item={item} onStopped={onClose} />
          )}
        </div>
      )}
    </Dialog>
  );
}

/**
 * A day's use as people say it: under 1 kg or 1 L in g or ml ("about 54 g"), else to one
 * decimal ("1.2 kg"); counts whole.
 */
function friendlyRate(
  rate: number,
  unit: StockItem['unit'],
  quantity: (n: number, unit: StockItem['unit']) => string,
) {
  if ((unit === 'kg' || unit === 'l') && rate < 1) {
    return quantity(Math.max(1, Math.round(rate * 1000)), unit === 'kg' ? 'g' : 'ml');
  }
  if (unit === 'pc' || unit === 'dozen' || unit === 'g' || unit === 'ml') {
    return quantity(Math.max(1, Math.round(rate)), unit);
  }
  return quantity(Math.round(rate * 10) / 10, unit);
}
