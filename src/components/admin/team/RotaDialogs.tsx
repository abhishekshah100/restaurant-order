'use client';

import { useState } from 'react';
import { useContent } from '@/api/hooks';
import { useSaveShiftType } from '@/api/mutations';
import { Button, Chip, Dialog, IconButton, Input, Select } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { cx } from '@/lib/cx';
import { spanLabel, spanOf } from '@/lib/rota';
import {
  SHIFT_COLORS,
  type RotaPerson,
  type RotaShift,
  type SaveRotaShiftRequest,
  type ShiftColor,
  type ShiftType,
  type ShiftTypeRequest,
  type TimeOffView,
} from '@/types/admin';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { useDuration } from './useDuration';
import styles from './RotaPlanner.module.css';
import tones from './shiftTones.module.css';

const BREAKS = [0, 15, 30, 45, 60, 90] as const;

/** What's wrong with these hours, if anything (the server's rules too). */
function hoursProblem(startsAt: string, endsAt: string, breakMinutes: number) {
  if (!startsAt || !endsAt) return 'sameTimes' as const;
  if (startsAt === endsAt) return 'sameTimes' as const;
  if (breakMinutes >= spanOf(startsAt, endsAt)) return 'breakTooLong' as const;
  return undefined;
}

function BreakSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: number;
  onChange: (minutes: number) => void;
}) {
  const t = useContent('common');
  const options = BREAKS.includes(value as (typeof BREAKS)[number]) ? BREAKS : [...BREAKS, value];
  return (
    <Select
      id={id}
      label={t('adminSettings.rota.shift.break')}
      value={String(value)}
      onChange={(event) => onChange(Number(event.target.value))}
    >
      {options.map((m) => (
        <option key={m} value={m}>
          {m === 0
            ? t('adminSettings.rota.shift.noBreak')
            : t('adminSettings.rota.shift.breakMinutes', { minutes: m })}
        </option>
      ))}
    </Select>
  );
}

/**
 * Someone's shift on a day: one of the shift types (a tap), or hours of its own; a break and a
 * note. Remove takes them off that day.
 */
