'use client';

import { useContent } from '@/api/hooks';
import { Button, IconButton, Input, Select, Tag } from '@/components/ui';
import { useNow } from '@/hooks/useNow';
import { isTime, toMinutes, weekdayAt } from '@/lib/branchHours';
import { LIMITS, hoursErrors } from '@/lib/branchSettings';
import { cx } from '@/lib/cx';
import { WEEKDAYS, type DayHours, type OpeningSchedule, type Weekday } from '@/types/branch';
import { useAdminWorkspace } from '../../shell/AdminWorkspace';
import { SettingsCard, SettingsEditor, SettingsNote } from '../shared/SettingsEditor';
import styles from './OpeningHoursEditor.module.css';

/** Last orders: this many minutes before closing. */
const LAST_ORDERS = [0, 15, 30, 45, 60, 90, 120] as const;

/** A new service window starts like this (staff name it and set its times). */
const NEW_WINDOW = { label: '', from: '12:00', to: '15:00' };

const dayProblem = (d: DayHours) =>
  d.open && (!isTime(d.opens) || !isTime(d.closes) || toMinutes(d.closes) <= toMinutes(d.opens));

/**
 * Settings › Opening hours: each day of the week open (from, to) or closed, when the kitchen
 * takes its last order, and the service windows guests are told about (Lunch, Dinner). Guests
 * see today's hours; on a closed day the branch shows as closed until its next opening day.
 */
