'use client';

import { useContent } from '@/api/hooks';
import { Button, IconButton, Input, Select, Tag } from '@/components/ui';
import { useNow } from '@/hooks/useNow';
import { weekdayAt } from '@/lib/branchHours';
import { LIMITS, hoursErrors } from '@/lib/branchSettings';
import { cx } from '@/lib/cx';
import {
  WEEKDAYS,
  type OpeningSchedule,
  type Session,
  type SpecialDay,
  type WeekSessions,
} from '@/types/branch';
import { useAdminWorkspace } from '../../shell/AdminWorkspace';
import { SettingsCard, SettingsEditor, SettingsNote } from '../shared/SettingsEditor';
import { SessionsEditor, WeekEditor } from './SessionsEditor';
import styles from './OpeningHoursEditor.module.css';

/** Last orders: this many minutes before each session closes. */
const LAST_ORDERS = [0, 15, 30, 45, 60, 90, 120] as const;

/** A day opened without another to copy starts like this. */
const NEW_SESSION: Session = { opens: '11:00', closes: '21:00' };

/** Takeaway and delivery: the ways of ordering that can keep hours of their own. */
const OWN_HOURS = ['takeaway', 'delivery'] as const;

const copyWeek = (week: WeekSessions) =>
  Object.fromEntries(WEEKDAYS.map((d) => [d, week[d].map((s) => ({ ...s }))])) as WeekSessions;

/**
 * Settings › Opening hours: the week's sessions (lunch, dinner; one may run past midnight or all
 * day; a day without any is closed), when before each closes the kitchen takes its last order,
 * takeaway's and delivery's own hours (or the opening hours), and special dates (holidays,
 * festivals) that replace the week for every way of ordering. Guests can order inside a session
 * until its last orders; otherwise the branch shows as closed until the next one.
 */
