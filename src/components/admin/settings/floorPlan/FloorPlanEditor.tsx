'use client';

import { useState } from 'react';
import { ApiError } from '@/api/client';
import type { TableInUse } from '@/api/contracts';
import { useContent, useFloorLayout } from '@/api/hooks';
import { useUpdateFloors } from '@/api/mutations';
import { Button, EmptyState, Icon, IconButton } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import {
  addArea,
  addTables,
  cleanLayout,
  floorSeats,
  layoutErrors,
  layoutTotals,
  moveArea,
  removeArea,
  removeTable,
  renameArea,
  sameLayout,
  updateTable,
} from '@/lib/floorLayout';
import { cx } from '@/lib/cx';
import type { FloorLayout, FloorPlanLayout } from '@/types/admin';
import { useAdminWorkspace } from '../../shell/AdminWorkspace';
import { useLeaveGuard } from '../shared/useLeaveGuard';
import { AreaDialog, RemoveAreaDialog, type AreaDialogTarget } from './AreaDialog';
import { TableDialog, type TableDialogTarget } from './TableDialog';
import styles from './FloorPlanEditor.module.css';

/**
 * Settings › Floor plan: the branch's areas (floors, a terrace, a private room…) in the order
 * staff walk them, each with its tables and seats. Add, rename, reorder and remove areas; add
 * tables (several at once), change a table's number, seats or area, take it out of service (it
 * stays on the plan) or remove it. Changes are a
 * draft until Save (Discard puts the plan back; leaving with changes asks first). The server
 * refuses to drop a table with an open bill or a booking to come, and says which.
 */
export function FloorPlanEditor() {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const saved = useFloorLayout(branch.id);

  if (saved.data) return <Editor key={branch.id} saved={saved.data} />;
  if (saved.isError) {
    return (
      <EmptyState
        icon="wifioff"
        tone="err"
        title={t('adminTables.error.title')}
        actions={
          <Button iconStart="refresh" loading={saved.isFetching} onClick={() => saved.refetch()}>
            {t('adminTables.error.retry')}
          </Button>
        }
      >
        {t('adminTables.error.body')}
      </EmptyState>
    );
  }
  return (
    <div
      className={styles.skeleton}
      role="status"
      aria-label={t('adminSettings.floorPlan.loading')}
    >
      <span />
      <span />
    </div>
  );
}

