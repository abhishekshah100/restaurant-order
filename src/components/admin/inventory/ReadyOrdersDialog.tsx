'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/api/endpoints';
import { useContent, useInventoryStock, useSuppliers } from '@/api/hooks';
import { refreshAfter } from '@/api/refreshAfter';
import { Button, Dialog, Icon } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useAdminToken } from '@/hooks/useAdminSession';
import { ADMIN_NAV } from '@/lib/adminNav';
import { readyOrders } from '@/lib/inventoryPlanning';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { useInventoryText } from './useInventoryText';
import styles from './ReadyOrders.module.css';

const PURCHASING_PATH =
  ADMIN_NAV.find((item) => item.id === 'purchasing')?.href ?? '/admin/dashboard/';

/**
 * Ready orders: what's low, as one draft order per supplier (each item from the supplier marked
 * preferred, else the cheapest), in whole packs up to "order up to". Nothing is created until
 * Create drafts; nothing is sent until someone checks and sends each order in Purchasing. Items
 * no supplier sells, or without a "warn at" level, are listed with what to do.
 */
export function ReadyOrdersDialog({ onClose }: { onClose: () => void }) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const text = useInventoryText();
  const token = useAdminToken();
  const client = useQueryClient();
  const { showToast } = useToast();
  const stock = useInventoryStock(branch.id).data;
  const suppliers = useSuppliers(branch.id).data;
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<number | null>(null);

  const ready = stock && suppliers ? readyOrders(stock.items, suppliers.suppliers) : null;

  const create = async () => {
    if (!token || !ready) return;
    setSaving(true);
    let made = 0;
    try {
      for (const order of ready.orders) {
        await api.createPurchaseOrder(token, branch.id, {
          supplierId: order.supplier.id,
          lines: order.lines.map((l) => ({ ingredientId: l.item.ingredientId, quantity: l.packs })),
        });
        made += 1;
      }
      setCreated(made);
    } catch {
      showToast(t('adminInventory.ready.failed'), { tone: 'error' });
      if (made > 0) setCreated(made);
    } finally {
      setSaving(false);
      await refreshAfter(client, 'purchasingChanged', branch.id);
    }
  };

  const footer =
    created !== null ? (
      <Button block iconEnd="arrow" href={PURCHASING_PATH}>
        {t('adminInventory.ready.openPurchasing')}
      </Button>
    ) : ready && ready.orders.length > 0 ? (
      <Button block iconStart="check" loading={saving} onClick={() => void create()}>
        {t.plural('adminInventory.ready.create', ready.orders.length)}
      </Button>
    ) : undefined;

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminInventory.ready.title')}
      description={t('adminInventory.ready.body')}
      footer={footer}
    >
      {!ready ? (
        <p className={styles.muted} aria-busy="true">
          {t('adminInventory.loading')}
        </p>
      ) : created !== null ? (
        <div className={styles.done}>
          <span className={styles.doneIcon} aria-hidden="true">
            <Icon name="checkc" size="md" />
          </span>
          <p className={styles.doneTitle}>{t.plural('adminInventory.ready.created', created)}</p>
          <p className={styles.muted}>{t('adminInventory.ready.createdHint')}</p>
        </div>
      ) : (
        <div className={styles.body}>
          {ready.orders.length === 0 && (
            <p className={styles.nothing}>
              <Icon name="checkc" size="sm" />
              {t('adminInventory.ready.nothing')}
            </p>
          )}
          {ready.orders.map((order) => (
            <section key={order.supplier.id} className={styles.order}>
              <h3 className={styles.supplier}>
                <span>{order.supplier.name}</span>
                {order.total > 0 && <span className={styles.total}>{text.value(order.total)}</span>}
              </h3>
              <ul className={styles.lines}>
                {order.lines.map((l) => (
                  <li key={l.item.ingredientId} className={styles.line}>
                    <span className={styles.lineName}>
                      {l.item.name}
                      <span className={styles.muted}>
                        {t('adminInventory.ready.has', {
                          quantity: text.quantity(l.item.onHand, l.item.unit),
                        })}
                      </span>
                    </span>
                    <span className={styles.lineQty}>
                      {t('adminInventory.ready.packs', {
                        count: l.packs,
                        pack: l.pack.name,
                        size: text.quantity(l.pack.size, l.pack.unit),
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {ready.noSupplier.length > 0 && (
            <p className={styles.gap}>
              <Icon name="info" size="xs" />
              {t('adminInventory.ready.noSupplier', {
                names: ready.noSupplier.map((i) => i.name).join(', '),
              })}
            </p>
          )}
          {ready.noLevel.length > 0 && (
            <p className={styles.gap}>
              <Icon name="info" size="xs" />
              {t('adminInventory.ready.noLevel', {
                names: ready.noLevel.map((i) => i.name).join(', '),
              })}
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
