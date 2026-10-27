'use client';

import { useContent } from '@/api/hooks';
import { ToggleRow } from '@/components/admin/settings/shared/SettingsEditor';
import { Button, Dialog } from '@/components/ui';
import { playChime } from './kitchenSound';
import { TEXT_SIZES, useKitchenPrefs } from './useKitchenPrefs';
import { useKitchenTheme, useKitchenThemeClass } from './useKitchenTheme';
import { canKeepAwake } from './useWakeLock';
import styles from './KitchenSettingsDialog.module.css';

const KEYS = ['pick', 'next', 'open', 'print', 'clear'] as const;

/**
 * Screen settings, for this kitchen screen only (each keeps its own): the chime for new tickets
 * (with a test) and the reminder for waiting ones; keeping the screen on; the tickets' text
 * size and the theme; printing each new ticket; and the keyboard and bump-bar keys.
 */
export function KitchenSettingsDialog({ onClose }: { onClose: () => void }) {
  const t = useContent('kitchen');
  const [prefs, update] = useKitchenPrefs();
  const [theme, toggleTheme] = useKitchenTheme();
  const themeClass = useKitchenThemeClass();
  const awakeSupported = canKeepAwake();

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('settings.title')}
      description={t('settings.subtitle')}
      presentation="panel"
      className={themeClass}
    >
      <div className={styles.sections}>
        <section className={styles.section} aria-labelledby="kitchen-settings-alerts">
          <h3 id="kitchen-settings-alerts" className={styles.heading}>
            {t('settings.alerts')}
          </h3>
          <ToggleRow
            id="kitchen-sound"
            label={t('settings.sound')}
            hint={t('settings.soundHint')}
            checked={prefs.sound}
            onChange={(sound) => update({ sound })}
          />
          <ToggleRow
            id="kitchen-reminders"
            label={t('settings.reminders')}
            hint={t('settings.remindersHint')}
            checked={prefs.reminders}
            disabled={!prefs.sound}
            onChange={(reminders) => update({ reminders })}
          />
          <Button
            variant="secondary"
            size="sm"
            iconStart="bell"
            className={styles.test}
            disabled={!prefs.sound}
            onClick={() => playChime('arrival')}
          >
            {t('settings.test')}
          </Button>
        </section>

        <section className={styles.section} aria-labelledby="kitchen-settings-screen">
          <h3 id="kitchen-settings-screen" className={styles.heading}>
            {t('settings.screen')}
          </h3>
          <ToggleRow
            id="kitchen-awake"
            label={t('settings.awake')}
            hint={awakeSupported ? t('settings.awakeHint') : t('settings.awakeUnsupported')}
            checked={awakeSupported && prefs.awake}
            disabled={!awakeSupported}
            onChange={(awake) => update({ awake })}
          />
          <div className={styles.field}>
            <p className={styles.label} id="kitchen-text-size">
              {t('settings.textSize')}
            </p>
            <div className={styles.segments} role="group" aria-labelledby="kitchen-text-size">
              {TEXT_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  className={styles.segment}
                  aria-pressed={prefs.textSize === size}
                  onClick={() => update({ textSize: size })}
                >
                  {t(`settings.sizes.${size}`)}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.field}>
            <p className={styles.label} id="kitchen-theme">
              {t('settings.theme')}
            </p>
            <div className={styles.segments} role="group" aria-labelledby="kitchen-theme">
              {(['dark', 'light'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={styles.segment}
                  aria-pressed={theme === option}
                  onClick={() => {
                    if (theme !== option) toggleTheme();
                  }}
                >
                  {t(`settings.themes.${option}`)}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="kitchen-settings-printing">
          <h3 id="kitchen-settings-printing" className={styles.heading}>
            {t('settings.printing')}
          </h3>
          <ToggleRow
            id="kitchen-auto-print"
            label={t('settings.autoPrint')}
            hint={t('settings.autoPrintHint')}
            checked={prefs.autoPrint}
            onChange={(autoPrint) => update({ autoPrint })}
          />
        </section>

        <section className={styles.section} aria-labelledby="kitchen-settings-keys">
          <h3 id="kitchen-settings-keys" className={styles.heading}>
            {t('settings.keyboard')}
          </h3>
          <dl className={styles.keys}>
            {KEYS.map((key) => (
              <div key={key}>
                <dt>
                  <kbd>{t(`settings.keys.${key}Keys`)}</kbd>
                </dt>
                <dd>{t(`settings.keys.${key}`)}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </Dialog>
  );
}
