'use client';

import { useState } from 'react';
import { isApiError } from '@/api/client';
import { useContent, useRotaWeek } from '@/api/hooks';
import { useRotaWeekAction, useSaveRotaShift } from '@/api/mutations';
import { Button, Chip, Dialog, Icon, IconButton } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useNow } from '@/hooks/useNow';
import { cx } from '@/lib/cx';
import {
  addDays,
  coverageByDay,
  minutesByPerson,
  mondayOf,
  overnight,
  spanLabel,
} from '@/lib/rota';
import type { RotaPerson, RotaShift, RotaWeekResponse, ShiftType } from '@/types/admin';
import { OptionsList } from '../OptionsList';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { SettingsNote, SettingsSkeleton } from '../settings/shared/SettingsEditor';
import editor from '../settings/shared/SettingsEditor.module.css';
import { RotaShiftDialog, ShiftTypesDialog } from './RotaDialogs';
import { RotaSettingsDialog, WhatsAppDialog } from './RotaExtras';
import { useDuration } from './useDuration';
import styles from './RotaPlanner.module.css';
import tones from './shiftTones.module.css';

type Open =
  | { kind: 'shift'; person: RotaPerson; day: string; shift?: RotaShift }
  | { kind: 'types' }
  | { kind: 'settings' }
  | { kind: 'more' }
  | { kind: 'whatsapp' }
  | { kind: 'clear' }
  | { kind: 'publish' }
  | null;

const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' });
const dayNumber = new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: 'UTC' });
const atNoon = (day: string) => new Date(`${day}T12:00:00Z`);

/**
 * Team › Rota (`rota.plan`): a week, Monday to Sunday, person by person — tap a day to plan
 * their shift (a shift type, or hours of its own), each person's hours in the week (a warning
 * over the limit), how many are on each day. Above it, where the week stands in one sentence
 * (nothing yet, not published, published, changed since) and the one thing to do next (Copy
 * last week, Publish, Publish changes, Send on WhatsApp); the rest under More. A new week shows
 * three steps. On a phone, one day at a time.
 */
