'use client';

import { useState } from 'react';
import { useContent, useFeatures, useIngredients, useInventoryStock } from '@/api/hooks';
import { Button, Chip, SearchField, Select } from '@/components/ui';
import { useNow } from '@/hooks/useNow';
import { cx } from '@/lib/cx';
import { ADMIN_NAV } from '@/lib/adminNav';
import { filterStock, type StockFilter } from '@/lib/inventory';
import type { StockStatus } from '@/types/inventory';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { ExpiryChip, useDayText } from './BatchList';
import type { StockEntryKind } from './StockEntryDialog';
import { useInventoryText } from './useInventoryText';
import styles from './Inventory.module.css';

/** "Low", "Out" or "In stock", coloured. */
export function StatusChip({ status }: { status: StockStatus }) {
  const t = useContent('common');
  return (
    <span className={cx(styles.chip, styles[status])}>{t(`adminInventory.status.${status}`)}</span>
  );
}

const FILTERS: readonly StockFilter[] = ['all', 'low', 'out', 'ok'];
/** Where low stock is ordered (Purchasing › Orders: "Suggest from low stock"). */
const PURCHASING_PATH =
  ADMIN_NAV.find((item) => item.id === 'purchasing')?.href ?? '/admin/dashboard/';
/** How long after inventory is switched on the Stock tab asks for a count. */
const RECENT_MS = 14 * 24 * 3_600_000;
type TileId = 'tracked' | 'low' | 'out' | 'value' | 'wastedToday' | 'expiring' | 'expired';

/**
 * The branch's stock: what it's worth, what's low or out and what was wasted today (costs for
 * managers), the ways to record changes, and every tracked item, found by name, status or
 * category. An item opens its own page (levels, cost, ledger).
 */
