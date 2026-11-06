'use client';

import { useState } from 'react';
import { useContent, useIngredients, useInventoryMovements } from '@/api/hooks';
import { Button, Select } from '@/components/ui';
import { shiftDay, type DayRange } from '@/lib/dayRange';
import type { MovementsQuery, StockMovementKind } from '@/types/inventory';
import { DateRangeFilter } from '../DateRangeFilter';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { MovementRow } from './MovementRow';
import { useInventoryExport } from './useInventoryExport';
import { useInventoryText } from './useInventoryText';
import styles from './Inventory.module.css';

const KINDS: readonly StockMovementKind[] = [
  'consumption',
  'purchase',
  'purchase_return',
  'purchase_price',
  'wastage',
  'adjustment',
  'production_in',
  'production_out',
  'count',
  'transfer_out',
  'transfer_in',
  'opening',
  'revaluation',
];

/** One page of the ledger, and the button for the next (which shows the page after it). */
function LedgerPage({
  query,
  onMore,
}: {
  query: MovementsQuery;
  onMore?: (before: string) => void;
}) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const page = useInventoryMovements(branch.id, query);
  const data = page.data;
  if (!data) {
    return (
      <p className={styles.muted} aria-busy={!page.isError}>
        {page.isError ? t('adminInventory.failed') : t('adminInventory.loading')}
      </p>
    );
  }
  return (
    <>
      {data.movements.map((m) => (
        <li key={m.id}>
          <MovementRow movement={m} />
        </li>
      ))}
      {data.next && onMore && (
        <li>
          <Button variant="ghost" block onClick={() => onMore(data.next as string)}>
            {t('adminInventory.ledger.more')}
          </Button>
        </li>
      )}
    </>
  );
}

/**
 * The stock ledger for some days, newest first: everything (or one kind, or one ingredient), page
 * by page. As `wastage`, it is the wastage log, with what was thrown away worth in total.
 */
export function LedgerTab({ today, wastage = false }: { today: string; wastage?: boolean }) {
  const t = useContent('common');
  const { branch, can } = useAdminWorkspace();
  const text = useInventoryText();
  const ingredients = useIngredients(branch.id).data?.ingredients ?? [];
  const [range, setRange] = useState<DayRange>({ from: shiftDay(today, -6), to: today });
  const [kind, setKind] = useState<StockMovementKind | ''>(wastage ? 'wastage' : '');
  const [ingredient, setIngredient] = useState('');
  // The pages shown: the first, then each "Show older" (by the movement it continues after).
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const filter: MovementsQuery = {
    from: range.from,
    to: range.to,
    ...(kind ? { kind } : {}),
    ...(ingredient ? { ingredient } : {}),
  };
  const reset = () => setCursors([undefined]);
  const { download, busy } = useInventoryExport();

  return (
    <section
      className={styles.block}
      aria-label={t(wastage ? 'adminInventory.tabs.wastage' : 'adminInventory.tabs.ledger')}
    >
      <div className={styles.filters}>
        <DateRangeFilter
          id={wastage ? 'wastage' : 'ledger'}
          range={range}
          today={today}
          onChange={(next) => {
            setRange(next);
            reset();
          }}
        />
        {!wastage && can('inventory.manage', 'reports.view') && (
          <Button
            variant="secondary"
            iconStart="list"
            loading={busy === 'ledger'}
            onClick={() => void download('ledger', range, `ledger-${range.from}-${range.to}`)}
          >
            {t('adminInventory.export.csv')}
          </Button>
        )}
      </div>
      <div className={styles.fieldRow}>
        {!wastage && (
          <Select
            id="ledger-kind"
            label={t('adminInventory.ledger.kind')}
            value={kind}
            onChange={(event) => {
              setKind(event.target.value as StockMovementKind | '');
              reset();
            }}
          >
            <option value="">{t('adminInventory.ledger.allKinds')}</option>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`adminInventory.kinds.${k}`)}
              </option>
            ))}
          </Select>
        )}
        <Select
          id={wastage ? 'wastage-ingredient' : 'ledger-ingredient'}
          label={t('adminInventory.entry.ingredient')}
          value={ingredient}
          onChange={(event) => {
            setIngredient(event.target.value);
            reset();
          }}
        >
          <option value="">{t('adminInventory.ledger.allIngredients')}</option>
          {ingredients.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </Select>
      </div>
      {wastage && can('inventory.manage', 'reports.view') && cursors.length === 1 && (
        <WastedTotal query={filter} format={text.value} />
      )}
      <ul className={styles.list}>
        {cursors.map((before, index) => (
          <LedgerPage
            key={before ?? 'first'}
            query={{ ...filter, ...(before ? { before } : {}) }}
            onMore={
              index === cursors.length - 1
                ? (next) => setCursors((all) => [...all, next])
                : undefined
            }
          />
        ))}
      </ul>
    </section>
  );
}

/** What the first page of wastage was worth (the page holds up to a hundred rows). */
function WastedTotal({ query, format }: { query: MovementsQuery; format: (n: number) => string }) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const data = useInventoryMovements(branch.id, query).data;
  if (!data) return null;
  const total = data.movements.reduce((sum, m) => sum - (m.value ?? 0), 0);
  return (
    <p className={styles.blockTitle}>
      {data.next
        ? t('adminInventory.wastage.totalPartial', { amount: format(total) })
        : t('adminInventory.wastage.total', { amount: format(total) })}
    </p>
  );
}
