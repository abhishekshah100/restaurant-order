'use client';

import { useState } from 'react';
import { useContent, useFeatures, useIngredients, useInventoryStock } from '@/api/hooks';
import { Button, Chip, SearchField } from '@/components/ui';
import { useNow } from '@/hooks/useNow';
import { cx } from '@/lib/cx';
import { filterStock, type StockFilter } from '@/lib/inventory';
import { fullness } from '@/lib/inventorySetup';
import { runningOutSoon, SHOW_DAYS, SOON_DAYS } from '@/lib/inventoryPlanning';
import type { StockItem, StockStatus } from '@/types/inventory';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { useDayText } from './BatchList';
import type { StockEntryKind } from './StockEntryDialog';
import { useCountSheet } from './CountSheet';
import { useDaysLeft } from './useDaysLeft';
import { useInventoryText } from './useInventoryText';
import styles from './Inventory.module.css';
import stock from './Stock.module.css';

/** "Low", "Out" or "In stock", coloured. */
export function StatusChip({ status }: { status: StockStatus }) {
  const t = useContent('common');
  return (
    <span className={cx(styles.chip, styles[status])}>{t(`adminInventory.status.${status}`)}</span>
  );
}

const FILTERS: readonly StockFilter[] = ['all', 'out', 'low', 'soon', 'expiring', 'ok'];
/** How long after inventory is switched on the Stock tab asks for a count. */
const RECENT_MS = 14 * 24 * 3_600_000;
type TileId = 'tracked' | 'low' | 'out' | 'value';

/**
 * The branch's stock: what it's worth, what's low or out and what was wasted today (costs for
 * managers), the ways to record changes, and every tracked item, found by name, status or
 * category. An item opens its own page (levels, cost, ledger).
 */
