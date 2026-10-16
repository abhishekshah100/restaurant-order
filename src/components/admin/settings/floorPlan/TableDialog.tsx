'use client';

import { useState } from 'react';
import { useContent } from '@/api/hooks';
import { Button, Dialog, Input, QuantityStepper, Select } from '@/components/ui';
import {
  MAX_SEATS,
  MAX_TABLES_AT_ONCE,
  areaOf,
  isTableNumber,
  nextNumbers,
  numberRun,
  usedNumbers,
} from '@/lib/floorLayout';
import type { FloorPlanLayout } from '@/types/admin';
import styles from './FloorPlanDialogs.module.css';

/** The seats a new table starts with. */
const DEFAULT_SEATS = 4;

export type TableDialogTarget = { mode: 'add'; areaId: string } | { mode: 'edit'; number: number };

export interface TableEdit {
  number: number;
  seats: number;
  areaId: string;
  /** Out of service. */
  disabled: boolean;
}

/**
 * Add tables to an area (one, or several numbered in a row from the first free number, each
 * with the same seats), or change one table (its number, seats and area; in service or not) or
 * remove it.
 */
export function TableDialog({
  target,
  layout,
  onClose,
  onAdd,
  onUpdate,
  onRemove,
}: {
  target: TableDialogTarget | null;
  layout: FloorPlanLayout;
  onClose: () => void;
  onAdd: (areaId: string, numbers: number[], seats: number) => void;
  onUpdate: (number: number, next: TableEdit) => void;
  onRemove: (number: number) => void;
}) {
  if (!target) return null;
  return target.mode === 'add' ? (
    <AddTables
      key={`add-${target.areaId}`}
      areaId={target.areaId}
      {...{ layout, onClose, onAdd }}
    />
  ) : (
    <EditTable
      key={`edit-${target.number}`}
      number={target.number}
      {...{ layout, onClose, onUpdate, onRemove }}
    />
  );
}

/** The area picker both forms share. */
function AreaSelect({
  layout,
  value,
  onChange,
}: {
  layout: FloorPlanLayout;
  value: string;
  onChange: (id: string) => void;
}) {
  const t = useContent('common');
  if (layout.floors.length < 2) return null;
  return (
    <Select
      id="table-area"
      label={t('adminSettings.floorPlan.tableDialog.area')}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {layout.floors.map((f) => (
        <option key={f.id} value={f.id}>
          {f.name}
        </option>
      ))}
    </Select>
  );
}

function AddTables({
  areaId: initialArea,
  layout,
  onClose,
  onAdd,
}: {
  areaId: string;
  layout: FloorPlanLayout;
  onClose: () => void;
  onAdd: (areaId: string, numbers: number[], seats: number) => void;
}) {
  const t = useContent('common');
  const [areaId, setAreaId] = useState(initialArea);
  const [count, setCount] = useState(1);
  const [first, setFirst] = useState(String(nextNumbers(layout)[0]));
  const [seats, setSeats] = useState(DEFAULT_SEATS);

  const start = Number(first);
  const validStart = /^\d{1,4}$/.test(first) && isTableNumber(start);
  const { numbers, taken } = numberRun(layout, validStart ? start : 1, count);
  const fits = validStart && numbers.every(isTableNumber);
  const error = !fits
    ? t('adminSettings.floorPlan.tableDialog.invalidNumber')
    : taken.length > 0
      ? t.plural('adminSettings.floorPlan.tableDialog.taken', taken.length, {
          list: taken.join(', '),
        })
      : undefined;
  const seatsLabel = t.plural('adminSettings.floorPlan.table.seats', seats);

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminSettings.floorPlan.tableDialog.addTitle')}
      description={t('adminSettings.floorPlan.tableDialog.addDescription')}
      className={styles.dialog}
      footer={
        <Button
          block
          iconStart="plus"
          disabled={Boolean(error)}
          onClick={() => onAdd(areaId, numbers, seats)}
        >
          {t.plural('adminSettings.floorPlan.tableDialog.add', count)}
        </Button>
      }
    >
      <div className={styles.form}>
        <AreaSelect layout={layout} value={areaId} onChange={setAreaId} />
        <div className={styles.row}>
          <div className={styles.stepperField}>
            <span className={styles.label} id="table-count-label">
              {t('adminSettings.floorPlan.tableDialog.count')}
            </span>
            <QuantityStepper
              value={count}
              min={1}
              max={MAX_TABLES_AT_ONCE}
              onChange={setCount}
              itemName={t('adminSettings.floorPlan.tableDialog.count')}
            />
          </div>
          <div className={styles.stepperField}>
            <span className={styles.label}>{t('adminSettings.floorPlan.tableDialog.seats')}</span>
            <QuantityStepper
              value={seats}
              min={1}
              max={MAX_SEATS}
              onChange={setSeats}
              itemName={t('adminSettings.floorPlan.tableDialog.seats')}
            />
          </div>
        </div>
        <Input
          id="table-first"
          label={t('adminSettings.floorPlan.tableDialog.first')}
          inputMode="numeric"
          autoComplete="off"
          value={first}
          error={error}
          onChange={(event) => setFirst(event.target.value.replace(/\D/g, '').slice(0, 4))}
        />
        {!error && (
          <p className={styles.preview} role="status">
            {t.plural('adminSettings.floorPlan.tableDialog.preview', count, {
              first: numbers[0],
              last: numbers.at(-1) ?? numbers[0],
              seats: seatsLabel,
            })}
          </p>
        )}
      </div>
    </Dialog>
  );
}

