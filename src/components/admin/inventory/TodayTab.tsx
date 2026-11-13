'use client';

import { useContent, useInventoryDashboard, useInventoryStock } from '@/api/hooks';
import { Button, Icon, type IconName } from '@/components/ui';
import { useNow } from '@/hooks/useNow';
import { cx } from '@/lib/cx';
import { ADMIN_NAV } from '@/lib/adminNav';
import { type StockFilter } from '@/lib/inventory';
import { runningOutSoon } from '@/lib/inventoryPlanning';
import { attention, type Attention, type SetupState, type SetupStep } from '@/lib/inventorySetup';
import { useAdminWorkspace, type Can } from '../shell/AdminWorkspace';
import { useDaysLeft } from './useDaysLeft';
import { WeekCard } from './WeekCard';
import { InfoTip } from './InfoTip';
import { useInventoryText } from './useInventoryText';
import styles from './Today.module.css';

const PURCHASING_PATH =
  ADMIN_NAV.find((item) => item.id === 'purchasing')?.href ?? '/admin/dashboard/';

export type TodayGo =
  | { to: 'stock'; status: StockFilter }
  | { to: 'order' }
  | { to: 'prices' }
  | { to: 'counts' }
  | { to: 'transfers' }
  | { to: 'setup'; step?: SetupStep };

export type DailyJob = 'arrived' | 'waste' | 'count' | 'correct';

/** The daily jobs this person may do, in order. */
export const dailyJobs = (can: Can): DailyJob[] =>
  (
    [
      ['arrived', can('purchase.receive', 'purchase.manage')],
      ['waste', can('inventory.wastage')],
      ['count', can('inventory.count', 'inventory.manage')],
      ['correct', can('inventory.adjust')],
    ] as const
  )
    .filter(([, allowed]) => allowed)
    .map(([job]) => job);

export const JOB_ICONS: Record<DailyJob, IconName> = {
  arrived: 'bag',
  waste: 'trash',
  count: 'list',
  correct: 'sliders',
};

const TONE_ICONS: Record<Attention['tone'], IconName> = {
  urgent: 'alert',
  soon: 'clock',
  info: 'info',
};

/**
 * Inventory › Today: what needs someone now (out, past its date, running low…, each with what to
 * do about it), the four daily jobs as big buttons, and this week in three numbers. While the
 * optional setup steps are left, a card offers to finish them.
 */
