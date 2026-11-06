'use client';

import { useState } from 'react';
import { useContent, useInventoryDashboard } from '@/api/hooks';
import { Button, Chip } from '@/components/ui';
import { ADMIN_NAV } from '@/lib/adminNav';
import { numberLocale } from '@/lib/money';
import { cx } from '@/lib/cx';
import type { DashboardBranch, InventoryDashboard } from '@/types/inventory';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { BarList, TrendChart } from './Charts';
import { useInventoryText } from './useInventoryText';
import styles from './Inventory.module.css';

const PURCHASING_PATH =
  ADMIN_NAV.find((item) => item.id === 'purchasing')?.href ?? '/admin/dashboard/';

export type DashboardGo = 'stock' | 'counts' | 'transfers' | 'usage';

/** "32.4%" */
const percent = (n: number | undefined) =>
  n === undefined ? '—' : `${(Math.round(n * 10) / 10).toFixed(1)}%`;

/**
 * The inventory dashboard: what's waiting (counts to apply, transfers to receive, purchasing's
 * prices, orders and deliveries), the branch's headline figures, its stock value over 30 days,
 * this week's wastage by reason, the most used items and the prices that moved most. Admins of
 * more than one branch see every branch side by side. Costs only for those who see them.
 */
export function DashboardTab({ onGo }: { onGo: (tab: DashboardGo) => void }) {
  const t = useContent('common');
  const { branch, region, canSwitch, can } = useAdminWorkspace();
  const [scope, setScope] = useState<'branch' | 'restaurant'>('branch');
  const query = useInventoryDashboard(branch.id, scope);
  const data = query.data;

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

  return (
    <>
      {canSwitch && (
        <div className={styles.chips} role="group" aria-label={t('adminInventory.dashboard.scope')}>
          {(['branch', 'restaurant'] as const).map((s) => (
            <Chip key={s} pressed={scope === s} onClick={() => setScope(s)}>
              {t(`adminInventory.dashboard.scopes.${s}`)}
            </Chip>
          ))}
        </div>
      )}
      {!data ? (
        <p className={styles.muted} aria-busy="true">
          {t('adminInventory.loading')}
        </p>
      ) : (
        <>
          <Todo todo={data.todo} onGo={onGo} purchasing={can('purchase.view', 'purchase.manage')} />
          <Headline figures={data} />
          {scope === 'restaurant' && data.branches && <Branches branches={data.branches} />}
          <Charts data={data} locale={numberLocale(region)} symbol={region.currency.symbol} />
        </>
      )}
    </>
  );
}

/** What's waiting for someone: each a button to where it's done. */
function Todo({
  todo,
  onGo,
  purchasing,
}: {
  todo: InventoryDashboard['todo'];
  onGo: (tab: DashboardGo) => void;
  purchasing: boolean;
}) {
  const t = useContent('common');
  const items = [
    { id: 'countsToApply' as const, count: todo.countsToApply, go: () => onGo('counts') },
    {
      id: 'transfersToReceive' as const,
      count: todo.transfersToReceive,
      go: () => onGo('transfers'),
    },
    { id: 'expired' as const, count: todo.expired, go: () => onGo('stock') },
    { id: 'expiring' as const, count: todo.expiring, go: () => onGo('stock') },
    ...(purchasing
      ? [
          { id: 'pricesToConfirm' as const, count: todo.pricesToConfirm, href: PURCHASING_PATH },
          { id: 'ordersToApprove' as const, count: todo.ordersToApprove, href: PURCHASING_PATH },
          { id: 'deliveriesDue' as const, count: todo.deliveriesDue, href: PURCHASING_PATH },
        ]
      : []),
  ].filter((i) => i.count > 0);
  if (items.length === 0) return null;
  return (
    <section className={styles.card} aria-labelledby="inventory-todo">
      <h2 id="inventory-todo" className={styles.blockTitle}>
        {t('adminInventory.dashboard.todo')}
      </h2>
      <div className={styles.actions}>
        {items.map((item) => (
          <Button
            key={item.id}
            size="sm"
            variant="secondary"
            onClick={'go' in item ? item.go : undefined}
            href={'href' in item ? item.href : undefined}
          >
            {t.plural(`adminInventory.dashboard.todos.${item.id}`, item.count)}
          </Button>
        ))}
      </div>
    </section>
  );
}

