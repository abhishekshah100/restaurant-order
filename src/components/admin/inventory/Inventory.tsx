'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { isBackendEnabled } from '@/api/backend';
import { useContent } from '@/api/hooks';
import { useNow } from '@/hooks/useNow';
import { Button } from '@/components/ui';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { CountsTab } from './CountsTab';
import { DashboardTab } from './DashboardTab';
import { IngredientsTab } from './IngredientsTab';
import { LedgerTab } from './LedgerTab';
import { RecipesTab } from './RecipesTab';
import type { StockEntryKind } from './StockEntryDialog';
import { StockTab } from './StockTab';
import { TransfersTab } from './TransfersTab';
import { UsageTab } from './UsageTab';
import styles from './Inventory.module.css';

const StockEntryDialog = dynamic(
  () => import('./StockEntryDialog').then((m) => m.StockEntryDialog),
  { ssr: false },
);
const ProductionDialog = dynamic(
  () => import('./ProductionDialog').then((m) => m.ProductionDialog),
  { ssr: false },
);
const StockItemDialog = dynamic(() => import('./StockItemDialog').then((m) => m.StockItemDialog), {
  ssr: false,
});

type TabId =
  | 'dashboard'
  | 'stock'
  | 'counts'
  | 'transfers'
  | 'usage'
  | 'recipes'
  | 'ingredients'
  | 'wastage'
  | 'ledger';

/**
 * /admin/dashboard/inventory/: the branch's stock. Tabs by permission: Dashboard, Stock (what's
 * there, low and out, recording changes), Transfers, Usage and Ledger for `inventory.view`;
 * Counts for viewers and those who count; Recipes (dishes' recipes and food cost) and Ingredients
 * (the restaurant's list) for `inventory.manage`; Wastage (its log and recording it) for viewers
 * and those who record wastage. Backend only.
 */
export function Inventory() {
  const t = useContent('common');
  const { clock, can } = useAdminWorkspace();
  const backend = isBackendEnabled();
  const today = clock.dayKey(useNow() ?? new Date());
  const tabs = (
    [
      ['dashboard', can('inventory.view')],
      ['stock', can('inventory.view')],
      ['counts', can('inventory.view', 'inventory.count', 'inventory.manage')],
      ['transfers', can('inventory.view')],
      ['usage', can('inventory.view')],
      ['recipes', can('inventory.manage')],
      ['ingredients', can('inventory.manage')],
      ['wastage', can('inventory.view', 'inventory.wastage')],
      ['ledger', can('inventory.view')],
    ] as const
  )
    .filter(([, shown]) => shown)
    .map(([id]) => id as TabId);
  const [chosen, setTab] = useState<TabId | null>(null);
  const tab = chosen && tabs.includes(chosen) ? chosen : tabs[0];
  const [entry, setEntry] = useState<{ kind: StockEntryKind; ids?: string[] } | null>(null);
  const [item, setItem] = useState<string | null>(null);
  const [producing, setProducing] = useState(false);
  const record = (kind: StockEntryKind, ids?: string[]) => setEntry({ kind, ids });

  let body;
  if (!backend) {
    body = <p className={styles.card}>{t('adminInventory.backendOnly')}</p>;
  } else if (tab === 'dashboard') {
    body = <DashboardTab onGo={setTab} />;
  } else if (tab === 'counts') {
    body = <CountsTab />;
  } else if (tab === 'transfers') {
    body = <TransfersTab />;
  } else if (tab === 'usage') {
    body = <UsageTab today={today} />;
  } else if (tab === 'stock') {
    body = <StockTab onOpen={setItem} onRecord={record} onProduce={() => setProducing(true)} />;
  } else if (tab === 'recipes') {
    body = <RecipesTab />;
  } else if (tab === 'ingredients') {
    body = <IngredientsTab />;
  } else if (tab === 'wastage') {
    body = (
      <>
        {can('inventory.wastage') && (
          <div className={styles.actions}>
            <Button iconStart="trash" onClick={() => record('wastage')}>
              {t('adminInventory.actions.waste')}
            </Button>
          </div>
        )}
        {can('inventory.view') ? (
          <LedgerTab today={today} wastage />
        ) : (
          <p className={styles.muted}>{t('adminInventory.wastage.recordOnly')}</p>
        )}
      </>
    );
  } else if (tab === 'ledger') {
    body = <LedgerTab today={today} />;
  }

  return (
    <div className={styles.page}>
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
              onClick={() => setTab(id)}
            >
              {t(`adminInventory.tabs.${id}`)}
            </button>
          ))}
        </div>
      )}
      {body}
      {entry && (
        <StockEntryDialog
          kind={entry.kind}
          ingredientIds={entry.ids}
          onClose={() => setEntry(null)}
        />
      )}
      {producing && <ProductionDialog onClose={() => setProducing(false)} />}
      {item && (
        <StockItemDialog
          ingredientId={item}
          onRecord={(kind) => {
            setItem(null);
            record(kind, [item]);
          }}
          onClose={() => setItem(null)}
        />
      )}
    </div>
  );
}