export function StockTab({
  onOpen,
  onRecord,
  onProduce,
}: {
  onOpen: (ingredientId: string) => void;
  onRecord: (kind: StockEntryKind, ingredientIds?: string[]) => void;
  /** Opens "Make a batch" (shown when the branch tracks a prepared item). */
  onProduce: () => void;
}) {
  const t = useContent('common');
  const { branch, can, clock } = useAdminWorkspace();
  const text = useInventoryText();
  const day = useDayText();
  const query = useInventoryStock(branch.id);
  const features = useFeatures(branch.id).data;
  const now = useNow();
  const ingredients = useIngredients(branch.id).data;
  const categories = ingredients?.categories ?? [];
  const makesBatches = ingredients?.ingredients.some((i) => i.prep && i.tracked) ?? false;
  const [status, setStatus] = useState<StockFilter>('all');
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');

  if (query.isError) {
    return (
      <div className={styles.card}>
        <p>{t('adminInventory.failed')}</p>
        <Button variant="secondary" onClick={() => void query.refetch()}>
          {t('adminInventory.retry')}
        </Button>
      </div>
    );
  }
  if (!query.data) {
    return (
      <p className={styles.muted} aria-busy="true">
        {t('adminInventory.loading')}
      </p>
    );
  }

  const { items, summary } = query.data;
  // Switched back on lately: stock didn't move while it was off.
  const since = features?.changedAt;
  const recentlyOn =
    since !== undefined && now !== null && now.getTime() - new Date(since).getTime() < RECENT_MS;
  const openingDue = items.filter((i) => i.openingDue).map((i) => i.ingredientId);
  const shown = filterStock(items, { status, category, query: search });
  const nameOf = new Map(categories.map((c) => [c.id, c.name]));
  const tiles: { id: TileId; value: string; tone?: string | false }[] = [
    { id: 'tracked', value: String(summary.tracked) },
    { id: 'low', value: String(summary.low), tone: summary.low > 0 && styles.tileLow },
    { id: 'out', value: String(summary.out), tone: summary.out > 0 && styles.tileOut },
    ...(summary.value !== undefined
      ? [{ id: 'value' as const, value: text.value(summary.value) }]
      : []),
    ...(summary.wastedToday !== undefined
      ? [{ id: 'wastedToday' as const, value: text.value(summary.wastedToday) }]
      : []),
    ...(summary.expiring > 0
      ? [{ id: 'expiring' as const, value: String(summary.expiring), tone: styles.tileLow }]
      : []),
    ...(summary.expired > 0
      ? [
          {
            id: 'expired' as const,
            value:
              summary.expiredValue !== undefined
                ? [String(summary.expired), text.value(summary.expiredValue)].join(' · ')
                : String(summary.expired),
            tone: styles.tileOut,
          },
        ]
      : []),
  ];

  return (
    <>
      {recentlyOn && (
        <p className={cx(styles.card, styles.low)} role="status">
          {t('adminInventory.stock.switchedOn', { time: clock.dateTime(since) })}
        </p>
      )}
      <ul className={styles.tiles} aria-label={t('adminInventory.summary.label')}>
        {tiles.map((tile) => (
          <li key={tile.id} className={cx(styles.tile, tile.tone)}>
            <span className={styles.muted}>{t(`adminInventory.summary.${tile.id}`)}</span>
            <span className={styles.tileValue}>{tile.value}</span>
          </li>
        ))}
      </ul>

      <div className={styles.actions}>
        {can('inventory.manage') && openingDue.length > 0 && (
          <Button iconStart="plus" onClick={() => onRecord('opening', openingDue)}>
            {t.plural('adminInventory.actions.opening', openingDue.length)}
          </Button>
        )}
        {can('inventory.manage') && makesBatches && (
          <Button variant="secondary" iconStart="chef" onClick={onProduce}>
            {t('adminInventory.production.title')}
          </Button>
        )}
        {can('purchase.manage') && summary.low + summary.out > 0 && (
          <Button variant="secondary" iconStart="tag" href={PURCHASING_PATH}>
            {t('adminInventory.actions.orderLow')}
          </Button>
        )}
        {can('inventory.adjust') && (
          <Button variant="secondary" iconStart="sliders" onClick={() => onRecord('adjustment')}>
            {t('adminInventory.actions.adjust')}
          </Button>
        )}
        {can('inventory.wastage') && (
          <Button variant="secondary" iconStart="trash" onClick={() => onRecord('wastage')}>
            {t('adminInventory.actions.waste')}
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <div className={styles.card}>
          <p>{t('adminInventory.stock.empty')}</p>
          <p className={styles.muted}>{t('adminInventory.stock.emptyHint')}</p>
        </div>
      ) : (
        <section className={styles.block} aria-label={t('adminInventory.stock.label')}>
          <div className={styles.filters}>
            <SearchField
              value={search}
              onChange={setSearch}
              label={t('adminInventory.stock.search')}
              placeholder={t('adminInventory.stock.searchPlaceholder')}
            />
            {categories.length > 0 && (
              <Select
                id="stock-category"
                label={t('adminInventory.stock.category')}
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="all">{t('adminInventory.stock.allCategories')}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value="none">{t('adminInventory.stock.noCategory')}</option>
              </Select>
            )}
          </div>
          <div className={styles.chips} role="group" aria-label={t('adminInventory.stock.filter')}>
            {FILTERS.map((f) => (
              <Chip key={f} pressed={status === f} onClick={() => setStatus(f)}>
                {t(`adminInventory.filters.${f}`)}
              </Chip>
            ))}
          </div>
          {shown.length === 0 ? (
            <p className={styles.muted}>{t('adminInventory.stock.noMatch')}</p>
          ) : (
            <ul className={styles.list}>
              {shown.map((item) => (
                <li key={item.ingredientId}>
                  <button
                    type="button"
                    className={styles.row}
                    onClick={() => onOpen(item.ingredientId)}
                  >
                    <span className={styles.rowMain}>
                      <span className={styles.rowName}>{item.name}</span>
                      <span className={styles.muted}>
                        {[
                          item.categoryId ? nameOf.get(item.categoryId) : null,
                          item.reorderLevel > 0
                            ? t('adminInventory.stock.reorderAt', {
                                quantity: text.quantity(item.reorderLevel, item.unit),
                              })
                            : null,
                          item.openingDue ? t('adminInventory.stock.openingDue') : null,
                          item.expiry?.next
                            ? t('adminInventory.expiry.next', { date: day(item.expiry.next) })
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    <span className={styles.rowSide}>
                      <span className={cx(styles.quantity, item.onHand < 0 && styles.negative)}>
                        {text.quantity(item.onHand, item.unit)}
                      </span>
                      <span className={styles.actions}>
                        {item.status !== 'ok' && <StatusChip status={item.status} />}
                        {item.expiry && item.expiry.expired > 0 ? (
                          <ExpiryChip state="expired" />
                        ) : item.expiry && item.expiry.expiring > 0 ? (
                          <ExpiryChip state="expiring" />
                        ) : null}
                        {item.value !== undefined && (
                          <span className={styles.muted}>{text.value(item.value)}</span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