export function TodayTab({
  setup,
  onGo,
  onJob,
}: {
  /** None when this person can't see stock (they still get their jobs). */
  setup: SetupState | null;
  onGo: (go: TodayGo) => void;
  onJob: (job: DailyJob) => void;
}) {
  const t = useContent('common');
  const { branch, can } = useAdminWorkspace();
  const text = useInventoryText();
  const now = useNow();
  const viewer = can('inventory.view');
  const stock = useInventoryStock(branch.id, viewer).data;
  const dashboard = useInventoryDashboard(branch.id, 'branch', viewer).data;
  const purchasing = can('purchase.view', 'purchase.manage', 'purchase.approve');
  const order = can('purchase.manage');

  const jobs = dailyJobs(can);

  const { left } = useDaysLeft();
  const soon = stock ? runningOutSoon(stock.items, left).length : 0;
  const list =
    stock && now
      ? attention(stock.summary, setup?.openingDue ?? 0, dashboard, now, purchasing, soon)
      : [];

  const actions = (a: Attention): { label: string; run: () => void; href?: string }[] => {
    const see = (status: StockFilter) => ({
      label: t('adminInventory.today.actions.see'),
      run: () => onGo({ to: 'stock', status }),
    });
    const orderNow = order
      ? [
          {
            label: t('adminInventory.today.actions.order'),
            run: () => onGo({ to: 'order' }),
          },
        ]
      : [];
    const open = (run: () => void, href?: string) => ({
      label: t('adminInventory.today.actions.open'),
      run,
      ...(href ? { href } : {}),
    });
    switch (a.id) {
      case 'out':
        return [...orderNow, see('out')];
      case 'low':
        return [...orderNow, see('low')];
      case 'runningOut':
        return [...orderNow, see('soon')];
      case 'expired':
      case 'expiring':
        return [see('expiring')];
      case 'opening':
        return can('inventory.manage')
          ? [
              {
                label: t('adminInventory.today.actions.enter'),
                run: () => onGo({ to: 'setup', step: 'opening' }),
              },
            ]
          : [];
      case 'deliveriesDue':
      case 'pricesToConfirm':
      case 'ordersToApprove':
        return [open(() => undefined, PURCHASING_PATH)];
      case 'countsToApply':
        return [open(() => onGo({ to: 'counts' }))];
      case 'transfersToReceive':
        return [open(() => onGo({ to: 'transfers' }))];
      case 'countDue':
        return jobs.includes('count')
          ? [{ label: t('adminInventory.today.actions.countNow'), run: () => onJob('count') }]
          : [];
      case 'priceUp':
        return [
          { label: t('adminInventory.today.actions.seeDishes'), run: () => onGo({ to: 'prices' }) },
        ];
    }
  };

  const figures = dashboard
    ? [
        {
          id: 'value' as const,
          value: dashboard.stockValue !== undefined ? text.value(dashboard.stockValue) : undefined,
        },
        {
          id: 'wasted' as const,
          value: dashboard.wastedWeek !== undefined ? text.value(dashboard.wastedWeek) : undefined,
        },
        {
          id: 'foodCost' as const,
          value:
            (dashboard.foodCost?.actual ?? 0) > 0
              ? `${Math.round((dashboard.foodCost?.actual ?? 0) * 10) / 10}%`
              : undefined,
        },
      ].filter((f) => f.value !== undefined || f.id !== 'value')
    : [];

  return (
    <div className={styles.today}>
      {setup && setup.current && !setup.needed && can('inventory.manage') && (
        <section className={styles.finish} aria-labelledby="inventory-finish">
          <div className={styles.finishText}>
            <h2 id="inventory-finish" className={styles.finishTitle}>
              {t('adminInventory.setup.finish.title')}
            </h2>
            <p>{t('adminInventory.setup.finish.body', { done: setup.finished })}</p>
            <span className={styles.finishBar} aria-hidden="true">
              <span style={{ width: `${(setup.finished / 4) * 100}%` }} />
            </span>
          </div>
          <Button iconEnd="arrow" onClick={() => onGo({ to: 'setup' })}>
            {t('adminInventory.setup.finish.go')}
          </Button>
        </section>
      )}

      <WeekCard onPrices={() => onGo({ to: 'prices' })} />

      {viewer && (
        <section className={styles.card} aria-labelledby="inventory-attention">
          <h2 id="inventory-attention" className={styles.cardTitle}>
            {t('adminInventory.today.attention')}
          </h2>
          {!stock ? (
            <p className={styles.muted} aria-busy="true">
              {t('adminInventory.loading')}
            </p>
          ) : list.length === 0 ? (
            <p className={styles.allGood}>
              <Icon name="checkc" size="md" />
              {t('adminInventory.today.allGood')}
            </p>
          ) : (
            <ul className={styles.attention}>
              {list.map((a) => (
                <li key={a.id} className={cx(styles.item, styles[a.tone])}>
                  <span className={styles.itemIcon} aria-hidden="true">
                    <Icon name={TONE_ICONS[a.tone]} size="sm" />
                  </span>
                  <span className={styles.itemText}>
                    <span>
                      {t.plural(`adminInventory.today.items.${a.id}`, a.count, {
                        days: a.days ?? 0,
                      })}
                      {a.id === 'runningOut' && (
                        <InfoTip label={t('adminInventory.tips.label')}>
                          {t('adminInventory.tips.runningOut')}
                        </InfoTip>
                      )}
                    </span>
                    {a.id === 'priceUp' && (a.dishes ?? 0) > 0 && (
                      <span className={styles.itemWorth}>
                        {[
                          t.plural('adminInventory.today.items.priceDishes', a.dishes ?? 0),
                          (a.overGoal ?? 0) > 0 &&
                            t.plural('adminInventory.today.items.priceOver', a.overGoal ?? 0),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    )}
                    {a.value !== undefined && a.value > 0 && (
                      <span className={styles.itemWorth}>
                        {t('adminInventory.today.items.expiredWorth', {
                          amount: text.value(a.value),
                        })}
                      </span>
                    )}
                  </span>
                  <span className={styles.itemActions}>
                    {actions(a).map((action, index) => (
                      <Button
                        key={action.label}
                        size="sm"
                        variant={index === 0 ? 'primary' : 'secondary'}
                        href={action.href}
                        onClick={action.href ? undefined : action.run}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {jobs.length > 0 && (
        <section aria-labelledby="inventory-jobs" className={styles.jobsBlock}>
          <h2 id="inventory-jobs" className={styles.sectionTitle}>
            {t('adminInventory.today.jobs')}
          </h2>
          <div className={styles.jobs}>
            {jobs.map((job) => (
              <button
                key={job}
                type="button"
                className={cx(styles.job, styles[`job_${job}`])}
                onClick={() => onJob(job)}
              >
                <span className={styles.jobIcon} aria-hidden="true">
                  <Icon name={JOB_ICONS[job]} size="md" />
                </span>
                <span className={styles.jobTitle}>
                  {t(`adminInventory.today.jobsList.${job}.title`)}
                </span>
                <span className={styles.jobHint}>
                  {t(`adminInventory.today.jobsList.${job}.hint`)}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {figures.length > 0 && (
        <section aria-label={t('adminInventory.today.numbers.label')}>
          <dl className={styles.numbers}>
            {figures.map((f) => (
              <div key={f.id} className={styles.number}>
                <dt>
                  {t(`adminInventory.today.numbers.${f.id}`)}
                  {f.id === 'foodCost' && (
                    <InfoTip label={t('adminInventory.tips.label')}>
                      {t('adminInventory.tips.foodCost')}
                    </InfoTip>
                  )}
                </dt>
                <dd>{f.value ?? t('adminInventory.today.numbers.none')}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