function Editor({ saved }: { saved: FloorPlanLayout }) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const { showToast } = useToast();
  const save = useUpdateFloors();
  const [draft, setDraft] = useState<FloorPlanLayout | null>(null);
  const [areaDialog, setAreaDialog] = useState<AreaDialogTarget | null>(null);
  const [tableDialog, setTableDialog] = useState<TableDialogTarget | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [inUse, setInUse] = useState<TableInUse[]>([]);

  const layout = draft ?? saved;
  const dirty = draft !== null && !sameLayout(draft, saved);
  const errors = layoutErrors(layout);
  const totals = layoutTotals(layout);
  const savedTables = new Map(
    saved.floors.flatMap((f) =>
      f.tables.map((tb) => [
        tb.number,
        { area: f.id, seats: tb.seats, disabled: tb.disabled === true },
      ]),
    ),
  );
  useLeaveGuard(dirty, t('adminSettings.floorPlan.save.leave'));

  const edit = (next: FloorPlanLayout) => {
    setDraft(next);
    setInUse([]);
  };

  const submit = () => {
    if (!dirty || errors.length > 0) return;
    save.mutate(
      { branchId: branch.id, body: cleanLayout(layout) },
      {
        onSuccess: () => {
          setDraft(null);
          showToast(t('adminSettings.floorPlan.save.saved'), { tone: 'success' });
        },
        onError: (error) => {
          if (error instanceof ApiError && error.code === 'table_in_use') {
            setInUse(error.body?.tables ?? []);
          } else {
            showToast(t('adminSettings.floorPlan.save.failed'), { tone: 'error' });
          }
        },
      },
    );
  };

  const removingArea = layout.floors.find((f) => f.id === removing) ?? null;

  return (
    <div className={cx(styles.editor, dirty && styles.withBar)}>
      <header className={styles.head}>
        <div className={styles.headText}>
          <h1 className={styles.title}>{t('adminSettings.floorPlan.title')}</h1>
          <p className={styles.subtitle}>
            {t('adminSettings.floorPlan.subtitle', { branch: branch.shortName })}
          </p>
          <ul className={styles.totals} aria-label={t('adminSettings.floorPlan.title')}>
            <li>
              <Icon name="store" size="xs" />
              {t.plural('adminSettings.counts.areas', totals.areas)}
            </li>
            <li>
              <Icon name="table" size="xs" />
              {t.plural('adminSettings.counts.tables', totals.tables)}
            </li>
            <li>
              <Icon name="user" size="xs" />
              {t.plural('adminSettings.counts.seats', totals.seats)}
            </li>
            {totals.outOfService > 0 && (
              <li className={styles.offTotal}>
                <Icon name="lock" size="xs" />
                {t.plural('adminSettings.counts.outOfService', totals.outOfService)}
              </li>
            )}
          </ul>
        </div>
        <div className={styles.headActions}>
          <Button
            variant="secondary"
            iconStart="plus"
            onClick={() => setAreaDialog({ mode: 'add' })}
          >
            {t('adminSettings.floorPlan.addArea')}
          </Button>
          {layout.floors.length > 0 && (
            <Button
              iconStart="table"
              onClick={() => setTableDialog({ mode: 'add', areaId: layout.floors[0].id })}
            >
              {t('adminSettings.floorPlan.addTables')}
            </Button>
          )}
        </div>
      </header>

      {layout.floors.length === 1 && (
        <p className={styles.note}>
          <Icon name="info" size="xs" />
          {t('adminSettings.floorPlan.single')}
        </p>
      )}

      {inUse.length > 0 && (
        <div className={styles.inUse} role="alert">
          <p className={styles.inUseTitle}>
            <Icon name="alert" size="sm" />
            {t('adminSettings.floorPlan.errors.inUseTitle')}
          </p>
          <ul>
            {inUse.map((item) => (
              <li key={item.number}>
                {t(`adminSettings.floorPlan.errors.inUse.${item.reason}`, { number: item.number })}
              </li>
            ))}
          </ul>
          <p className={styles.inUseHint}>
            {inUse.every((item) => item.change === 'disabled')
              ? t('adminSettings.floorPlan.errors.inUseHintDisable')
              : t('adminSettings.floorPlan.errors.inUseHint')}
          </p>
        </div>
      )}

      <ol className={styles.areas}>
        {layout.floors.map((floor, index) => (
          <AreaCard
            key={floor.id}
            floor={floor}
            first={index === 0}
            last={index === layout.floors.length - 1}
            savedTables={savedTables}
            onRename={() => setAreaDialog({ mode: 'rename', id: floor.id, name: floor.name })}
            onRemove={() => setRemoving(floor.id)}
            onMove={(by) => edit(moveArea(layout, floor.id, by))}
            onAddTable={() => setTableDialog({ mode: 'add', areaId: floor.id })}
            onEditTable={(number) => setTableDialog({ mode: 'edit', number })}
          />
        ))}
      </ol>

      {dirty && (
        <div
          className={styles.saveBar}
          role="region"
          aria-label={t('adminSettings.floorPlan.save.unsaved')}
        >
          <div className={styles.saveText}>
            <strong>{t('adminSettings.floorPlan.save.unsaved')}</strong>
            <span>
              {errors.length > 0
                ? t(`adminSettings.floorPlan.errors.${errors[0]}`)
                : t('adminSettings.floorPlan.save.summary')}
            </span>
          </div>
          <div className={styles.saveActions}>
            <Button
              variant="secondary"
              onClick={() => {
                setDraft(null);
                setInUse([]);
              }}
            >
              {t('adminSettings.floorPlan.save.discard')}
            </Button>
            <Button
              iconStart="check"
              loading={save.isPending}
              disabled={errors.length > 0}
              onClick={submit}
            >
              {t('adminSettings.floorPlan.save.save')}
            </Button>
          </div>
        </div>
      )}

      <AreaDialog
        target={areaDialog}
        layout={layout}
        onClose={() => setAreaDialog(null)}
        onDone={(name) => {
          edit(
            areaDialog?.mode === 'rename'
              ? renameArea(layout, areaDialog.id, name)
              : addArea(layout, name),
          );
          setAreaDialog(null);
        }}
      />
      <RemoveAreaDialog
        area={removingArea}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) edit(removeArea(layout, removing));
          setRemoving(null);
        }}
      />
      <TableDialog
        target={tableDialog}
        layout={layout}
        onClose={() => setTableDialog(null)}
        onAdd={(areaId, numbers, seats) => {
          edit(addTables(layout, areaId, numbers, seats));
          setTableDialog(null);
        }}
        onUpdate={(number, next) => {
          edit(updateTable(layout, number, next));
          setTableDialog(null);
        }}
        onRemove={(number) => {
          edit(removeTable(layout, number));
          setTableDialog(null);
        }}
      />
    </div>
  );
}

