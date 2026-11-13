'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { isBackendEnabled } from '@/api/backend';
import {
  useContent,
  useIngredients,
  useInventoryStock,
  useRecipes,
  useSuppliers,
} from '@/api/hooks';
import { useNow } from '@/hooks/useNow';
import { Button, Chip, Dialog, Icon } from '@/components/ui';
import { cx } from '@/lib/cx';
import { LoadingSignal } from '@/components/layout/GlobalLoader';
import { ADMIN_NAV } from '@/lib/adminNav';
import type { StockFilter } from '@/lib/inventory';
import { setupState, type SetupStep } from '@/lib/inventorySetup';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { CountsTab } from './CountsTab';
import { DashboardTab, type DashboardGo } from './DashboardTab';
import { IngredientsTab } from './IngredientsTab';
import { LedgerTab } from './LedgerTab';
import { RecipesTab } from './RecipesTab';
import { InventorySetup } from './setup/InventorySetup';
import { useSetupSkips } from './setup/useSetupSkips';
import type { StockEntryKind } from './StockEntryDialog';
import { StockTab } from './StockTab';
import { dailyJobs, JOB_ICONS, TodayTab, type DailyJob, type TodayGo } from './TodayTab';
import { TransfersTab } from './TransfersTab';
import { UsageTab } from './UsageTab';
import styles from './Inventory.module.css';

const StockEntryDialog = dynamic(
  () => import('./StockEntryDialog').then((m) => m.StockEntryDialog),
  { ssr: false, loading: () => <LoadingSignal /> },
);
const ProductionDialog = dynamic(
  () => import('./ProductionDialog').then((m) => m.ProductionDialog),
  { ssr: false, loading: () => <LoadingSignal /> },
);
const StockItemDialog = dynamic(() => import('./StockItemDialog').then((m) => m.StockItemDialog), {
  ssr: false,
  loading: () => <LoadingSignal />,
});
const StartCountDialog = dynamic(
  () => import('./StartCountDialog').then((m) => m.StartCountDialog),
  { ssr: false, loading: () => <LoadingSignal /> },
);
const CountDialog = dynamic(() => import('./CountDialog').then((m) => m.CountDialog), {
  ssr: false,
  loading: () => <LoadingSignal />,
});
const PriceRisesDialog = dynamic(
  () => import('./PriceRisesDialog').then((m) => m.PriceRisesDialog),
  { ssr: false, loading: () => <LoadingSignal /> },
);
const RecipeDialog = dynamic(() => import('./RecipeDialog').then((m) => m.RecipeDialog), {
  ssr: false,
  loading: () => <LoadingSignal />,
});
const QuickWasteDialog = dynamic(
  () => import('./QuickWasteDialog').then((m) => m.QuickWasteDialog),
  { ssr: false, loading: () => <LoadingSignal /> },
);
const ReadyOrdersDialog = dynamic(
  () => import('./ReadyOrdersDialog').then((m) => m.ReadyOrdersDialog),
  { ssr: false, loading: () => <LoadingSignal /> },
);
const ReceiveDialog = dynamic(
  () => import('../purchasing/ReceiveDialog').then((m) => m.ReceiveDialog),
  { ssr: false, loading: () => <LoadingSignal /> },
);

const PURCHASING_PATH =
  ADMIN_NAV.find((item) => item.id === 'purchasing')?.href ?? '/admin/dashboard/';

type TabId = 'today' | 'stock' | 'recipes' | 'reports' | 'more';
type ReportId = 'usage' | 'ledger' | 'wastage' | 'dashboard';
type MoreId = 'ingredients' | 'counts' | 'transfers';

/**
 * /admin/dashboard/inventory/: the branch's stock, organised around jobs. Until ingredients and
 * what's on hand are in, the first screen is Get started (managers; others are told to ask one).
 * Then:
 * - Today: what needs someone, the four daily jobs (stock arrived, record wastage, count stock,
 *   correct a number), this week in numbers;
 * - Stock: every item, filterable (opened from Today already filtered);
 * - Recipes: what each dish uses;
 * - Reports: where stock went, every stock change, wastage, charts;
 * - More: the ingredient list, stock counts, other branches.
 * Each by permission, as before. Backend only.
 */
