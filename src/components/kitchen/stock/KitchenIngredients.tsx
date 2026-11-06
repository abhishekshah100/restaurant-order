'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { isBackendEnabled } from '@/api/backend';
import { useContent, useInventoryAlerts, useStockCounts } from '@/api/hooks';
import { useAdminWorkspace } from '@/components/admin/shell/AdminWorkspace';
import { ExpiryChip, useWriteOff } from '@/components/admin/inventory/BatchList';
import { StatusChip } from '@/components/admin/inventory/StockTab';
import { useInventoryText } from '@/components/admin/inventory/useInventoryText';
import { Button } from '@/components/ui';
import { INVENTORY_READERS } from '@/lib/adminNav';
import type { ExpiryAlert } from '@/types/inventory';
import styles from '@/components/admin/inventory/Inventory.module.css';

const ReceiveDialog = dynamic(
  () => import('@/components/admin/purchasing/ReceiveDialog').then((m) => m.ReceiveDialog),
  { ssr: false },
);
const StartCountDialog = dynamic(
  () => import('@/components/admin/inventory/StartCountDialog').then((m) => m.StartCountDialog),
  { ssr: false },
);
const CountDialog = dynamic(
  () => import('@/components/admin/inventory/CountDialog').then((m) => m.CountDialog),
  { ssr: false },
);
const StockEntryDialog = dynamic(
  () => import('@/components/admin/inventory/StockEntryDialog').then((m) => m.StockEntryDialog),
  { ssr: false },
);

/**
 * The kitchen's ingredients (backend only): what's running low or out, recording wastage
 * (`inventory.wastage`) and deliveries at the door (`purchase.receive`), counting stock
 * (`inventory.count`: the open count, or a new one); the kitchen sees
 * quantities, never costs or prices.
 */
export function KitchenIngredients() {
  const t = useContent('common');
  const { branch, can } = useAdminWorkspace();
  const text = useInventoryText();
  const shown = isBackendEnabled() && can(...INVENTORY_READERS);
  const alerts = useInventoryAlerts(branch.id, shown).data;
  const [recording, setRecording] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const counts = can('inventory.count');
  const openCount = useStockCounts(branch.id, shown && counts).data?.counts.find(
    (c) => c.status === 'counting',
  );
  const [counting, setCounting] = useState<'start' | string | null>(null);
  if (!shown) return null;

  return (
    <section className={styles.card} aria-labelledby="kitchen-ingredients">
      <div className={styles.blockHead}>
        <h2 id="kitchen-ingredients" className={styles.blockTitle}>
          {t('adminInventory.kitchen.title')}
        </h2>
        <span className={styles.actions}>
          {can('purchase.receive') && (
            <Button
              size="sm"
              variant="secondary"
              iconStart="bag"
              onClick={() => setReceiving(true)}
            >
              {t('adminPurchasing.receive.title')}
            </Button>
          )}
          {counts && (
            <Button
              size="sm"
              variant="secondary"
              iconStart="checkc"
              onClick={() => setCounting(openCount ? openCount.id : 'start')}
            >
              {openCount
                ? t('adminInventory.counts.continue', { number: openCount.number })
                : t('adminInventory.counts.start')}
            </Button>
          )}
          {can('inventory.wastage') && (
            <Button
              size="sm"
              variant="secondary"
              iconStart="trash"
              onClick={() => setRecording(true)}
            >
              {t('adminInventory.actions.waste')}
            </Button>
          )}
        </span>
      </div>
      {!alerts ? null : alerts.items.length === 0 ? (
        <p className={styles.muted}>{t('adminInventory.kitchen.allGood')}</p>
      ) : (
        <ul className={styles.list}>
          {alerts.items.map((a) => (
            <li key={a.ingredientId} className={styles.row}>
              <span className={styles.rowMain}>
                <span className={styles.rowName}>{a.name}</span>
                {a.reorderLevel > 0 && (
                  <span className={styles.muted}>
                    {t('adminInventory.stock.reorderAt', {
                      quantity: text.quantity(a.reorderLevel, a.unit),
                    })}
                  </span>
                )}
              </span>
              <span className={styles.rowSide}>
                <span className={styles.quantity}>{text.quantity(a.onHand, a.unit)}</span>
                <StatusChip status={a.status} />
              </span>
            </li>
          ))}
        </ul>
      )}
      {alerts && alerts.useFirst.length > 0 && <UseFirst alerts={alerts.useFirst} />}
      {recording && <StockEntryDialog kind="wastage" onClose={() => setRecording(false)} />}
      {receiving && <ReceiveDialog onClose={() => setReceiving(false)} />}
      {counting === 'start' && (
        <StartCountDialog onClose={() => setCounting(null)} onStarted={setCounting} />
      )}
      {counting && counting !== 'start' && (
        <CountDialog id={counting} onClose={() => setCounting(null)} />
      )}
    </section>
  );
}

/**
 * What to use first: batches near or past their last good day (and those not dated yet), soonest
 * first; what's past it is written off in one tap (wastage "expired").
 */
function UseFirst({ alerts }: { alerts: ExpiryAlert[] }) {
  const t = useContent('common');
  const { can } = useAdminWorkspace();
  const text = useInventoryText();
  const writeOff = useWriteOff();
  const expired = alerts.filter((a) => a.state === 'expired');
  return (
    <section className={styles.block} aria-labelledby="kitchen-use-first">
      <div className={styles.blockHead}>
        <h3 id="kitchen-use-first" className={styles.blockTitle}>
          {t('adminInventory.expiry.useFirst')}
        </h3>
        {can('inventory.wastage') && expired.length > 0 && (
          <Button
            size="sm"
            variant="secondary"
            iconStart="trash"
            loading={writeOff.pending}
            onClick={() => writeOff.run(expired.map((a) => a.batchId))}
          >
            {t('adminInventory.expiry.writeOffExpired')}
          </Button>
        )}
      </div>
      <ul className={styles.list}>
        {alerts.map((a) => (
          <li key={a.batchId} className={styles.row}>
            <span className={styles.rowMain}>
              <span className={styles.rowName}>{a.name}</span>
            </span>
            <span className={styles.rowSide}>
              <span className={styles.quantity}>{text.quantity(a.quantity, a.unit)}</span>
              <ExpiryChip state={a.state} expiresOn={a.expiresOn} daysLeft={a.daysLeft} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
