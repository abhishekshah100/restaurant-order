'use client';

import { useState } from 'react';
import { isApiError } from '@/api/client';
import { useContent, useFloorPlan, useReservations } from '@/api/hooks';
import { useSaveReservation } from '@/api/mutations';
import {
  Button,
  Chip,
  Dialog,
  Input,
  PhoneInput,
  QuantityStepper,
  Select,
  Textarea,
} from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import {
  DURATIONS,
  MAX_NAME,
  MAX_NOTE,
  MAX_PARTY,
  MAX_TABLES,
  bookingDays,
  bookingRange,
  dayOffset,
  reservationErrors,
  reservationForm,
  reservationInput,
  suggestTables,
  tableChoices,
  timeSlots,
  type ReservationForm,
} from '@/lib/reservations';
import type { Reservation } from '@/types/admin';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { DayStrip } from './DayStrip';
import { TablePicker } from './TablePicker';
import { useReservationText } from './useReservationText';
import styles from './ReservationEditor.module.css';

/** What the form opens on: a new booking (at a table, from its page) or one to change. */
export type EditorTarget =
  { kind: 'new'; table?: number } | { kind: 'edit'; reservation: Reservation };

/**
 * New reservation / Change booking: the guest (name, mobile, party size), when (a day up to
 * 60 days ahead, a time the branch is open, how long to hold the table), the table (free ones
 * for the party then, the best fit marked) and a note. Checks before sending; a table taken
 * meanwhile says by whom.
 */
export function ReservationEditor({
  target,
  onClose,
}: {
  target: EditorTarget | null;
  onClose: () => void;
}) {
  if (!target) return null;
  // Keyed, so each booking opens on its own fresh form.
  const key = target.kind === 'edit' ? target.reservation.id : `new-${target.table ?? ''}`;
  return <EditorForm key={key} target={target} onClose={onClose} />;
}

