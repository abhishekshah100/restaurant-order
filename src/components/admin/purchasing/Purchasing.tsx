'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { isBackendEnabled } from '@/api/backend';
import { useContent } from '@/api/hooks';
import { useNow } from '@/hooks/useNow';
import styles from '../inventory/Inventory.module.css';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { OrdersTab } from './OrdersTab';
import { ReceiptsTab } from './ReceiptsTab';
import { SuppliersTab } from './SuppliersTab';

const OrderDialog = dynamic(() => import('./OrderDialog').then((m) => m.OrderDialog), {
  ssr: false,
});
const ReceiveDialog = dynamic(() => import('./ReceiveDialog').then((m) => m.ReceiveDialog), {
  ssr: false,
});
const ReceiptDialog = dynamic(() => import('./ReceiptDialog').then((m) => m.ReceiptDialog), {
  ssr: false,
});

type TabId = 'orders' | 'receipts' | 'suppliers';
const TABS: readonly TabId[] = ['orders', 'receipts', 'suppliers'];

/**
 * /admin/dashboard/purchasing/: buying for the branch. Orders (new, suggested from what's low,
 * approved, sent, received), deliveries (prices to look at, returns) and suppliers. What staff
 * can do follows their purchasing permissions; prices only for those who see them. Backend only.
 */
export function Purchasing() {
  const t = useContent('common');
  const { clock } = useAdminWorkspace();
  const backend = isBackendEnabled();
  const today = clock.dayKey(useNow() ?? new Date());
  const [tab, setTab] = useState<TabId>('orders');
  const [order, setOrder] = useState<string | 'new' | null>(null);
  const [receiving, setReceiving] = useState<{ orderId?: string } | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('adminPurchasing.title')}</h1>
        <p className={styles.muted}>{t('adminPurchasing.subtitle')}</p>
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
          {tab === 'orders' && <OrdersTab onOpen={setOrder} onReceive={() => setReceiving({})} />}
          {tab === 'receipts' && <ReceiptsTab today={today} onOpen={setReceipt} />}
          {tab === 'suppliers' && <SuppliersTab />}
        </>
      )}
      {order && (
        <OrderDialog
          {...(order === 'new' ? {} : { id: order })}
          onReceive={(orderId) => {
            setOrder(null);
            setReceiving({ orderId });
          }}
          onClose={() => setOrder(null)}
        />
      )}
      {receiving && <ReceiveDialog {...receiving} onClose={() => setReceiving(null)} />}
      {receipt && <ReceiptDialog id={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}
