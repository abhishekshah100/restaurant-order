'use client';

import { useState } from 'react';
import { isApiError } from '@/api/client';
import { useContent, usePurchaseOrders, useSuppliers } from '@/api/hooks';
import { useSetPurchasingSettings, useSuggestPurchaseOrder } from '@/api/mutations';
import { Button, Chip, Input, Select } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { parseCost } from '@/lib/inventory';
import type { PoStatus, PurchaseOrdersResponse } from '@/types/purchasing';
import styles from '../inventory/Inventory.module.css';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { StatusChip } from './StatusChip';
import { docNumber, usePurchasingText } from './usePurchasingText';

type Filter = 'open' | 'draft' | 'done' | 'all';
const FILTERS: readonly Filter[] = ['open', 'draft', 'done', 'all'];
const IN: Record<Filter, readonly PoStatus[] | null> = {
  open: ['draft', 'approved', 'sent', 'partly_received'],
  draft: ['draft'],
  done: ['received', 'closed', 'cancelled'],
  all: null,
};

/** The approval limit and the price alert (approvers), saved together. */
function Settings({ data }: { data: PurchaseOrdersResponse }) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const { showToast } = useToast();
  const save = useSetPurchasingSettings();
  const [limit, setLimit] = useState(String(data.approvalLimit ?? 0));
  const [alert, setAlert] = useState(String(data.priceAlert));
  const valid = parseCost(limit) !== null && parseCost(alert) !== null && Number(alert) <= 100;
  return (
    <section className={styles.card} aria-labelledby="po-settings">
      <h2 id="po-settings" className={styles.blockTitle}>
        {t('adminPurchasing.settings.title')}
      </h2>
      <div className={styles.fieldRow}>
        <Input
          id="po-limit"
          label={t('adminPurchasing.settings.limit')}
          hint={t('adminPurchasing.settings.limitHint')}
          inputMode="decimal"
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
        />
        <Input
          id="po-alert"
          label={t('adminPurchasing.settings.alert')}
          hint={t('adminPurchasing.settings.alertHint')}
          inputMode="decimal"
          value={alert}
          onChange={(e) => setAlert(e.target.value)}
        />
      </div>
      <Button
        variant="secondary"
        disabled={!valid}
        loading={save.isPending}
        onClick={() =>
          save.mutate(
            {
              branchId: branch.id,
              body: { approvalLimit: parseCost(limit) ?? 0, priceAlert: Number(alert) },
            },
            {
              onSuccess: () => showToast(t('adminInventory.item.saved'), { tone: 'success' }),
              onError: () => showToast(t('adminInventory.errors.failed'), { tone: 'error' }),
            },
          )
        }
      >
        {t('adminPurchasing.settings.save')}
      </Button>
    </section>
  );
}

/**
 * Purchase orders: new or suggested from what's low, by status; one opens its page. Approvers
 * set the limit above which orders need them, and the price alert.
 */
export function OrdersTab({
  onOpen,
  onReceive,
}: {
  onOpen: (id: string | 'new') => void;
  onReceive: () => void;
}) {
  const t = useContent('common');
  const { branch, can, clock } = useAdminWorkspace();
  const text = usePurchasingText();
  const { showToast } = useToast();
  const query = usePurchaseOrders(branch.id, {});
  const suppliers = useSuppliers(branch.id).data?.suppliers ?? [];
  const suggest = useSuggestPurchaseOrder();
  const [filter, setFilter] = useState<Filter>('open');
  const [supplier, setSupplier] = useState('');

  if (!query.data) {
    return (
      <p className={styles.muted} aria-busy={!query.isError}>
        {query.isError ? t('adminInventory.failed') : t('adminInventory.loading')}
      </p>
    );
  }
  const shown = query.data.orders.filter((o) => IN[filter]?.includes(o.status) ?? true);

  return (
    <>
      {can('purchase.approve') && <Settings data={query.data} />}
      <div className={styles.actions}>
        {can('purchase.manage') && (
          <Button iconStart="plus" onClick={() => onOpen('new')}>
            {t('adminPurchasing.orders.new')}
          </Button>
        )}
        {can('purchase.receive', 'purchase.manage') && (
          <Button variant="secondary" iconStart="bag" onClick={onReceive}>
            {t('adminPurchasing.receive.title')}
          </Button>
        )}
      </div>
      {can('purchase.manage') && suppliers.length > 0 && (
        <div className={styles.filters}>
          <Select
            id="po-suggest"
            label={t('adminPurchasing.orders.suggestFrom')}
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
          >
            <option value="" disabled>
              {t('adminPurchasing.orders.pickSupplier')}
            </option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Button
            variant="secondary"
            iconStart="sparkle"
            disabled={!supplier}
            loading={suggest.isPending}
            onClick={() =>
              suggest.mutate(
                { branchId: branch.id, supplierId: supplier },
                {
                  onSuccess: (order) => onOpen(order.id),
                  onError: (error) =>
                    showToast(
                      isApiError(error, 'nothing_to_order')
                        ? t('adminPurchasing.errors.nothingLow')
                        : t('adminInventory.errors.failed'),
                      { tone: isApiError(error, 'nothing_to_order') ? 'info' : 'error' },
                    ),
                },
              )
            }
          >
            {t('adminPurchasing.orders.suggest')}
          </Button>
        </div>
      )}
      <div className={styles.chips} role="group" aria-label={t('adminInventory.stock.filter')}>
        {FILTERS.map((f) => (
          <Chip key={f} pressed={filter === f} onClick={() => setFilter(f)}>
            {t(`adminPurchasing.orders.filters.${f}`)}
          </Chip>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className={styles.muted}>{t('adminPurchasing.orders.none')}</p>
      ) : (
        <ul className={styles.list}>
          {shown.map((o) => (
            <li key={o.id}>
              <button type="button" className={styles.row} onClick={() => onOpen(o.id)}>
                <span className={styles.rowMain}>
                  <span className={styles.rowName}>
                    {[docNumber('PO', o.number), o.supplier.name].join(' · ')}
                  </span>
                  <span className={styles.muted}>
                    {[
                      clock.date(o.createdAt),
                      t.plural('adminPurchasing.orders.lineCount', o.lines.length),
                      o.expectedOn &&
                        t('adminPurchasing.orders.expected', {
                          date: clock.date(`${o.expectedOn}T12:00:00Z`),
                        }),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <span className={styles.rowSide}>
                  <StatusChip status={o.status} />
                  {o.total !== undefined && (
                    <span className={styles.muted}>{text.value(o.total)}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
