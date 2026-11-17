'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { isBackendEnabled } from '@/api/backend';
import { useContent, usePurchaseOrders } from '@/api/hooks';
import { Button } from '@/components/ui';
import { useNow } from '@/hooks/useNow';
import styles from '../inventory/Inventory.module.css';
import own from './Purchasing.module.css';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { OrdersTab } from './OrdersTab';
import { ReceiptsTab } from './ReceiptsTab';
import { SuppliersTab } from './SuppliersTab';
import { TodayTab } from './TodayTab';

const OrderDialog = dynamic(() => import('./OrderDialog').then((m) => m.OrderDialog), {
  ssr: false,
});
const ReceiveDialog = dynamic(() => import('./ReceiveDialog').then((m) => m.ReceiveDialog), {
  ssr: false,
});
const ReceiptDialog = dynamic(() => import('./ReceiptDialog').then((m) => m.ReceiptDialog), {
  ssr: false,
});
const SettingsDialog = dynamic(() => import('./SettingsDialog').then((m) => m.SettingsDialog), {
  ssr: false,
});

type TabId = 'today' | 'orders' | 'receipts' | 'suppliers';
const TABS: readonly TabId[] = ['today', 'orders', 'receipts', 'suppliers'];

/**
 * /admin/dashboard/purchasing/: buying for the branch. Today first (setting up, then what's low,
 * to approve, to send, arriving and prices to check), then orders, deliveries (prices to look
 * at, returns) and suppliers. Settings (approval, price alerts) for approvers, from the head.
 * What staff can do follows their purchasing permissions; prices only for those who see them.
 * Backend only.
 */
export function Purchasing() {
  const t = useContent('common');
  const { clock, branch, can } = useAdminWorkspace();
  const backend = isBackendEnabled();
  const today = clock.dayKey(useNow() ?? new Date());
  const [tab, setTab] = useState<TabId>('today');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const approves = can('purchase.approve');
  const settings = usePurchaseOrders(branch.id, {}, backend && approves).data;
  const [order, setOrder] = useState<string | 'new' | null>(null);
  // A new order from a supplier's card: that supplier chosen already.
  const [newFor, setNewFor] = useState<string | undefined>();
  const [receiving, setReceiving] = useState<{ orderId?: string } | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);

  return (
    <div className={styles.page}>
      <header className={own.head}>
        <div className={own.headText}>
          <h1 className={own.title}>{t('adminPurchasing.title')}</h1>
          <p className={own.muted}>{t('adminPurchasing.subtitle')}</p>
        </div>
        {backend && approves && (
          <Button
            variant="secondary"
            size="sm"
            iconStart="sliders"
            disabled={!settings}
            onClick={() => setSettingsOpen(true)}
          >
            {t('adminPurchasing.settings.open')}
          </Button>
        )}
      </header>
      {!backend ? (
        <p className={styles.card}>{t('adminPurchasing.backendOnly')}</p>
      ) : (
        <>
          <div className={styles.tabs} role="tablist" aria-label={t('adminPurchasing.tabs.label')}>
            {TABS.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={styles.tab}
                onClick={() => setTab(id)}
              >
                {t(`adminPurchasing.tabs.${id}`)}
              </button>
            ))}
          </div>
          {tab === 'today' && (
            <TodayTab
              onOpenOrder={setOrder}
              onReceive={(orderId) => setReceiving(orderId ? { orderId } : {})}
              onOpenReceipt={setReceipt}
              onSuppliers={() => setTab('suppliers')}
            />
          )}
          {tab === 'orders' && (
            <OrdersTab
              onOpen={setOrder}
              onReceive={(orderId) => setReceiving(orderId ? { orderId } : {})}
            />
          )}
          {tab === 'receipts' && <ReceiptsTab today={today} onOpen={setReceipt} />}
          {tab === 'suppliers' && (
            <SuppliersTab
              onNewOrder={(supplierId) => {
                setNewFor(supplierId);
                setOrder('new');
              }}
            />
          )}
        </>
      )}
      {order && (
        <OrderDialog
          {...(order === 'new' ? (newFor ? { supplierId: newFor } : {}) : { id: order })}
          onReceive={(orderId) => {
            setOrder(null);
            setReceiving({ orderId });
          }}
          onClose={() => {
            setOrder(null);
            setNewFor(undefined);
          }}
        />
      )}
      {receiving && <ReceiveDialog {...receiving} onClose={() => setReceiving(null)} />}
      {receipt && <ReceiptDialog id={receipt} onClose={() => setReceipt(null)} />}
      {settingsOpen && settings && (
        <SettingsDialog settings={settings} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}