export function RotaShiftDialog({
  person,
  dayLabel,
  shift,
  types,
  timeOff,
  saving,
  onSave,
  onRemove,
  onClose,
}: {
  person: RotaPerson;
  /** Time off this person asked for or has that day. */
  timeOff?: TimeOffView;
  day: string;
  dayLabel: string;
  shift?: RotaShift;
  types: readonly ShiftType[];
  saving: boolean;
  onSave: (body: Omit<SaveRotaShiftRequest, 'staffId' | 'day'>) => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const t = useContent('common');
  const duration = useDuration();
  const first = shift ? types.find((ty) => ty.id === shift.typeId) : types[0];
  const [typeId, setTypeId] = useState<string | null>(first?.id ?? null);
  const [startsAt, setStartsAt] = useState(shift?.startsAt ?? first?.startsAt ?? '10:00');
  const [endsAt, setEndsAt] = useState(shift?.endsAt ?? first?.endsAt ?? '18:00');
  const [breakMinutes, setBreak] = useState(shift?.breakMinutes ?? first?.breakMinutes ?? 0);
  const [note, setNote] = useState(shift?.note ?? '');
  const problem = hoursProblem(startsAt, endsAt, breakMinutes);
  const paid = problem ? 0 : spanOf(startsAt, endsAt) - breakMinutes;
  const paidLabel = duration(paid);

  const pick = (type: ShiftType | null) => {
    setTypeId(type?.id ?? null);
    if (type) {
      setStartsAt(type.startsAt);
      setEndsAt(type.endsAt);
      setBreak(type.breakMinutes);
    }
  };

  const submit = () => {
    if (problem) return;
    onSave({
      ...(typeId ? { typeId } : {}),
      startsAt,
      endsAt,
      breakMinutes,
      ...(note.trim() ? { note: note.trim() } : {}),
    });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminSettings.rota.shift.title', { name: person.name, day: dayLabel })}
      className={styles.dialog}
      footer={
        <div className={styles.confirmActions}>
          {onRemove && (
            <Button variant="ghost" iconStart="trash" loading={saving} onClick={onRemove}>
              {t('adminSettings.rota.shift.remove')}
            </Button>
          )}
          <Button iconStart="check" loading={saving} disabled={Boolean(problem)} onClick={submit}>
            {t('adminSettings.rota.shift.save')}
          </Button>
        </div>
      }
    >
      <div className={styles.form}>
        {timeOff && (
          <p className={styles.offWarn} role="note">
            {t(
              timeOff.status === 'approved'
                ? 'adminSettings.rota.shift.timeOffWarn'
                : 'adminSettings.rota.shift.timeOffPending',
              { name: person.name, reason: timeOff.reason },
            )}
          </p>
        )}
        <div
          className={styles.typePicks}
          role="group"
          aria-label={t('adminSettings.rota.shift.type')}
        >
          {types.map((type) => (
            <Chip key={type.id} pressed={typeId === type.id} onClick={() => pick(type)}>
              <span className={cx(styles.swatch, tones[type.color])} aria-hidden="true" />
              {type.name} · {spanLabel(type.startsAt, type.endsAt)}
            </Chip>
          ))}
          <Chip pressed={typeId === null} onClick={() => pick(null)}>
            {t('adminSettings.rota.shift.custom')}
          </Chip>
        </div>
        <div className={styles.row}>
          <Input
            id="rota-from"
            type="time"
            label={t('adminSettings.rota.shift.from')}
            value={startsAt}
            onChange={(event) => {
              setStartsAt(event.target.value);
              setTypeId(null);
            }}
          />
          <Input
            id="rota-to"
            type="time"
            label={t('adminSettings.rota.shift.to')}
            value={endsAt}
            error={problem ? t(`adminSettings.rota.shift.${problem}`) : undefined}
            onChange={(event) => {
              setEndsAt(event.target.value);
              setTypeId(null);
            }}
          />
        </div>
        <div className={styles.row}>
          <BreakSelect
            id="rota-break"
            value={breakMinutes}
            onChange={(m) => {
              setBreak(m);
              setTypeId(null);
            }}
          />
          <Input
            id="rota-note"
            label={t('adminSettings.rota.shift.note')}
            optional
            maxLength={80}
            placeholder={t('adminSettings.rota.shift.notePlaceholder')}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
        {!problem && (
          <p className={styles.paid}>
            {spanLabel(startsAt, endsAt)}
            {' · '}
            {t('adminSettings.rota.shift.paid', { time: paidLabel })}
          </p>
        )}
      </div>
    </Dialog>
  );
}

type Editing = { kind: 'new' } | { kind: 'edit'; type: ShiftType } | null;

/** The branch's shift types: a list to edit or remove, and a form for a new one. */
export function ShiftTypesDialog({
  types,
  onClose,
  onFailed,
}: {
  types: readonly ShiftType[];
  onClose: () => void;
  onFailed: (error: unknown) => void;
}) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const { showToast } = useToast();
  const save = useSaveShiftType();
  const [editing, setEditing] = useState<Editing>(types.length === 0 ? { kind: 'new' } : null);

  if (editing) {
    return (
      <ShiftTypeForm
        type={editing.kind === 'edit' ? editing.type : undefined}
        saving={save.isPending}
        onBack={() => setEditing(null)}
        onClose={onClose}
        onSave={(body) =>
          save.mutate(
            editing.kind === 'edit'
              ? { branchId: branch.id, id: editing.type.id, body }
              : { branchId: branch.id, body },
            {
              onSuccess: () => {
                setEditing(null);
                showToast(t('adminSettings.rota.toast.typeSaved', { name: body.name }), {
                  tone: 'success',
                });
              },
              onError: onFailed,
            },
          )
        }
      />
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminSettings.rota.typesDialog.title')}
      description={t('adminSettings.rota.typesDialog.body')}
      className={styles.dialog}
      footer={
        <Button block iconStart="plus" onClick={() => setEditing({ kind: 'new' })}>
          {t('adminSettings.rota.typesDialog.add')}
        </Button>
      }
    >
      {types.length === 0 ? (
        <p className="t-small c2">{t('adminSettings.rota.typesDialog.empty')}</p>
      ) : (
        <ul className={styles.typeList}>
          {types.map((type) => (
            <li key={type.id} className={styles.typeRow}>
              <span className={cx(styles.swatch, tones[type.color])} aria-hidden="true" />
              <span className={styles.typeText}>
                <span className={styles.typeName}>{type.name}</span>
                <span className={styles.typeMeta}>
                  {spanLabel(type.startsAt, type.endsAt)}
                  {type.breakMinutes > 0 &&
                    ` · ${t('adminSettings.rota.shift.breakMinutes', { minutes: type.breakMinutes })}`}
                </span>
              </span>
              <IconButton
                icon="pencil"
                size="sm"
                label={t('adminSettings.rota.typesDialog.edit', { name: type.name })}
                onClick={() => setEditing({ kind: 'edit', type })}
              />
              <IconButton
                icon="trash"
                size="sm"
                label={t('adminSettings.rota.typesDialog.remove', { name: type.name })}
                onClick={() =>
                  save.mutate(
                    { branchId: branch.id, id: type.id, archive: true },
                    {
                      onSuccess: () =>
                        showToast(t('adminSettings.rota.toast.typeRemoved', { name: type.name }), {
                          tone: 'success',
                        }),
                      onError: onFailed,
                    },
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

function ShiftTypeForm({
  type,
  saving,
  onSave,
  onBack,
  onClose,
}: {
  type?: ShiftType;
  saving: boolean;
  onSave: (body: ShiftTypeRequest) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const t = useContent('common');
  const [name, setName] = useState(type?.name ?? '');
  const [startsAt, setStartsAt] = useState(type?.startsAt ?? '10:00');
  const [endsAt, setEndsAt] = useState(type?.endsAt ?? '16:00');
  const [breakMinutes, setBreak] = useState(type?.breakMinutes ?? 0);
  const [color, setColor] = useState<ShiftColor>(type?.color ?? 'olive');
  const [tried, setTried] = useState(false);
  const problem = hoursProblem(startsAt, endsAt, breakMinutes);
  const submit = () => {
    setTried(true);
    if (!name.trim() || problem) return;
    onSave({ name: name.trim(), startsAt, endsAt, breakMinutes, color });
  };
  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={
        type
          ? t('adminSettings.rota.typesDialog.edit', { name: type.name })
          : t('adminSettings.rota.typesDialog.new')
      }
      className={styles.dialog}
      footer={
        <div className={styles.confirmActions}>
          <Button variant="secondary" iconStart="back" onClick={onBack}>
            {t('adminSettings.rota.typesDialog.back')}
          </Button>
          <Button iconStart="check" loading={saving} onClick={submit}>
            {t('adminSettings.rota.typesDialog.save')}
          </Button>
        </div>
      }
    >
      <div className={styles.form}>
        <Input
          id="shift-type-name"
          label={t('adminSettings.rota.typesDialog.name')}
          placeholder={t('adminSettings.rota.typesDialog.namePlaceholder')}
          maxLength={40}
          value={name}
          error={
            tried && !name.trim() ? t('adminSettings.rota.typesDialog.nameRequired') : undefined
          }
          onChange={(event) => setName(event.target.value)}
        />
        <div className={styles.row}>
          <Input
            id="shift-type-from"
            type="time"
            label={t('adminSettings.rota.shift.from')}
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
          />
          <Input
            id="shift-type-to"
            type="time"
            label={t('adminSettings.rota.shift.to')}
            value={endsAt}
            error={problem ? t(`adminSettings.rota.shift.${problem}`) : undefined}
            onChange={(event) => setEndsAt(event.target.value)}
          />
        </div>
        <BreakSelect id="shift-type-break" value={breakMinutes} onChange={setBreak} />
        <fieldset className={styles.colors}>
          <legend className={styles.colorsLabel}>
            {t('adminSettings.rota.typesDialog.color')}
          </legend>
          {SHIFT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={cx(styles.colorDot, tones[c])}
              aria-pressed={color === c}
              aria-label={t(`adminSettings.rota.typesDialog.colors.${c}`)}
              onClick={() => setColor(c)}
            />
          ))}
        </fieldset>
      </div>
    </Dialog>
  );
}