/** The headline tiles: value, low and out, wasted this week, bought this month, food cost. */
function Headline({ figures }: { figures: DashboardBranch }) {
  const t = useContent('common');
  const { clock } = useAdminWorkspace();
  const text = useInventoryText();
  type TileId =
    'stockValue' | 'low' | 'out' | 'wastedWeek' | 'purchasedMonth' | 'foodCost' | 'lastCount';
  const tiles: { id: TileId; value: string; detail?: string; tone?: string | false }[] = [
    ...(figures.stockValue !== undefined
      ? [{ id: 'stockValue' as const, value: text.value(figures.stockValue) }]
      : []),
    { id: 'low' as const, value: String(figures.low), tone: figures.low > 0 && styles.tileLow },
    { id: 'out' as const, value: String(figures.out), tone: figures.out > 0 && styles.tileOut },
    ...(figures.wastedWeek !== undefined
      ? [{ id: 'wastedWeek' as const, value: text.value(figures.wastedWeek) }]
      : []),
    ...(figures.purchasedMonth !== undefined
      ? [{ id: 'purchasedMonth' as const, value: text.value(figures.purchasedMonth) }]
      : []),
    ...(figures.foodCost
      ? [
          {
            id: 'foodCost' as const,
            value: percent(figures.foodCost.actual),
            detail: t('adminInventory.dashboard.recipesSay', {
              percent: percent(figures.foodCost.theoretical),
            }),
          },
        ]
      : []),
    {
      id: 'lastCount' as const,
      value: figures.lastCount
        ? clock.date(figures.lastCount.at)
        : t('adminInventory.dashboard.never'),
      detail:
        figures.lastCount?.differenceValue !== undefined
          ? t('adminInventory.dashboard.countDifference', {
              amount: text.signedWhole(figures.lastCount.differenceValue),
            })
          : undefined,
    },
  ];
  return (
    <ul className={styles.tiles} aria-label={t('adminInventory.summary.label')}>
      {tiles.map((tile) => (
        <li key={tile.id} className={cx(styles.tile, tile.tone)}>
          <span className={styles.muted}>{t(`adminInventory.dashboard.tiles.${tile.id}`)}</span>
          <span className={styles.tileValue}>{tile.value}</span>
          {tile.detail && <span className={styles.muted}>{tile.detail}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Every branch side by side (restaurant view). */
function Branches({ branches }: { branches: DashboardBranch[] }) {
  const t = useContent('common');
  const text = useInventoryText();
  const sees = branches.some((b) => b.stockValue !== undefined);
  return (
    <section className={styles.card} aria-labelledby="inventory-branches">
      <h2 id="inventory-branches" className={styles.blockTitle}>
        {t('adminInventory.dashboard.branches')}
      </h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{t('adminInventory.dashboard.branch')}</th>
              {sees && <th scope="col">{t('adminInventory.dashboard.tiles.stockValue')}</th>}
              <th scope="col">{t('adminInventory.dashboard.tiles.low')}</th>
              <th scope="col">{t('adminInventory.dashboard.tiles.out')}</th>
              {sees && <th scope="col">{t('adminInventory.dashboard.tiles.wastedWeek')}</th>}
              {sees && <th scope="col">{t('adminInventory.dashboard.tiles.foodCost')}</th>}
            </tr>
          </thead>
          <tbody>
            {branches.map((b) => (
              <tr key={b.branchId}>
                <th scope="row">{b.name}</th>
                {sees && <td>{b.stockValue !== undefined ? text.value(b.stockValue) : '—'}</td>}
                <td>{b.low}</td>
                <td>{b.out}</td>
                {sees && <td>{b.wastedWeek !== undefined ? text.value(b.wastedWeek) : '—'}</td>}
                {sees && <td>{percent(b.foodCost?.actual)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** The charts: stock value over 30 days, wastage by reason, the most used, prices that moved. */
function Charts({
  data,
  locale,
  symbol,
}: {
  data: InventoryDashboard;
  locale: string;
  symbol: string;
}) {
  const t = useContent('common');
  const text = useInventoryText();
  const compact = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });
  const day = (key: string) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
      new Date(`${key}T12:00:00Z`),
    );
  const sees = data.valueTrend !== undefined;

  return (
    <div className={styles.chartGrid}>
      {data.valueTrend && (
        <TrendChart
          label={t('adminInventory.dashboard.valueTrend')}
          points={data.valueTrend}
          format={text.value}
          compact={(n) => `${symbol}${compact.format(n)}`}
          day={day}
        />
      )}
      {data.wastageByReason.length > 0 ? (
        <BarList
          label={t('adminInventory.dashboard.wastage')}
          rows={data.wastageByReason.map((r) => ({
            key: r.reason,
            name: t(`adminInventory.reasons.${r.reason}` as 'adminInventory.reasons.other'),
            amount: sees ? (r.value ?? 0) : r.quantityItems,
            text: sees ? text.value(r.value ?? 0) : String(r.quantityItems),
            detail: t.plural('adminInventory.dashboard.records', r.quantityItems),
          }))}
        />
      ) : (
        <p className={styles.card}>{t('adminInventory.dashboard.noWastage')}</p>
      )}
      {data.topUsed.length > 0 &&
        (sees ? (
          <BarList
            label={t('adminInventory.dashboard.topUsed')}
            rows={data.topUsed.map((u) => ({
              key: u.ingredientId,
              name: u.name,
              amount: u.value ?? 0,
              text: text.value(u.value ?? 0),
              detail: text.quantity(u.quantity, u.unit),
            }))}
          />
        ) : (
          // Quantities in different units don't compare as bars: a list.
          <section className={styles.card} aria-labelledby="inventory-top">
            <h2 id="inventory-top" className={styles.blockTitle}>
              {t('adminInventory.dashboard.topUsed')}
            </h2>
            <ul className={styles.list}>
              {data.topUsed.map((u) => (
                <li key={u.ingredientId} className={styles.row}>
                  <span className={styles.rowName}>{u.name}</span>
                  <span className={styles.quantity}>{text.quantity(u.quantity, u.unit)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      {data.priceMoves && data.priceMoves.length > 0 && (
        <section className={styles.card} aria-labelledby="inventory-prices">
          <h2 id="inventory-prices" className={styles.blockTitle}>
            {t('adminInventory.dashboard.priceMoves')}
          </h2>
          <ul className={styles.list}>
            {data.priceMoves.map((p) => (
              <li key={p.ingredientId} className={styles.row}>
                <span className={styles.rowMain}>
                  <span className={styles.rowName}>{p.name}</span>
                  <span className={styles.muted}>
                    {[text.cost(p.from, p.unit), text.cost(p.to, p.unit)].join(' → ')}
                  </span>
                </span>
                <span
                  className={cx(styles.quantity, p.change > 0 ? styles.negative : styles.positive)}
                >
                  {[p.change > 0 ? '+' : '−', percent(Math.abs(p.change))].join('')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