export function OpeningHoursEditor() {
  const t = useContent('common');
  const { region } = useAdminWorkspace();
  const now = useNow(60_000);
  const today = now ? weekdayAt(now, region.timezone) : null;

  return (
    <SettingsEditor
      section="hours"
      title={t('adminSettings.sections.hours.title')}
      subtitle={t('adminSettings.hours.subtitle')}
      check={hoursErrors}
    >
      {({ value, set }) => {
        const setDay = (day: Weekday, next: Partial<DayHours>) =>
          set({ ...value, days: { ...value.days, [day]: { ...value.days[day], ...next } } });
        const copyToAll = (day: Weekday) =>
          set({
            ...value,
            days: Object.fromEntries(
              WEEKDAYS.map((d) => [d, { ...value.days[day] }]),
            ) as OpeningSchedule['days'],
          });
        const setWindow = (index: number, next: Partial<OpeningSchedule['windows'][number]>) =>
          set({
            ...value,
            windows: value.windows.map((w, i) => (i === index ? { ...w, ...next } : w)),
          });
        const firstOpen = WEEKDAYS.find((d) => value.days[d].open);

        return (
          <>
            <SettingsCard
              title={t('adminSettings.hours.week')}
              hint={t('adminSettings.hours.weekHint')}
              action={
                firstOpen && (
                  <Button
                    variant="secondary"
                    size="sm"
                    iconStart="swap"
                    onClick={() => copyToAll(firstOpen)}
                  >
                    {t('adminSettings.hours.copyAll', {
                      day: t(`adminSettings.hours.days.${firstOpen}`),
                    })}
                  </Button>
                )
              }
            >
              <ul className={styles.days}>
                {WEEKDAYS.map((day) => {
                  const hours = value.days[day];
                  const name = t(`adminSettings.hours.days.${day}`);
                  const problem = dayProblem(hours);
                  return (
                    <li key={day} className={cx(styles.day, !hours.open && styles.closed)}>
                      <div className={styles.dayName}>
                        <span>{name}</span>
                        {day === today && (
                          <Tag variant="plain" icon={null}>
                            {t('adminSettings.hours.today')}
                          </Tag>
                        )}
                      </div>
                      <label className={styles.dayOpen}>
                        <input
                          type="checkbox"
                          role="switch"
                          className={styles.switch}
                          checked={hours.open}
                          aria-label={t('adminSettings.hours.openOn', { day: name })}
                          onChange={(event) => setDay(day, { open: event.target.checked })}
                        />
                        <span>
                          {hours.open
                            ? t('adminSettings.hours.open')
                            : t('adminSettings.hours.closed')}
                        </span>
                      </label>
                      {hours.open && (
                        <div className={styles.times}>
                          <Input
                            id={`opens-${day}`}
                            type="time"
                            step={300}
                            label={t('adminSettings.hours.opensOn', { day: name })}
                            hideLabel
                            value={hours.opens}
                            error={problem ? t('adminSettings.errors.dayOrder') : undefined}
                            onChange={(event) => setDay(day, { opens: event.target.value })}
                          />
                          <span className={styles.to} aria-hidden="true">
                            –
                          </span>
                          <Input
                            id={`closes-${day}`}
                            type="time"
                            step={300}
                            label={t('adminSettings.hours.closesOn', { day: name })}
                            hideLabel
                            value={hours.closes}
                            onChange={(event) => setDay(day, { closes: event.target.value })}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <SettingsNote>{t('adminSettings.hours.closedNote')}</SettingsNote>
            </SettingsCard>

            <SettingsCard
              title={t('adminSettings.hours.lastOrders')}
              hint={t('adminSettings.hours.lastOrdersHint')}
            >
              <Select
                id="last-orders"
                label={t('adminSettings.hours.lastOrdersLabel')}
                value={String(value.lastOrdersMinutes)}
                onChange={(event) =>
                  set({ ...value, lastOrdersMinutes: Number(event.target.value) })
                }
              >
                {LAST_ORDERS.map((m) => (
                  <option key={m} value={m}>
                    {m === 0
                      ? t('adminSettings.hours.atClosing')
                      : t('adminSettings.hours.beforeClosing', { minutes: m })}
                  </option>
                ))}
              </Select>
            </SettingsCard>

            <SettingsCard
              title={t('adminSettings.hours.windows')}
              hint={t('adminSettings.hours.windowsHint')}
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  iconStart="plus"
                  disabled={value.windows.length >= LIMITS.windows}
                  onClick={() => set({ ...value, windows: [...value.windows, { ...NEW_WINDOW }] })}
                >
                  {t('adminSettings.hours.addWindow')}
                </Button>
              }
            >
              {value.windows.length === 0 ? (
                <p className={styles.empty}>{t('adminSettings.hours.noWindows')}</p>
              ) : (
                <ul className={styles.windows}>
                  {value.windows.map((w, i) => {
                    const name = w.label.trim() || t('adminSettings.hours.windowN', { n: i + 1 });
                    const order =
                      isTime(w.from) && isTime(w.to) && toMinutes(w.to) <= toMinutes(w.from);
                    return (
                      // Windows have no id; their place in the list is theirs while editing.
                      <li key={i} className={styles.window}>
                        <Input
                          id={`window-${i}-label`}
                          label={t('adminSettings.hours.windowLabel')}
                          placeholder={t('adminSettings.hours.windowPlaceholder')}
                          value={w.label}
                          maxLength={LIMITS.windowLabel + 10}
                          error={
                            !w.label.trim() ? t('adminSettings.errors.windowLabel') : undefined
                          }
                          onChange={(event) => setWindow(i, { label: event.target.value })}
                        />
                        <Input
                          id={`window-${i}-from`}
                          type="time"
                          step={300}
                          label={t('adminSettings.hours.from')}
                          value={w.from}
                          error={order ? t('adminSettings.errors.windowOrder') : undefined}
                          onChange={(event) => setWindow(i, { from: event.target.value })}
                        />
                        <Input
                          id={`window-${i}-to`}
                          type="time"
                          step={300}
                          label={t('adminSettings.hours.to')}
                          value={w.to}
                          onChange={(event) => setWindow(i, { to: event.target.value })}
                        />
                        <IconButton
                          icon="trash"
                          variant="soft"
                          size="sm"
                          className={styles.remove}
                          label={t('adminSettings.hours.removeWindow', { name })}
                          onClick={() =>
                            set({ ...value, windows: value.windows.filter((_, j) => j !== i) })
                          }
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </SettingsCard>
          </>
        );
      }}
    </SettingsEditor>
  );
}