function EditTable({
  number,
  layout,
  onClose,
  onUpdate,
  onRemove,
}: {
  number: number;
  layout: FloorPlanLayout;
  onClose: () => void;
  onUpdate: (number: number, next: TableEdit) => void;
  onRemove: (number: number) => void;
}) {
  const t = useContent('common');
  const area = areaOf(layout, number);
  const table = area?.tables.find((tb) => tb.number === number);
  const [areaId, setAreaId] = useState(area?.id ?? layout.floors[0]?.id ?? '');
  const [text, setText] = useState(String(number));
  const [seats, setSeats] = useState(table?.seats ?? DEFAULT_SEATS);
  const [inService, setInService] = useState(!table?.disabled);
  if (!table) return null;

  const next = Number(text);
  const valid = /^\d{1,4}$/.test(text) && isTableNumber(next);
  const taken = valid && next !== number && usedNumbers(layout).has(next);
  const error = !valid
    ? t('adminSettings.floorPlan.tableDialog.invalidNumber')
    : taken
      ? t('adminSettings.floorPlan.tableDialog.takenOne', { number: next })
      : undefined;

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminSettings.floorPlan.tableDialog.editTitle', { number })}
      description={t('adminSettings.floorPlan.tableDialog.editDescription')}
      className={styles.dialog}
      footer={
        <div className={styles.footer}>
          <Button
            variant="secondary"
            iconStart="trash"
            className={styles.removeButton}
            onClick={() => onRemove(number)}
          >
            {t('adminSettings.floorPlan.tableDialog.remove')}
          </Button>
          <Button
            block
            iconStart="check"
            disabled={Boolean(error)}
            onClick={() => onUpdate(number, { number: next, seats, areaId, disabled: !inService })}
          >
            {t('adminSettings.floorPlan.tableDialog.save')}
          </Button>
        </div>
      }
    >
      <div className={styles.form}>
        <AreaSelect layout={layout} value={areaId} onChange={setAreaId} />
        <Input
          id="table-number"
          label={t('adminSettings.floorPlan.tableDialog.number')}
          inputMode="numeric"
          autoComplete="off"
          value={text}
          error={error}
          hint={
            valid && next !== number ? t('adminSettings.floorPlan.tableDialog.qrNote') : undefined
          }
          onChange={(event) => setText(event.target.value.replace(/\D/g, '').slice(0, 4))}
        />
        <div className={styles.stepperField}>
          <span className={styles.label}>{t('adminSettings.floorPlan.tableDialog.seats')}</span>
          <QuantityStepper
            value={seats}
            min={1}
            max={MAX_SEATS}
            onChange={setSeats}
            itemName={t('adminSettings.floorPlan.tableDialog.seats')}
          />
        </div>
        <label className={styles.service}>
          <span className={styles.serviceText}>
            <span className={styles.label}>{t('adminSettings.floorPlan.tableDialog.service')}</span>
            <span className={styles.serviceHint} id="table-service-hint">
              {inService
                ? t('adminSettings.floorPlan.tableDialog.serviceOn')
                : t('adminSettings.floorPlan.tableDialog.serviceOff')}
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            className={styles.switch}
            checked={inService}
            aria-describedby="table-service-hint"
            onChange={(event) => setInService(event.target.checked)}
          />
        </label>
      </div>
    </Dialog>
  );
}