export function Inventory() {
  const t = useContent('common');
  const { branch, clock, can } = useAdminWorkspace();
  const backend = isBackendEnabled();
  const today = clock.dayKey(useNow() ?? new Date());
  const viewer = can('inventory.view');
  const manager = can('inventory.manage');

  const stock = useInventoryStock(branch.id, backend && viewer);
  const recipes = useRecipes(branch.id, backend && manager);
  const ingredients = useIngredients(branch.id, backend && manager);
  const suppliers = useSuppliers(branch.id, backend && can('purchase.receive', 'purchase.manage'));
  const { skips, skip } = useSetupSkips(branch.id);
  const setup = stock.data ? setupState(stock.data.items, recipes.data?.dishes, skips) : null;

  const reports = (
    [
      ['usage', viewer],
      ['ledger', viewer],
      ['wastage', viewer || can('inventory.wastage')],
      ['dashboard', viewer],
    ] as const
  )
    .filter(([, shown]) => shown)
    .map(([id]) => id as ReportId);
  const more = (
    [
      ['ingredients', manager],
      ['counts', viewer || can('inventory.count', 'inventory.manage')],
      ['transfers', viewer],
    ] as const
  )
    .filter(([, shown]) => shown)
    .map(([id]) => id as MoreId);
  const tabs = (
    [
      ['today', true],
      ['stock', viewer],
      ['recipes', manager],
      ['reports', reports.length > 0],
      ['more', more.length > 0],
    ] as const
  )
    .filter(([, shown]) => shown)
    .map(([id]) => id as TabId);

  const [chosen, setTab] = useState<TabId>('today');
  const tab = tabs.includes(chosen) ? chosen : 'today';
  const [report, setReport] = useState<ReportId>('usage');
  const [moreView, setMore] = useState<MoreId>('ingredients');
  const shownReport = reports.includes(report) ? report : reports[0];
  const shownMore = more.includes(moreView) ? moreView : more[0];
  const [setupOpen, setSetupOpen] = useState<{ step?: SetupStep } | null>(null);
  const [stockStatus, setStockStatus] = useState<StockFilter>('all');
  const [entry, setEntry] = useState<{ kind: StockEntryKind; ids?: string[] } | null>(null);
  const [item, setItem] = useState<string | null>(null);
  const [producing, setProducing] = useState(false);
  const [startingCount, setStartingCount] = useState(false);
  const [countId, setCountId] = useState<string | null>(null);
  const [arriving, setArriving] = useState<'receive' | 'noSupplier' | null>(null);
  const [ordering, setOrdering] = useState(false);
  const [prices, setPrices] = useState(false);
  const [recipe, setRecipe] = useState<string | null>(null);
  const record = (kind: StockEntryKind, ids?: string[]) => setEntry({ kind, ids });

  const goTab = (next: TabId) => {
    setSetupOpen(null);
    setTab(next);
  };
  const go = (to: TodayGo) => {
    if (to.to === 'stock') {
      setStockStatus(to.status);
      goTab('stock');
    } else if (to.to === 'order') {
      setOrdering(true);
    } else if (to.to === 'prices') {
      setPrices(true);
    } else if (to.to === 'setup') {
      setTab('today');
      setSetupOpen({ ...(to.step ? { step: to.step } : {}) });
    } else {
      setMore(to.to);
      goTab('more');
    }
  };
  const goFromCharts = (to: DashboardGo) => {
    if (to === 'stock') go({ to: 'stock', status: 'all' });
    else if (to === 'usage') {
      setReport('usage');
      goTab('reports');
    } else go({ to });
  };
  const job = (which: DailyJob) => {
    if (which === 'waste') record('wastage');
    else if (which === 'correct') record('adjustment');
    else if (which === 'count') setStartingCount(true);
    else setArriving((suppliers.data?.suppliers.length ?? 0) > 0 ? 'receive' : 'noSupplier');
  };

  // The guide is the first screen until ingredients and what's on hand are in.
  const guide = tab === 'today' && setup !== null && (setup.needed || setupOpen !== null);
  // On a phone, away from Today, the daily jobs stay one tap away in a bar above the menu.
  const jobs = dailyJobs(can);
  const jobBar = backend && !guide && tab !== 'today' && jobs.length > 0;

  let body;
  if (!backend) {
    body = <p className={styles.card}>{t('adminInventory.backendOnly')}</p>;
  } else if (guide) {
    body =
      manager && ingredients.data ? (
        <InventorySetup
          key={setupOpen?.step ?? 'setup'}
          state={setup}
          items={stock.data?.items ?? []}
          ingredients={ingredients.data.ingredients}
          categories={ingredients.data.categories}
          initialStep={setupOpen?.step}
          onSkip={skip}
          onRecipes={() => goTab('recipes')}
          onFinish={() => setSetupOpen(null)}
          onActive={() => setSetupOpen((open) => open ?? {})}
        />
      ) : manager ? (
        <p className={styles.muted} aria-busy="true">
          {t('adminInventory.loading')}
        </p>
      ) : (
        <p className={styles.card}>{t('adminInventory.setup.notAllowed')}</p>
      );
  } else if (tab === 'today') {
    body = <TodayTab setup={setup} onGo={go} onJob={job} />;
  } else if (tab === 'stock') {
    body = (
      <StockTab
        key={stockStatus}
        initialStatus={stockStatus}
        onOpen={setItem}
        onRecord={record}
        onProduce={() => setProducing(true)}
        onOrder={() => setOrdering(true)}
      />
    );
  } else if (tab === 'recipes') {
    body = <RecipesTab />;
  } else if (tab === 'reports') {
    body = (
      <>
        <SubViews
          label={t('adminInventory.views.reports')}
          ids={reports}
          value={shownReport}
          onChange={setReport}
        />
        {shownReport === 'usage' && <UsageTab today={today} />}
        {shownReport === 'ledger' && <LedgerTab today={today} />}
        {shownReport === 'dashboard' && <DashboardTab onGo={goFromCharts} />}
        {shownReport === 'wastage' && (
          <>
            {can('inventory.wastage') && (
              <div className={styles.actions}>
                <Button iconStart="trash" onClick={() => record('wastage')}>
                  {t('adminInventory.actions.waste')}
                </Button>
              </div>
            )}
            {viewer ? (
              <LedgerTab today={today} wastage />
            ) : (
              <p className={styles.muted}>{t('adminInventory.wastage.recordOnly')}</p>
            )}
          </>
        )}
      </>
    );
  } else if (tab === 'more') {
    body = (
      <>
        <SubViews
          label={t('adminInventory.views.more')}
          ids={more}
          value={shownMore}
          onChange={setMore}
        />
        {shownMore === 'ingredients' && <IngredientsTab />}
        {shownMore === 'counts' && <CountsTab />}
        {shownMore === 'transfers' && <TransfersTab />}
      </>
    );
  }

  return (
    <div className={cx(styles.page, jobBar && styles.withJobBar)}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('adminInventory.title')}</h1>
        <p className={styles.muted}>{t('adminInventory.subtitle')}</p>
      </header>
      {backend && tabs.length > 1 && (
        <div className={styles.tabs} role="tablist" aria-label={t('adminInventory.tabs.label')}>
          {tabs.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={styles.tab}
              onClick={() => goTab(id)}
            >
              {id === 'today' && setup?.needed && manager
                ? t('adminInventory.tabs.getStarted')
                : t(`adminInventory.tabs.${id}`)}
            </button>
          ))}
        </div>
      )}
      {body}
      {jobBar && (
        <nav className={styles.jobBar} aria-label={t('adminInventory.today.jobs')}>
          {jobs.map((j) => (
            <button key={j} type="button" className={styles.jobBarItem} onClick={() => job(j)}>
              <Icon name={JOB_ICONS[j]} size="sm" />
              <span>{t(`adminInventory.today.jobsList.${j}.short`)}</span>
            </button>
          ))}
        </nav>
      )}
      {entry?.kind === 'wastage' && (
        <QuickWasteDialog ingredientIds={entry.ids} onClose={() => setEntry(null)} />
      )}
      {entry && entry.kind !== 'wastage' && (
        <StockEntryDialog
          kind={entry.kind}
          ingredientIds={entry.ids}
          onClose={() => setEntry(null)}
        />
      )}
      {producing && <ProductionDialog onClose={() => setProducing(false)} />}
      {startingCount && (
        <StartCountDialog
          onClose={() => setStartingCount(false)}
          onStarted={(id) => {
            setStartingCount(false);
            setCountId(id);
          }}
        />
      )}
      {countId && <CountDialog id={countId} onClose={() => setCountId(null)} />}
      {arriving === 'receive' && <ReceiveDialog onClose={() => setArriving(null)} />}
      {arriving === 'noSupplier' && (
        <Dialog
          open
          onClose={() => setArriving(null)}
          title={t('adminInventory.today.noSupplier.title')}
          description={t('adminInventory.today.noSupplier.body')}
          footer={
            <Button block href={PURCHASING_PATH}>
              {t('adminInventory.today.noSupplier.go')}
            </Button>
          }
        >
          {null}
        </Dialog>
      )}
      {item && (
        <StockItemDialog
          ingredientId={item}
          onRecord={(kind) => {
            setItem(null);
            record(kind, [item]);
          }}
          onOrder={() => {
            setItem(null);
            setOrdering(true);
          }}
          onClose={() => setItem(null)}
        />
      )}
      {ordering && <ReadyOrdersDialog onClose={() => setOrdering(false)} />}
      {prices && !recipe && (
        <PriceRisesDialog onRecipe={setRecipe} onClose={() => setPrices(false)} />
      )}
      {recipe && <RecipeDialog slug={recipe} onClose={() => setRecipe(null)} />}
    </div>
  );
}

/** The views inside Reports or More, as chips under the tabs. */
function SubViews<Id extends string>({
  label,
  ids,
  value,
  onChange,
}: {
  label: string;
  ids: readonly Id[];
  value: Id | undefined;
  onChange: (id: Id) => void;
}) {
  const t = useContent('common');
  if (ids.length < 2) return null;
  return (
    <div className={styles.subViews} role="group" aria-label={label}>
      {ids.map((id) => (
        <Chip key={id} pressed={value === id} onClick={() => onChange(id)}>
          {t(`adminInventory.tabs.${id as ReportId | MoreId}`)}
        </Chip>
      ))}
    </div>
  );
}