export function OpeningHoursEditor() {
  const t = useContent('common');
  const { region, clock } = useAdminWorkspace();
  const now = useNow(60_000);
  const today = now ? weekdayAt(now, region.timezone) : null;
  const todayKey = now ? clock.dayKey(now) : null;

  return (
    <SettingsEditor
      section="hours"
      title={t('adminSettings.sections.hours.title')}
      subtitle={t('adminSettings.hours.subtitle')}
      check={hoursErrors}
    >
      {({ value, set }) => {
        const firstOpen = WEEKDAYS.find((d) => value.days[d].length > 0);
        /** A day opened again starts with the first open day's sessions. */
        const opening = () =>
          firstOpen ? value.days[firstOpen].map((s) => ({ ...s })) : [{ ...NEW_SESSION }];
        const setSpecial = (index: number, next: Partial<SpecialDay>) =>
          set({
            ...value,
            specialDays: value.specialDays.map((d, i) => (i === index ? { ...d, ...next } : d)),
          });

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
                    onClick={() => {
                      const sessions = value.days[firstOpen];
                      set({
                        ...value,
                        days: Object.fromEntries(
                          WEEKDAYS.map((d) => [d, sessions.map((s) => ({ ...s }))]),
                        ) as OpeningSchedule['days'],
                      });
                    }}
                  >
                    {t('adminSettings.hours.copyAll', {
                      day: t(`adminSettings.hours.days.${firstOpen}`),
                    })}
                  </Button>
                )
              }
            >
              <WeekEditor
                value={value.days}
                onChange={(days) => set({ ...value, days })}
                idPrefix="opening"
                today={today}
                opening={opening}
              />
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

            {OWN_HOURS.some((m) => region.modes[m].enabled) && (
              <SettingsCard
                title={t('adminSettings.hours.modes')}
                hint={t('adminSettings.hours.modesHint')}
              >
                {OWN_HOURS.filter((m) => region.modes[m].enabled).map((mode) => {
                  const week = value[mode];
                  const name = t(`modes.${mode}`);
                  return (
                    <div key={mode} className={styles.mode}>
                      <label className={styles.dayOpen}>
                        <input
                          type="checkbox"
                          role="switch"
                          className={styles.switch}
                          checked={week === null}
                          onChange={(event) =>
                            set({
                              ...value,
                              [mode]: event.target.checked ? null : copyWeek(value.days),
                            })
                          }
                        />
                        <span>
                          {week === null
                            ? `${name}: ${t('adminSettings.hours.sameAsOpening')}`
                            : t('adminSettings.hours.modeHours', { mode: name })}
                        </span>
                      </label>
                      {week && (
                        <WeekEditor
                          value={week}
                          onChange={(next) => set({ ...value, [mode]: next })}
                          idPrefix={mode}
                          today={today}
                          opening={opening}
                        />
                      )}
                    </div>
                  );
                })}
              </SettingsCard>
            )}

            <SettingsCard
              title={t('adminSettings.hours.special')}
              hint={t('adminSettings.hours.specialHint')}
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  iconStart="plus"
                  disabled={!todayKey || value.specialDays.length >= LIMITS.specialDays}
                  onClick={() =>
                    todayKey &&
                    set({
                      ...value,
                      specialDays: [
                        ...value.specialDays,
                        { from: todayKey, to: todayKey, sessions: [] },
                      ],
                    })
                  }
                >
                  {t('adminSettings.hours.addSpecial')}
                </Button>
              }
            >
              {value.specialDays.length === 0 ? (
                <p className={styles.empty}>{t('adminSettings.hours.noSpecial')}</p>
              ) : (
                <ul className={styles.specials}>
                  {value.specialDays.map((d, i) => {
                    const n = i + 1;
                    const closed = d.sessions.length === 0;
                    const past = todayKey !== null && d.to < todayKey;
                    const name = d.label?.trim() || t('adminSettings.hours.special');
                    return (
                      // Special dates have no id; their place in the list is theirs while editing.
                      <li key={i} className={cx(styles.special, closed && styles.closed)}>
                        <div className={styles.specialHead}>
                          <Input
                            id={`special-${i}-label`}
                            label={t('adminSettings.hours.specialName')}
                            placeholder={t('adminSettings.hours.specialPlaceholder')}
                            value={d.label ?? ''}
                            maxLength={LIMITS.specialLabel}
                            onChange={(event) => setSpecial(i, { label: event.target.value })}
                          />
                          <Input
                            id={`special-${i}-from`}
                            type="date"
                            label={t('adminSettings.hours.specialFrom')}
                            value={d.from}
                            onChange={(event) =>
                              setSpecial(i, {
                                from: event.target.value,
                                // A single day by default: the end follows an earlier one.
                                ...(d.to < event.target.value ? { to: event.target.value } : {}),
                              })
                            }
                          />
                          <Input
                            id={`special-${i}-to`}
                            type="date"
                            label={t('adminSettings.hours.specialTo')}
                            value={d.to}
                            onChange={(event) => setSpecial(i, { to: event.target.value })}
                          />
                          <IconButton
                            icon="trash"
                            variant="soft"
                            size="sm"
                            className={styles.remove}
                            label={t('adminSettings.hours.removeSpecial', { n })}
                            onClick={() =>
                              set({
                                ...value,
                                specialDays: value.specialDays.filter((_, j) => j !== i),
                              })
                            }
                          />
                        </div>
                        <div className={styles.specialState}>
                          <label className={styles.dayOpen}>
                            <input
                              type="checkbox"
                              role="switch"
                              className={styles.switch}
                              checked={!closed}
                              aria-label={t('adminSettings.hours.openOn', { day: name })}
                              onChange={(event) =>
                                setSpecial(i, { sessions: event.target.checked ? opening() : [] })
                              }
                            />
                            <span>
                              {closed
                                ? t('adminSettings.hours.specialClosed')
                                : t('adminSettings.hours.open')}
                            </span>
                          </label>
                          {past && (
                            <Tag variant="plain" icon={null}>
                              {t('adminSettings.hours.past')}
                            </Tag>
                          )}
                        </div>
                        {!closed && (
                          <SessionsEditor
                            sessions={d.sessions}
                            onChange={(sessions) => setSpecial(i, { sessions })}
                            idPrefix={`special-${i}`}
                            dayName={name}
                          />
                        )}
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