function EditorForm({ target, onClose }: { target: EditorTarget; onClose: () => void }) {
  const t = useContent('common');
  const { branch, region, clock } = useAdminWorkspace();
  const { showToast } = useToast();
  const text = useReservationText();
  const floors = useFloorPlan(branch.id).data?.floors ?? [];
  const reservations = useReservations(branch.id).data?.reservations ?? [];
  const save = useSaveReservation();
  const editing = target.kind === 'edit' ? target.reservation : undefined;
  // The form's "now": times on offer and the days are from when it opened.
  const [now] = useState(() => new Date());
  const [form, setForm] = useState<ReservationForm>(() =>
    reservationForm(clock, now, editing, target.kind === 'new' ? target.table : undefined),
  );
  const [tried, setTried] = useState(false);
  const [taken, setTaken] = useState<string | null>(null);
  const set = (fields: Partial<ReservationForm>) => {
    setTaken(null);
    setForm((f) => ({ ...f, ...fields }));
  };

  const days = bookingDays(clock, now);
  if (!days.some((d) => d.key === form.day)) {
    days.push({ key: form.day, offset: dayOffset(clock, now, form.day) });
  }
  const slots = timeSlots(region, dayOffset(clock, now, form.day), now);
  // A booking being changed keeps its own time even if it's no longer on offer.
  if (form.at && clock.dayKey(form.at) === form.day && !slots.some((s) => sameTime(s, form.at))) {
    slots.unshift(form.at);
  }
  const areas = tableChoices(floors, reservations, form, editing?.id, now);
  const picked = areas.flatMap((a) => a.tables).filter((c) => form.tables.includes(c.table));
  const seats = picked.reduce((sum, c) => sum + c.seats, 0);
  const short = Math.max(0, form.partySize - seats);
  const suggested = suggestTables(areas, form.partySize);
  const sameAsSuggested =
    suggested.length === form.tables.length && suggested.every((n) => form.tables.includes(n));
  const errors = tried ? reservationErrors(form, region.mobile, seats) : {};

  /** A table tapped: on or off; one in another area starts the party again there. */
  const toggleTable = (table: number, areaId: string) => {
    if (form.tables.includes(table)) {
      set({ tables: form.tables.filter((n) => n !== table) });
      return;
    }
    const areaOf = (n: number) => areas.find((a) => a.tables.some((c) => c.table === n))?.id;
    const sameArea = form.tables.every((n) => areaOf(n) === areaId);
    if (!sameArea) set({ tables: [table] });
    else if (form.tables.length < MAX_TABLES) set({ tables: [...form.tables, table] });
  };

  const pickDay = (day: string) =>
    set({ day, at: form.at && clock.dayKey(form.at) === day ? form.at : '' });

  const submit = () => {
    setTried(true);
    if (Object.keys(reservationErrors(form, region.mobile, seats)).length > 0) return;
    if (picked.some((c) => c.clash)) return;
    save.mutate(
      { branchId: branch.id, id: editing?.id, body: reservationInput(form) },
      {
        onSuccess: (saved) => {
          showToast(
            editing
              ? t('adminReservations.toast.updated', { id: saved.id })
              : t('adminReservations.toast.created', {
                  tables: text.tables(saved.tables ?? [saved.table]),
                  name: saved.guestName,
                  time: clock.dateTime(saved.at),
                }),
            { tone: 'success' },
          );
          onClose();
        },
        onError: (error) => {
          const message = text.error(error, form.tables);
          if (isApiError(error, 'table_taken')) setTaken(message);
          else showToast(message, { tone: 'error' });
        },
      },
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={
        editing
          ? t('adminReservations.editor.editTitle', { id: editing.id })
          : t('adminReservations.editor.newTitle')
      }
      className={styles.editor}
      footer={
        <Button block iconStart="check" loading={save.isPending} onClick={submit}>
          {editing ? t('adminReservations.editor.saveChanges') : t('adminReservations.editor.save')}
        </Button>
      }
    >
      <div className={styles.form}>
        <section className={styles.section} aria-labelledby="res-guest">
          <h3 id="res-guest" className={styles.heading}>
            {t('adminReservations.editor.guest')}
          </h3>
          <div className={styles.twoUp}>
            <Input
              id="res-name"
              label={t('adminReservations.editor.name')}
              placeholder={t('adminReservations.editor.namePlaceholder')}
              autoComplete="off"
              maxLength={MAX_NAME}
              value={form.guestName}
              error={errors.guestName && t('adminReservations.editor.errors.name')}
              onChange={(event) => set({ guestName: event.target.value })}
            />
            <PhoneInput
              id="res-phone"
              label={t('adminReservations.editor.phone')}
              rules={region.mobile}
              value={form.phone}
              //hint={t('adminReservations.editor.phoneHint')}
              error={errors.phone && t(`adminReservations.editor.errors.${errors.phone}`)}
              showCountryCode={region.mobile.showDialCode}
              onChange={(phone) => set({ phone })}
            />
          </div>
          <div className={styles.party}>
            <span className={styles.label} id="res-party">
              {t('adminReservations.editor.party')}
            </span>
            <span className={styles.partyValue} aria-live="polite">
              {t.plural('adminReservations.editor.partyValue', form.partySize)}
            </span>
            <QuantityStepper
              value={form.partySize}
              min={1}
              max={MAX_PARTY}
              variant="outline"
              itemName={t('adminReservations.editor.guestItem')}
              onChange={(partySize) => set({ partySize })}
            />
          </div>
        </section>

        <section className={styles.section} aria-labelledby="res-when">
          <h3 id="res-when" className={styles.heading}>
            {t('adminReservations.editor.when')}
          </h3>
          <DayStrip
            days={days}
            value={form.day}
            range={bookingRange(clock, now)}
            label={t('adminReservations.editor.day')}
            compact
            onChange={pickDay}
          />
          <div className={styles.twoUp}>
            <Select
              id="res-time"
              label={t('adminReservations.editor.time')}
              icon="clock"
              value={slots.find((s) => sameTime(s, form.at)) ?? ''}
              error={
                slots.length === 0
                  ? t('adminReservations.editor.noTimes')
                  : errors.at && t('adminReservations.editor.errors.time')
              }
              disabled={slots.length === 0}
              onChange={(event) => set({ at: event.target.value })}
            >
              <option value="" disabled>
                {t('adminReservations.editor.timePlaceholder')}
              </option>
              {slots.map((slot) => (
                <option key={slot} value={slot}>
                  {clock.time(slot)}
                </option>
              ))}
            </Select>
            <div className={styles.lengthField}>
              <span className={styles.label} id="res-length">
                {t('adminReservations.editor.length')}
              </span>
              <div className={styles.chips} role="group" aria-labelledby="res-length">
                {DURATIONS.map((minutes) => (
                  <Chip
                    key={minutes}
                    pressed={form.minutes === minutes}
                    onClick={() => set({ minutes })}
                  >
                    {text.length(minutes)}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="table-picker-label">
          <div className={styles.headingRow}>
            <h3 id="table-picker-label" className={styles.heading}>
              {t('adminReservations.editor.table')}
            </h3>
            <p className={styles.hint}>
              {form.at
                ? t('adminReservations.editor.tableHint')
                : t('adminReservations.editor.pickTimeFirst')}
            </p>
          </div>
          <TablePicker
            areas={areas}
            value={form.tables}
            disabled={!form.at}
            error={
              taken ??
              (errors.table === 'seats'
                ? t('adminReservations.editor.errors.seats', { count: short })
                : errors.table && t('adminReservations.editor.errors.table'))
            }
            onToggle={toggleTable}
          />
          {form.at && (
            <div className={styles.seatsBar} data-short={short > 0 || undefined}>
              <div className={styles.seatsText}>
                <p className={styles.seatsCount} aria-live="polite">
                  {form.tables.length === 0
                    ? t('adminReservations.editor.seatsPicked', {
                        seats: 0,
                        party: form.partySize,
                      })
                    : short > 0
                      ? t('adminReservations.editor.seatsShort', {
                          seats,
                          count: short,
                          party: form.partySize,
                        })
                      : t('adminReservations.editor.seatsEnough', {
                          seats,
                          party: form.partySize,
                        })}
                </p>
                {form.tables.length > 0 && (
                  <p className={styles.seatsTables}>{text.tables(form.tables)}</p>
                )}
                <span className={styles.meter} aria-hidden="true">
                  <span style={{ width: `${Math.min(100, (seats / form.partySize) * 100)}%` }} />
                </span>
              </div>
              <div className={styles.seatsActions}>
                {suggested.length > 0 && !sameAsSuggested && (
                  <Button
                    size="sm"
                    variant={short > 0 ? 'primary' : 'secondary'}
                    iconStart="sparkle"
                    onClick={() => set({ tables: suggested })}
                  >
                    {t('adminReservations.editor.useSuggested', {
                      tables: text.tables(suggested),
                    })}
                  </Button>
                )}
                {form.tables.length > 0 && (
                  <button
                    type="button"
                    className={styles.clear}
                    onClick={() => set({ tables: [] })}
                  >
                    {t('adminReservations.editor.clearTables')}
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        <Textarea
          id="res-note"
          label={t('adminReservations.editor.note')}
          optional
          rows={2}
          maxLength={MAX_NOTE}
          placeholder={t('adminReservations.editor.notePlaceholder')}
          value={form.note}
          onChange={(event) => set({ note: event.target.value })}
        />
      </div>
    </Dialog>
  );
}

const sameTime = (a: string, b: string) => b !== '' && Date.parse(a) === Date.parse(b);
