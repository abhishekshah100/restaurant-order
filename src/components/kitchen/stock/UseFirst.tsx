'use client';

import { isBackendEnabled } from '@/api/backend';
import { useContent, useStockBatches } from '@/api/hooks';
import { useWriteOffBatches } from '@/api/mutations';
import { useAdminWorkspace } from '@/components/admin/shell/AdminWorkspace';
import { useInventoryText } from '@/components/admin/inventory/useInventoryText';
import { Button, Icon } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { cx } from '@/lib/cx';
import { newEntryId } from '@/lib/inventory';
import type { StockBatch } from '@/types/inventory';
import styles from './UseFirst.module.css';

/** Within this many days left, an item is "use first". */
const USE_FIRST_DAYS = 1;

interface Row {
  ingredientId: string;
  name: string;
  unit: StockBatch['unit'];
  left: number;
  /** Days left of its soonest batch (negative or 0: past its date / last day). */
  days: number;
  expired: StockBatch[];
}

/**
 * Kitchen › Stock: what to use first — items whose date is today or tomorrow, and what's past it
 * (to write off, for whoever records wastage). Hidden when there's nothing. Quantities only.
 */
export function UseFirst() {
  const t = useContent('common');
  const { branch, can } = useAdminWorkspace();
  const text = useInventoryText();
  const { showToast } = useToast();
  const writeOff = useWriteOffBatches();
  const shown =
    isBackendEnabled() &&
    can(
      'inventory.view',
      'inventory.manage',
      'inventory.adjust',
      'inventory.wastage',
      'inventory.count',
    );
  const expiring = useStockBatches(branch.id, { status: 'expiring' }, shown).data?.batches ?? [];
  const expired = useStockBatches(branch.id, { status: 'expired' }, shown).data?.batches ?? [];
  if (!shown) return null;

  const rows = new Map<string, Row>();
  for (const b of [...expired, ...expiring]) {
    const days = b.state === 'expired' ? -1 : (b.daysLeft ?? 0);
    if (b.left <= 0 || days > USE_FIRST_DAYS) continue;
    const row = rows.get(b.ingredientId) ?? {
      ingredientId: b.ingredientId,
      name: b.name,
      unit: b.unit,
      left: 0,
      days,
      expired: [],
    };
    row.left += b.left;
    row.days = Math.min(row.days, days);
    if (b.state === 'expired') row.expired.push(b);
    rows.set(b.ingredientId, row);
  }
  const list = [...rows.values()].sort((a, b) => a.days - b.days);
  if (list.length === 0) return null;

  const throwAway = (row: Row) =>
    writeOff.mutate(
      {
        branchId: branch.id,
        body: { entryId: newEntryId(), lines: row.expired.map((b) => ({ batchId: b.id })) },
      },
      {
        onSuccess: () =>
          showToast(t.plural('adminInventory.expiry.writtenOff', row.expired.length), {
            tone: 'success',
          }),
        onError: () => showToast(t('adminInventory.errors.failed'), { tone: 'error' }),
      },
    );

  return (
    <section className={styles.card} aria-labelledby="kitchen-use-first">
      <h2 id="kitchen-use-first" className={styles.title}>
        <Icon name="clock" size="sm" />
        {t('adminInventory.useFirst.title')}
      </h2>
      <ul className={styles.list}>
        {list.map((row) => (
          <li key={row.ingredientId} className={cx(styles.row, row.days < 0 && styles.past)}>
            <span className={styles.main}>
              <strong>{row.name}</strong>
              <span>{text.quantity(row.left, row.unit)}</span>
            </span>
            <span className={styles.when}>
              {row.days < 0
                ? t('adminInventory.useFirst.past')
                : row.days === 0
                  ? t('adminInventory.useFirst.today')
                  : t('adminInventory.useFirst.tomorrow')}
            </span>
            {row.expired.length > 0 && can('inventory.wastage') && (
              <Button
                size="sm"
                variant="secondary"
                iconStart="trash"
                loading={writeOff.isPending}
                onClick={() => throwAway(row)}
              >
                {t('adminInventory.expiry.writeOff')}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
