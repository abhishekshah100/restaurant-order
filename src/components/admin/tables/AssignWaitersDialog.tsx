'use client';

import { useState } from 'react';
import { useContent, useFloorPlan, useSectionWaiters } from '@/api/hooks';
import { useAssignTables, useClearSections } from '@/api/mutations';
import { Button, Dialog, Skeleton } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { initialsOf } from '@/lib/adminTables';
import { cx } from '@/lib/cx';
import type { AdminFloorTable } from '@/types/admin';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './AssignWaitersDialog.module.css';

/**
 * Assign waiters (Tables, `tables.assign`): pick a waiter, then tap their tables. A tap gives
 * the table to them (from whoever had it) or, on one of theirs, takes it off them; each tap is
 * saved at once. Clear all (tapped twice) frees every table for the next shift.
 */
export function AssignWaitersDialog({ onClose }: { onClose: () => void }) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const { showToast } = useToast();
  const plan = useFloorPlan(branch.id);
  const waiters = useSectionWaiters(branch.id);
  const assign = useAssignTables();
  const clear = useClearSections();
  const [picked, setPicked] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);

  const people = waiters.data ?? [];
  const selected = people.find((w) => w.id === picked) ?? people[0];
  const floors = (plan.data?.floors ?? [])
    .map((f) => ({ ...f, tables: f.tables.filter((tb) => !tb.disabled) }))
    .filter((f) => f.tables.length > 0);
  const covered = (id: string) =>
    floors.flatMap((f) => f.tables).filter((tb) => tb.waiter?.id === id).length;

  const failed = () => showToast(t('adminTables.sections.failed'), { tone: 'error' });

  const tap = (table: AdminFloorTable) => {
    if (!selected) return;
    const theirs = table.waiter?.id === selected.id;
    setSaving(table.table);
    assign.mutate(
      { branchId: branch.id, tables: [table.table], waiterId: theirs ? null : selected.id },
      { onError: failed, onSettled: () => setSaving(null) },
    );
  };

  const clearAll = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    clear.mutate(
      { branchId: branch.id },
      {
        onSuccess: () => showToast(t('adminTables.sections.cleared'), { tone: 'success' }),
        onError: failed,
        onSettled: () => setConfirmClear(false),
      },
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminTables.sections.title')}
      description={t('adminTables.sections.body')}
      footer={
        <div className={styles.foot}>
          <Button
            variant={confirmClear ? 'dark' : 'secondary'}
            size="sm"
            loading={clear.isPending}
            onClick={clearAll}
          >
            {confirmClear
              ? t('adminTables.sections.clearConfirm')
              : t('adminTables.sections.clearAll')}
          </Button>
          <Button size="sm" onClick={onClose}>
            {t('adminTables.sections.done')}
          </Button>
        </div>
      }
    >
      {!plan.data || !waiters.data ? (
        <div role="status" aria-label={t('adminTables.sections.loading')}>
          <Skeleton shape="block" width="100%" height={200} />
        </div>
      ) : people.length === 0 ? (
        <p className="t-small c2">{t('adminTables.sections.noWaiters')}</p>
      ) : (
        <>
          <div
            className={styles.people}
            role="radiogroup"
            aria-label={t('adminTables.sections.whoLabel')}
          >
            {people.map((w) => {
              const on = w.id === selected?.id;
              return (
                <button
                  key={w.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={cx(styles.person, on && styles.on)}
                  onClick={() => setPicked(w.id)}
                >
                  <span className={styles.badge} aria-hidden="true">
                    {initialsOf(w.name)}
                  </span>
                  <span className={styles.who}>
                    <span className={styles.name}>{w.name}</span>
                    <span className={styles.count}>
                      {t.plural('adminTables.sections.tables', covered(w.id))}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {selected && (
            <p className={styles.hint}>
              {t('adminTables.sections.tapFor', { name: selected.name })}
            </p>
          )}
          {floors.map((floor) => (
            <section key={floor.id} className={styles.floor} aria-label={floor.name}>
              {floors.length > 1 && <h3 className={styles.floorName}>{floor.name}</h3>}
              <ul className={styles.grid}>
                {floor.tables.map((table) => {
                  const theirs = !!selected && table.waiter?.id === selected.id;
                  return (
                    <li key={table.table}>
                      <button
                        type="button"
                        aria-pressed={theirs}
                        aria-label={t('adminTables.sections.tableLabel', {
                          table: table.table,
                          waiter: table.waiter?.name ?? t('adminTables.sections.nobody'),
                        })}
                        className={cx(
                          styles.table,
                          theirs && styles.theirs,
                          table.waiter && !theirs && styles.other,
                        )}
                        disabled={saving === table.table}
                        onClick={() => tap(table)}
                      >
                        <span className={styles.number}>{table.table}</span>
                        <span className={styles.covered}>
                          {table.waiter ? initialsOf(table.waiter.name) : '–'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </>
      )}
    </Dialog>
  );
}