export function RotaPlanner() {
  const t = useContent('common');
  const { branch, clock } = useAdminWorkspace();
  const { showToast } = useToast();
  const now = useNow(60_000);
  const today = clock.dayKey(now ?? new Date());
  const [week, setWeek] = useState<string | null>(null);
  const shown = week ?? mondayOf(today);
  const query = useRotaWeek(branch.id, shown);
  const action = useRotaWeekAction();
  const save = useSaveRotaShift();
  const [open, setOpen] = useState<Open>(null);
  const [phoneDay, setPhoneDay] = useState<string | null>(null);

  const failed = (error?: unknown) =>
    showToast(
      isApiError(error, 'shift_type_exists')
        ? t('adminSettings.rota.toast.typeExists')
        : t('adminSettings.rota.toast.failed'),
      { tone: 'error' },
    );
  const hours = useDuration();

  if (query.isError && !query.data) {
    return (
      <div className={editor.page}>
        <SettingsNote tone="warn">{t('adminSettings.rota.failed')}</SettingsNote>
        <Button variant="secondary" onClick={() => void query.refetch()}>
          {t('adminSettings.rota.retry')}
        </Button>
      </div>
    );
  }
  const data: RotaWeekResponse | undefined = query.data;
  if (!data) return <SettingsSkeleton label={t('adminSettings.rota.loading')} />;

  const typeOf = (id?: string): ShiftType | undefined => data.types.find((ty) => ty.id === id);
  const shiftOf = (person: string, day: string) =>
    data.shifts.find((s) => s.staffId === person && s.day === day);
  const totals = minutesByPerson(data.shifts);
  const coverage = coverageByDay(data.shifts, data.days);
  const changes = data.shifts.filter((s) => s.changed).length;
  const activeDay =
    phoneDay && data.days.includes(phoneDay)
      ? phoneDay
      : (data.days.find((d) => d === today) ?? data.days[0] ?? shown);
  const dayLabel = (day: string) =>
    `${weekday.format(atNoon(day))} ${dayNumber.format(atNoon(day))}`;

  const weekAction = (kind: 'copy' | 'clear' | 'publish') =>
    action.mutate(
      { branchId: branch.id, action: kind, week: data.week },
      {
        onSuccess: (next) => {
          setOpen(null);
          const key =
            kind === 'copy'
              ? next.shifts.length > data.shifts.length
                ? 'copied'
                : 'nothingToCopy'
              : kind === 'clear'
                ? 'cleared'
                : 'published';
          showToast(t(`adminSettings.rota.toast.${key}`), {
            tone: key === 'nothingToCopy' ? 'info' : 'success',
          });
          // Published: offer to send each person their week on WhatsApp.
          if (kind === 'publish') setOpen({ kind: 'whatsapp' });
        },
        onError: failed,
      },
    );

  /** Time off covering someone's day: approved first, else asked for. */
  const offOn = (person: string, day: string) => {
    const on = data.timeOff.filter((r) => r.staff.id === person && r.from <= day && r.to >= day);
    return on.find((r) => r.status === 'approved') ?? on[0];
  };

  const cell = (person: RotaPerson, day: string) => {
    const shift = shiftOf(person.id, day);
    const off = offOn(person.id, day);
    const type = typeOf(shift?.typeId);
    const label = { name: person.name, day: clock.date(atNoon(day)) };
    if (!shift) {
      return (
        <button
          type="button"
          className={styles.empty}
          aria-label={
            off
              ? `${t('adminSettings.rota.add', label)} (${t(`adminSettings.rota.timeOff.${off.status === 'approved' ? 'approved' : 'pending'}`)})`
              : t('adminSettings.rota.add', label)
          }
          data-off={off?.status}
          onClick={() => setOpen({ kind: 'shift', person, day })}
        >
          {off ? (
            <span className={styles.offLabel}>
              {t(
                `adminSettings.rota.timeOff.${off.status === 'approved' ? 'approved' : 'pending'}`,
              )}
            </span>
          ) : (
            <Icon name="plus" size="xs" />
          )}
        </button>
      );
    }
    const time = spanLabel(shift.startsAt, shift.endsAt);
    const marked = Boolean(shift.note || shift.swappedFrom || shift.changed);
    return (
      <button
        type="button"
        className={cx(
          styles.shift,
          tones[type?.color ?? 'none'],
          off?.status === 'approved' && styles.clash,
        )}
        aria-label={[
          t('adminSettings.rota.edit', { ...label, time }),
          overnight(shift.startsAt, shift.endsAt) && t('adminSettings.rota.overnight'),
          shift.note,
          shift.swappedFrom && t('adminSettings.rota.swappedFrom', { name: shift.swappedFrom }),
          shift.changed && t('adminSettings.rota.changed'),
        ]
          .filter(Boolean)
          .join('. ')}
        title={
          [
            shift.note,
            shift.swappedFrom && t('adminSettings.rota.swappedFrom', { name: shift.swappedFrom }),
            shift.changed && t('adminSettings.rota.changed'),
          ]
            .filter(Boolean)
            .join(' · ') || undefined
        }
        onClick={() => setOpen({ kind: 'shift', person, day, shift })}
      >
        {/* Small marks (the words are in the box's name and on opening it). */}
        <span className={styles.marks} aria-hidden="true">
          {shift.note && <Icon name="msg" size="xs" />}
          {shift.swappedFrom && <Icon name="swap" size="xs" />}
          {shift.changed && <span className={styles.changedDot} />}
        </span>
        {type && (
          <span className={cx(styles.shiftName, marked && styles.withMarks)}>{type.name}</span>
        )}
        <span className={cx(styles.shiftTime, !type && marked && styles.withMarks)}>
          {time}
          {overnight(shift.startsAt, shift.endsAt) && ' ⁺¹'}
        </span>
        {off?.status === 'approved' && (
          <span className={styles.clashNote}>{t('adminSettings.rota.timeOff.clash')}</span>
        )}
      </button>
    );
  };

  const total = (person: RotaPerson) => {
    const minutes = totals.get(person.id) ?? 0;
    const limit = data.weekHoursLimit;
    const over = limit !== null && minutes > limit * 60;
    return (
      <span
        className={cx(styles.total, over && styles.over)}
        title={over ? t('adminSettings.rota.overLimit', { limit: limit ?? 0 }) : undefined}
      >
        {minutes > 0 ? hours(minutes) : '–'}
        {over && (
          <>
            <Icon name="alert" size="xs" />
            <span className="visually-hidden">
              {t('adminSettings.rota.overLimit', { limit: limit ?? 0 })}
            </span>
          </>
        )}
      </span>
    );
  };

  // Where the week stands, in one sentence, and the one thing to do next.
  const stage: 'empty' | 'draft' | 'changed' | 'published' =
    data.shifts.length === 0
      ? 'empty'
      : !data.publishedAt
        ? 'draft'
        : changes > 0
          ? 'changed'
          : 'published';
  const statusText =
    stage === 'changed'
      ? t.plural('adminTeam.rota.status.changed', changes)
      : t(`adminTeam.rota.status.${stage}`);
  const publishedLine =
    data.publishedAt &&
    (data.publishedBy
      ? t('adminSettings.rota.published', {
          date: clock.dateTime(data.publishedAt),
          name: data.publishedBy,
        })
      : t('adminSettings.rota.publishedOn', { date: clock.dateTime(data.publishedAt) }));
  const next =
    stage === 'empty' ? (
      <Button
        size="sm"
        iconStart="copy"
        loading={action.isPending && action.variables?.action === 'copy'}
        onClick={() => weekAction('copy')}
      >
        {t('adminSettings.rota.copy')}
      </Button>
    ) : stage === 'published' ? (
      <Button
        size="sm"
        variant="secondary"
        iconStart="whatsapp"
        onClick={() => setOpen({ kind: 'whatsapp' })}
      >
        {t('adminSettings.rota.whatsapp.button')}
      </Button>
    ) : (
      <Button size="sm" iconStart="check" onClick={() => setOpen({ kind: 'publish' })}>
        {stage === 'changed' ? t('adminTeam.rota.publishChanges') : t('adminSettings.rota.publish')}
      </Button>
    );

  /** More: the things done now and then, each with a line on what it does. */
  const more: {
    key: string;
    icon: 'copy' | 'trash' | 'clock' | 'sliders' | 'whatsapp';
    run: () => void;
    danger?: boolean;
  }[] = [
    ...(stage !== 'empty'
      ? [{ key: 'copy', icon: 'copy' as const, run: () => weekAction('copy') }]
      : []),
    { key: 'types', icon: 'clock', run: () => setOpen({ kind: 'types' }) },
    { key: 'limit', icon: 'sliders', run: () => setOpen({ kind: 'settings' }) },
    ...(data.publishedAt && stage !== 'published' && data.shifts.length > 0
      ? [{ key: 'whatsapp', icon: 'whatsapp' as const, run: () => setOpen({ kind: 'whatsapp' }) }]
      : []),
    ...(data.shifts.length > 0
      ? [
          {
            key: 'clear',
            icon: 'trash' as const,
            run: () => setOpen({ kind: 'clear' }),
            danger: true,
          },
        ]
      : []),
  ];

  return (
    <div className={editor.page}>
      <p className={styles.lead}>{t('adminTeam.rota.lead')}</p>

      <section className={editor.card} aria-labelledby="rota-week">
        <div className={styles.toolbar}>
          <div className={styles.weekNav}>
            <IconButton
              icon="back"
              label={t('adminSettings.rota.prevWeek')}
              variant="raised"
              size="sm"
              onClick={() => setWeek(addDays(data.week, -7))}
            />
            <h2 id="rota-week" className={styles.weekTitle}>
              {t('adminSettings.rota.weekLabel', { date: clock.date(atNoon(data.week)) })}
            </h2>
            <IconButton
              icon="arrow"
              label={t('adminSettings.rota.nextWeek')}
              variant="raised"
              size="sm"
              onClick={() => setWeek(addDays(data.week, 7))}
            />
            {data.week !== mondayOf(today) && (
              <Button size="sm" variant="ghost" onClick={() => setWeek(null)}>
                {t('adminSettings.rota.thisWeek')}
              </Button>
            )}
          </div>
          <div className={styles.actions}>
            {next}
            <Button
              size="sm"
              variant="secondary"
              iconStart="dots"
              onClick={() => setOpen({ kind: 'more' })}
            >
              {t('adminTeam.rota.more')}
            </Button>
          </div>
        </div>
        <p className={styles.statusLine} data-stage={stage}>
          <span className={styles.statusDot} aria-hidden="true" />
          <span>
            <strong>{statusText}</strong>
            {publishedLine && <span className={styles.statusMeta}>{publishedLine}</span>}
          </span>
        </p>

        {data.staff.length === 0 ? (
          <SettingsNote tone="info">{t('adminSettings.rota.noStaff')}</SettingsNote>
        ) : (
          <>
            {stage === 'empty' && (
              <ol className={styles.steps} aria-label={t('adminTeam.rota.steps.label')}>
                {(['types', 'fill', 'publish'] as const).map((step, i) => (
                  <li key={step} className={styles.step}>
                    <span className={styles.stepNumber}>{i + 1}</span>
                    <span className={styles.stepText}>
                      <strong>{t(`adminTeam.rota.steps.${step}.title`)}</strong>
                      <span>{t(`adminTeam.rota.steps.${step}.body`)}</span>
                    </span>
                    {step === 'types' && (
                      <Button
                        size="sm"
                        variant={data.types.length === 0 ? 'primary' : 'secondary'}
                        iconStart="clock"
                        onClick={() => setOpen({ kind: 'types' })}
                      >
                        {data.types.length === 0
                          ? t('adminTeam.rota.steps.types.action')
                          : t('adminTeam.rota.steps.types.edit')}
                      </Button>
                    )}
                  </li>
                ))}
              </ol>
            )}

            {/* Tablet and desktop: the whole week. */}
            <div className={styles.gridWrap}>
              <table className={styles.grid}>
                <thead>
                  <tr>
                    <th scope="col" className={styles.personHead}>
                      {t('adminSettings.rota.person')}
                    </th>
                    {data.days.map((day) => (
                      <th
                        key={day}
                        scope="col"
                        className={cx(styles.dayHead, day === today && styles.today)}
                      >
                        {dayLabel(day)}
                      </th>
                    ))}
                    <th scope="col" className={styles.totalHead}>
                      {t('adminSettings.rota.total')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.staff.map((person) => (
                    <tr key={person.id}>
                      <th scope="row" className={styles.person}>
                        <span className={styles.personName}>{person.name}</span>
                        <span className={styles.personRole}>{person.role}</span>
                      </th>
                      {data.days.map((day) => (
                        <td key={day} className={cx(styles.cell, day === today && styles.today)}>
                          {cell(person, day)}
                        </td>
                      ))}
                      <td className={styles.totalCell}>{total(person)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" className={styles.person}>
                      {t('adminSettings.rota.coverage')}
                    </th>
                    {coverage.map((c) => (
                      <td key={c.day} className={cx(styles.coverage, c.people === 0 && styles.gap)}>
                        <span>
                          {c.people === 0
                            ? t('adminSettings.rota.nobody')
                            : t.plural('adminSettings.rota.people', c.people)}
                        </span>
                        {c.minutes > 0 && (
                          <span className={styles.coverageHours}>{hours(c.minutes)}</span>
                        )}
                      </td>
                    ))}
                    <td className={styles.totalCell}>
                      {hours(data.shifts.reduce((sum, s) => sum + s.minutes, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Phone: one day at a time. */}
            <div className={styles.phone}>
              <div
                className={styles.dayChips}
                role="group"
                aria-label={t('adminSettings.rota.dayPicker')}
              >
                {coverage.map((c) => (
                  <Chip
                    key={c.day}
                    pressed={c.day === activeDay}
                    count={c.people}
                    onClick={() => setPhoneDay(c.day)}
                  >
                    {dayLabel(c.day)}
                  </Chip>
                ))}
              </div>
              <ul className={styles.dayList}>
                {data.staff.map((person) => (
                  <li key={person.id} className={styles.dayRow}>
                    <span className={styles.person}>
                      <span className={styles.personName}>{person.name}</span>
                      <span className={styles.personRole}>
                        {person.role} · {t('adminSettings.rota.total')}: {total(person)}
                      </span>
                    </span>
                    <span className={styles.dayCell}>{cell(person, activeDay)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </section>

      {open?.kind === 'shift' && (
        <RotaShiftDialog
          person={open.person}
          day={open.day}
          dayLabel={clock.date(atNoon(open.day))}
          shift={open.shift}
          types={data.types}
          timeOff={offOn(open.person.id, open.day)}
          saving={save.isPending}
          onClose={() => setOpen(null)}
          onSave={(body) =>
            save.mutate(
              { branchId: branch.id, body: { ...body, staffId: open.person.id, day: open.day } },
              {
                onSuccess: () => {
                  setOpen(null);
                  showToast(t('adminSettings.rota.toast.saved'), { tone: 'success' });
                },
                onError: failed,
              },
            )
          }
          onRemove={
            open.shift
              ? () =>
                  save.mutate(
                    { branchId: branch.id, remove: open.shift?.id ?? '' },
                    {
                      onSuccess: () => {
                        setOpen(null);
                        showToast(t('adminSettings.rota.toast.removed'), { tone: 'success' });
                      },
                      onError: failed,
                    },
                  )
              : undefined
          }
        />
      )}
      {open?.kind === 'more' && (
        <Dialog
          open
          onClose={() => setOpen(null)}
          presentation="adaptive"
          title={t('adminTeam.rota.moreTitle')}
          className={styles.dialog}
        >
          <OptionsList
            items={more.map((m) => ({
              key: m.key,
              icon: m.icon,
              title: t(`adminTeam.rota.moreItems.${m.key as 'copy'}.title`),
              body: t(`adminTeam.rota.moreItems.${m.key as 'copy'}.body`),
              danger: m.danger,
              onSelect: () => {
                setOpen(null);
                m.run();
              },
            }))}
          />
        </Dialog>
      )}
      {open?.kind === 'settings' && (
        <RotaSettingsDialog
          limit={data.weekHoursLimit}
          onClose={() => setOpen(null)}
          onFailed={failed}
        />
      )}
      {open?.kind === 'whatsapp' && <WhatsAppDialog week={data} onClose={() => setOpen(null)} />}
      {open?.kind === 'types' && (
        <ShiftTypesDialog types={data.types} onClose={() => setOpen(null)} onFailed={failed} />
      )}
      {(open?.kind === 'clear' || open?.kind === 'publish') && (
        <Dialog
          open
          onClose={() => setOpen(null)}
          presentation="adaptive"
          title={t(
            `adminSettings.rota.${open.kind === 'clear' ? 'confirmClear' : 'confirmPublish'}.title`,
          )}
          footer={
            <div className={styles.confirmActions}>
              <Button variant="secondary" onClick={() => setOpen(null)}>
                {t('adminSettings.rota.cancel')}
              </Button>
              <Button
                className={open.kind === 'clear' ? styles.danger : undefined}
                iconStart={open.kind === 'clear' ? 'trash' : 'check'}
                loading={action.isPending}
                onClick={() => weekAction(open.kind === 'clear' ? 'clear' : 'publish')}
              >
                {t(
                  `adminSettings.rota.${open.kind === 'clear' ? 'confirmClear' : 'confirmPublish'}.confirm`,
                )}
              </Button>
            </div>
          }
        >
          <p className="t-small c2">
            {t(
              `adminSettings.rota.${open.kind === 'clear' ? 'confirmClear' : 'confirmPublish'}.body`,
            )}
          </p>
        </Dialog>
      )}
    </div>
  );
}
