'use client';

import { useState } from 'react';
import { useContent } from '@/api/hooks';
import { useRotaSettings } from '@/api/mutations';
import { Button, Dialog, Input } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { overnight, rotaMessage, spanLabel } from '@/lib/rota';
import type { RotaWeekResponse } from '@/types/admin';
import { ToggleRow } from '../settings/shared/SettingsEditor';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './RotaPlanner.module.css';

const atNoon = (day: string) => new Date(`${day}T12:00:00Z`);

/** Rota settings: the weekly hours warning (on, at how many hours, or off). */
export function RotaSettingsDialog({
  limit,
  onClose,
  onFailed,
}: {
  limit: number | null;
  onClose: () => void;
  onFailed: (error: unknown) => void;
}) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const { showToast } = useToast();
  const save = useRotaSettings();
  const [on, setOn] = useState(limit !== null);
  const [hours, setHours] = useState(String(limit ?? 48));
  const value = Number(hours);
  const invalid = on && (!Number.isInteger(value) || value < 1 || value > 168);
  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminSettings.rota.settings.title')}
      className={styles.dialog}
      footer={
        <Button
          block
          iconStart="check"
          loading={save.isPending}
          disabled={invalid}
          onClick={() =>
            save.mutate(
              { branchId: branch.id, weekHoursLimit: on ? value : null },
              {
                onSuccess: () => {
                  onClose();
                  showToast(t('adminSettings.rota.settings.saved'), { tone: 'success' });
                },
                onError: onFailed,
              },
            )
          }
        >
          {t('adminSettings.rota.settings.save')}
        </Button>
      }
    >
      <div className={styles.form}>
        <ToggleRow
          id="rota-limit-on"
          label={t('adminSettings.rota.settings.limit')}
          hint={t('adminSettings.rota.settings.limitHint')}
          checked={on}
          onChange={setOn}
        />
        {on && (
          <Input
            id="rota-limit"
            type="number"
            inputMode="numeric"
            min={1}
            max={168}
            label={t('adminSettings.rota.settings.hours')}
            value={hours}
            error={invalid ? t('adminSettings.rota.settings.hoursInvalid') : undefined}
            onChange={(event) => setHours(event.target.value)}
          />
        )}
      </div>
    </Dialog>
  );
}

/**
 * Send on WhatsApp: everyone with shifts this week, each a tap that opens WhatsApp with their
 * week ready to send (from the planner's own phone or WhatsApp Web; nothing is sent for them).
 */
export function WhatsAppDialog({ week, onClose }: { week: RotaWeekResponse; onClose: () => void }) {
  const t = useContent('common');
  const { branch, clock } = useAdminWorkspace();
  const [sent, setSent] = useState<Set<string>>(new Set());
  const people = week.staff
    .map((p) => ({ person: p, shifts: week.shifts.filter((s) => s.staffId === p.id) }))
    .filter((x) => x.shifts.length > 0);
  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const lastDay = week.days[6] ?? week.week;

  const message = (name: string, shifts: typeof week.shifts) =>
    rotaMessage({
      hello: t('adminSettings.rota.whatsapp.hello', { name: name.split(' ')[0] ?? name }),
      intro: t('adminSettings.rota.whatsapp.intro', {
        branch: branch.shortName,
        from: clock.date(atNoon(week.week)),
        to: clock.date(atNoon(lastDay)),
      }),
      lines: shifts.map(
        (s) =>
          `• ${weekday.format(atNoon(s.day))}: ${spanLabel(s.startsAt, s.endsAt)}${
            overnight(s.startsAt, s.endsAt) ? ` (${t('adminSettings.rota.overnight')})` : ''
          }${s.note ? ` · ${s.note}` : ''}`,
      ),
      outro: t('adminSettings.rota.whatsapp.outro'),
    });

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminSettings.rota.whatsapp.title')}
      description={t('adminSettings.rota.whatsapp.body')}
      className={styles.dialog}
      footer={
        <Button block variant="secondary" onClick={onClose}>
          {t('adminSettings.rota.whatsapp.done')}
        </Button>
      }
    >
      <ul className={styles.typeList}>
        {people.map(({ person, shifts }) => {
          const phone = person.phone?.replace(/\D/g, '');
          return (
            <li key={person.id} className={styles.sendRow}>
              <span className={styles.typeText}>
                <span className={styles.typeName}>{person.name}</span>
                <span className={styles.typeMeta}>
                  {t.plural('adminSettings.rota.whatsapp.shifts', shifts.length)}
                </span>
              </span>
              {phone ? (
                <Button
                  size="sm"
                  variant={sent.has(person.id) ? 'ghost' : 'secondary'}
                  iconStart={sent.has(person.id) ? 'check' : 'whatsapp'}
                  onClick={() => {
                    window.open(
                      `https://wa.me/${phone}?text=${encodeURIComponent(message(person.name, shifts))}`,
                      '_blank',
                      'noopener',
                    );
                    setSent((was) => new Set(was).add(person.id));
                  }}
                >
                  {sent.has(person.id)
                    ? t('adminSettings.rota.whatsapp.opened')
                    : t('adminSettings.rota.whatsapp.send')}
                </Button>
              ) : (
                <span className={styles.typeMeta}>{t('adminSettings.rota.whatsapp.noPhone')}</span>
              )}
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