export function StockTab({
  onOpen,
  onRecord,
  onProduce,
  onOrder,
  initialStatus = 'all',
}: {
  /** Opens Ready orders (what's low, as draft orders per supplier). */
  onOrder: () => void;
  /** Opened from Today: showing only what's out, low or near its date. */
  initialStatus?: StockFilter;
  onOpen: (ingredientId: string) => void;
  onRecord: (kind: StockEntryKind, ingredientIds?: string[]) => void;
  /** Opens "Make a batch" (shown when the branch tracks a prepared item). */
  onProduce: () => void;
}) {
  const t = useContent('common');
  const { branch, can, clock } = useAdminWorkspace();
  const text = useInventoryText();
  const query = useInventoryStock(branch.id);
  const features = useFeatures(branch.id).data;
  const now = useNow();
  const ingredients = useIngredients(branch.id).data;
  const categories = ingredients?.categories ?? [];
  const makesBatches = ingredients?.ingredients.some((i) => i.prep && i.tracked) ?? false;
  const [status, setStatus] = useState<StockFilter>(initialStatus);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const { left } = useDaysLeft();
  const sheet = useCountSheet();

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
  // Switched on lately, and some stock is from before and hasn't moved since: it may be stale.
  const since = features?.changedAt;
  const recentlyOn =
    since !== undefined &&
    now !== null &&
    now.getTime() - new Date(since).getTime() < RECENT_MS &&
    items.some((i) => i.lastMovedAt !== undefined && Date.parse(i.lastMovedAt) < Date.parse(since));
  const openingDue = items.filter((i) => i.openingDue).map((i) => i.ingredientId);
  const soon = new Set(runningOutSoon(items, left).map((i) => i.ingredientId));
  const shown = filterStock(items, { status, category, query: search, soon });
  const counts = Object.fromEntries(
    FILTERS.map((f) => [
      f,
      filterStock(items, { status: f, category: 'all', query: '', soon }).length,
    ]),
  ) as Record<StockFilter, number>;
  const tiles: { id: TileId; value: string; tone?: string | false }[] = [
    { id: 'tracked', value: String(summary.tracked) },
    { id: 'low', value: String(summary.low), tone: summary.low > 0 && stock.tileLow },
    { id: 'out', value: String(summary.out), tone: summary.out > 0 && stock.tileOut },
    ...(summary.value !== undefined
      ? [{ id: 'value' as const, value: text.value(summary.value) }]
      : []),
  ];
  // By category, in the list's order; those without one last.
  const groups = [
    ...categories.map((c) => ({ id: c.id, name: c.name })),
    { id: null, name: t('adminInventory.stock.noCategory') },
  ]
    .map((g) => ({ ...g, items: shown.filter((i) => i.categoryId === g.id) }))
    .filter((g) => g.items.length > 0);
  const order = can('purchase.manage') && summary.low + summary.out + soon.size > 0;

  return (
    <>
      {recentlyOn && (
        <p className={cx(styles.card, styles.low)} role="status">
          {t('adminInventory.stock.switchedOn', { time: clock.dateTime(since) })}
        </p>
      )}
      <ul className={stock.tiles} aria-label={t('adminInventory.summary.label')}>
        {tiles.map((tile) => (
          <li key={tile.id} className={cx(stock.tile, tile.tone)}>
            <span className={stock.tileLabel}>{t(`adminInventory.summary.${tile.id}`)}</span>
            <span className={stock.tileValue}>{tile.value}</span>
          </li>
        ))}
      </ul>

      <div className={styles.actions}>
        {order && (
          <Button iconStart="tag" onClick={onOrder}>
            {t('adminInventory.actions.orderLow')}
          </Button>
        )}
        {can('inventory.manage') && openingDue.length > 0 && (
          <Button
            variant={order ? 'secondary' : 'primary'}
            iconStart="plus"
            onClick={() => onRecord('opening', openingDue)}
          >
            {t.plural('adminInventory.actions.opening', openingDue.length)}
          </Button>
        )}
        {can('inventory.adjust') && (
          <Button
            className={styles.inJobBar}
            variant="secondary"
            iconStart="sliders"
            onClick={() => onRecord('adjustment')}
          >
            {t('adminInventory.actions.adjust')}
          </Button>
        )}
        {can('inventory.wastage') && (
          <Button
            className={styles.inJobBar}
            variant="secondary"
            iconStart="trash"
            onClick={() => onRecord('wastage')}
          >
            {t('adminInventory.actions.waste')}
          </Button>
        )}
        {sheet.ready && (
          <Button
            className={styles.inJobBar}
            variant="secondary"
            iconStart="receipt"
            onClick={sheet.print}
          >
            {t('adminInventory.sheet.print')}
          </Button>
        )}
        {can('inventory.manage') && makesBatches && (
          <Button variant="secondary" iconStart="chef" onClick={onProduce}>
            {t('adminInventory.production.title')}
          </Button>
        )}
      </div>

      {sheet.sheet}
      {items.length === 0 ? (
        <div className={styles.card}>
          <p>{t('adminInventory.stock.empty')}</p>
          <p className={styles.muted}>{t('adminInventory.stock.emptyHint')}</p>
        </div>
      ) : (
        <section className={stock.list} aria-label={t('adminInventory.stock.label')}>
          <SearchField
            value={search}
            onChange={setSearch}
            label={t('adminInventory.stock.search')}
            placeholder={t('adminInventory.stock.searchPlaceholder')}
          />
          <div className={stock.chips} role="group" aria-label={t('adminInventory.stock.filter')}>
            {FILTERS.filter((f) => f === 'all' || counts[f] > 0 || status === f).map((f) => (
              <Chip key={f} pressed={status === f} count={counts[f]} onClick={() => setStatus(f)}>
                {t(`adminInventory.filters.${f}`)}
              </Chip>
            ))}
          </div>
          {categories.length > 0 && (
            <div
              className={cx(stock.chips, stock.scroll)}
              role="group"
              aria-label={t('adminInventory.stock.category')}
            >
              <Chip pressed={category === 'all'} onClick={() => setCategory('all')}>
                {t('adminInventory.stock.allCategories')}
              </Chip>
              {categories.map((c) => (
                <Chip key={c.id} pressed={category === c.id} onClick={() => setCategory(c.id)}>
                  {c.name}
                </Chip>
              ))}
            </div>
          )}
          {shown.length === 0 ? (
            <p className={styles.muted}>{t('adminInventory.stock.noMatch')}</p>
          ) : (
            groups.map((group) => (
              <section key={group.id ?? 'none'} className={stock.group}>
                {(categories.length > 0 || group.id !== null) && (
                  <h3 className={stock.groupTitle}>
                    {group.name}
                    <span>{group.items.length}</span>
                  </h3>
                )}
                <ul className={stock.rows}>
                  {group.items.map((item) => (
                    <li key={item.ingredientId}>
                      <StockRow
                        item={item}
                        daysLeft={left.get(item.ingredientId)}
                        onOpen={() => onOpen(item.ingredientId)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </section>
      )}
    </>
  );
}

/** How an item stands, in words: out, running low, enough, no starting amount, and its date. */
export function useStockLine() {
  const t = useContent('common');
  const text = useInventoryText();
  const day = useDayText();
  return (
    item: StockItem,
  ): { line: string; date?: string; tone: 'out' | 'low' | 'ok' | 'none' } => {
    const warnAt = item.reorderLevel > 0 ? text.quantity(item.reorderLevel, item.unit) : null;
    const date =
      item.expiry && item.expiry.expired > 0
        ? t('adminInventory.stock.line.expired')
        : item.expiry && item.expiry.expiring > 0 && item.expiry.next
          ? t('adminInventory.stock.line.expiring', { date: day(item.expiry.next) })
          : undefined;
    if (item.openingDue) {
      return { line: t('adminInventory.stock.line.opening'), tone: 'none' };
    }
    if (item.status === 'out') {
      return { line: t('adminInventory.stock.line.out'), ...(date ? { date } : {}), tone: 'out' };
    }
    if (item.status === 'low') {
      return {
        line: t('adminInventory.stock.line.low', { quantity: warnAt ?? '' }),
        ...(date ? { date } : {}),
        tone: 'low',
      };
    }
    return {
      line: warnAt
        ? t('adminInventory.stock.line.okAt', { quantity: warnAt })
        : t('adminInventory.stock.line.noLevel'),
      ...(date ? { date } : {}),
      tone: 'ok',
    };
  };
}

/** How full an item is, as a bar coloured by how it stands (none without a level to measure). */
export function LevelBar({ item }: { item: StockItem }) {
  const full = fullness(item);
  if (full === undefined || item.openingDue) return null;
  return (
    <span className={stock.bar} aria-hidden="true">
      <span
        className={stock[`bar_${item.status}`]}
        style={{ width: `${Math.max(item.onHand > 0 ? 4 : 0, full * 100)}%` }}
      />
    </span>
  );
}

/** "About 3 days left", coloured by how soon (nothing when it's far off or unknown). */
export function DaysLeft({ days }: { days: number | undefined }) {
  const t = useContent('common');
  if (days === undefined || days > SHOW_DAYS) return null;
  const whole = Math.max(0, Math.floor(days));
  return (
    <span
      className={cx(
        stock.days,
        days <= 1 ? stock.daysOut : days <= SOON_DAYS ? stock.daysSoon : undefined,
      )}
    >
      {whole < 1
        ? t('adminInventory.stock.daysLeftToday')
        : t.plural('adminInventory.stock.daysLeft', whole)}
    </span>
  );
}

/** One item in the list: name, how much, its bar, how it stands and how long it lasts. */
function StockRow({
  item,
  daysLeft,
  onOpen,
}: {
  item: StockItem;
  daysLeft: number | undefined;
  onOpen: () => void;
}) {
  const text = useInventoryText();
  const stockLine = useStockLine();
  const { line, date, tone } = stockLine(item);
  return (
    <button type="button" className={stock.row} onClick={onOpen}>
      <span className={stock.rowTop}>
        <span className={stock.name}>{item.name}</span>
        <span className={cx(stock.amount, item.onHand < 0 && styles.negative)}>
          {item.openingDue ? '—' : text.quantity(item.onHand, item.unit)}
        </span>
      </span>
      <LevelBar item={item} />
      <span className={stock.rowBottom}>
        <span className={cx(stock.line, stock[`line_${tone}`])}>
          {line}
          {date && <span className={stock.date}>{date}</span>}
          {!item.openingDue && item.status !== 'out' && <DaysLeft days={daysLeft} />}
        </span>
        {item.value !== undefined && !item.openingDue && (
          <span className={stock.worth}>{text.value(item.value)}</span>
        )}
      </span>
    </button>
  );
}