/** One area: its name and size, moving and renaming it, and its tables as tiles. */
function AreaCard({
  floor,
  first,
  last,
  savedTables,
  onRename,
  onRemove,
  onMove,
  onAddTable,
  onEditTable,
}: {
  floor: FloorLayout;
  first: boolean;
  last: boolean;
  savedTables: ReadonlyMap<number, { area: string; seats: number; disabled: boolean }>;
  onRename: () => void;
  onRemove: () => void;
  onMove: (by: -1 | 1) => void;
  onAddTable: () => void;
  onEditTable: (number: number) => void;
}) {
  const t = useContent('common');
  const titleId = `area-${floor.id}`;
  const vars = { area: floor.name };

  return (
    <li className={styles.area} aria-labelledby={titleId}>
      <div className={styles.areaHead}>
        <div className={styles.order}>
          <IconButton
            icon="chevd"
            size="sm"
            className={styles.up}
            label={t('adminSettings.floorPlan.area.up', vars)}
            disabled={first}
            onClick={() => onMove(-1)}
          />
          <IconButton
            icon="chevd"
            size="sm"
            label={t('adminSettings.floorPlan.area.down', vars)}
            disabled={last}
            onClick={() => onMove(1)}
          />
        </div>
        <div className={styles.areaText}>
          <h2 id={titleId} className={styles.areaName}>
            {floor.name}
          </h2>
          <p className={styles.areaMeta}>
            {t('adminSettings.floorPlan.area.meta', {
              tables: t.plural('adminSettings.counts.tables', floor.tables.length),
              seats: t.plural('adminSettings.counts.seats', floorSeats(floor)),
            })}
          </p>
        </div>
        <div className={styles.areaActions}>
          <IconButton
            icon="pencil"
            variant="soft"
            size="sm"
            label={t('adminSettings.floorPlan.area.rename', vars)}
            onClick={onRename}
          />
          <IconButton
            icon="trash"
            variant="soft"
            size="sm"
            className={styles.remove}
            label={t('adminSettings.floorPlan.area.remove', vars)}
            onClick={onRemove}
          />
        </div>
      </div>

      <ul className={styles.tables}>
        {floor.tables.map((table) => {
          const before = savedTables.get(table.number);
          const state = !before
            ? 'new'
            : before.area !== floor.id ||
                before.seats !== table.seats ||
                before.disabled !== (table.disabled === true)
              ? 'changed'
              : undefined;
          const seats = t.plural('adminSettings.floorPlan.table.seats', table.seats);
          return (
            <li key={table.number}>
              <button
                type="button"
                className={styles.table}
                data-state={state}
                data-off={table.disabled || undefined}
                aria-label={[
                  t('adminSettings.floorPlan.table.edit', { number: table.number, seats }),
                  table.disabled && t('adminSettings.floorPlan.table.outOfService'),
                ]
                  .filter(Boolean)
                  .join(' · ')}
                onClick={() => onEditTable(table.number)}
              >
                {state && (
                  <span className={styles.flag}>
                    {t(
                      state === 'new'
                        ? 'adminSettings.floorPlan.table.new'
                        : 'adminSettings.floorPlan.table.changed',
                    )}
                  </span>
                )}
                <span className={styles.number}>{table.number}</span>
                <span className={styles.seats}>
                  <Icon name={table.disabled ? 'lock' : 'user'} size="xs" />
                  {table.disabled ? t('adminSettings.floorPlan.table.outOfService') : seats}
                </span>
              </button>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            className={styles.addTable}
            aria-label={t('adminSettings.floorPlan.area.addTableIn', vars)}
            onClick={onAddTable}
          >
            <Icon name="plus" size="sm" />
            {t('adminSettings.floorPlan.area.addTable')}
          </button>
        </li>
      </ul>
      {floor.tables.length === 0 && (
        <p className={styles.areaEmpty}>{t('adminSettings.floorPlan.area.empty')}</p>
      )}
    </li>
  );
}
