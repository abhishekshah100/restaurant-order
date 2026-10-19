'use client';

import { useContent } from '@/api/hooks';
import { Chip, Icon, IconButton } from '@/components/ui';
import { paymentErrors } from '@/lib/branchSettings';
import { PAYMENT_METHODS } from '@/lib/payments';
import { cx } from '@/lib/cx';
import type {
  AtTableMethodKey,
  BillMethodKey,
  CheckoutMethodKey,
  PaymentMethodId,
} from '@/types/branch';
import {
  PAYMENT_CHANNELS,
  type PaymentChannel,
  type PaymentChannelSettings,
  type PaymentSettings,
} from '@/types/branchSettings';
import { useAdminWorkspace } from '../../shell/AdminWorkspace';
import { SettingsCard, SettingsEditor, SettingsNote } from '../shared/SettingsEditor';
import styles from './PaymentMethodsEditor.module.css';

/** Moves `id` one place up (-1) or down (1) in the list. */
function move<T>(list: readonly T[], id: T, by: -1 | 1): T[] {
  const from = list.indexOf(id);
  const to = from + by;
  if (from < 0 || to < 0 || to >= list.length) return [...list];
  const next = [...list];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** Screens where one method can be marked "Fastest". */
const MARKS_FASTEST = new Set<PaymentChannel>(['checkout', 'takeaway', 'delivery']);

/**
 * Settings › Payment methods: for each screen guests pay on (dine-in checkout, Pay my bill,
 * takeaway, delivery) the methods offered, in the order shown, and the one marked "Fastest";
 * and how the printed bill can be paid at the table. The methods are the region's.
 */
export function PaymentMethodsEditor() {
  const t = useContent('common');
  const checkout = useContent('checkout');
  const service = useContent('service');
  const { region } = useAdminWorkspace();

  return (
    <SettingsEditor
      section="payments"
      title={t('adminSettings.sections.payments.title')}
      subtitle={t('adminSettings.payments.subtitle')}
      check={(value, data) => paymentErrors(value, data.choices.payments)}
    >
      {({ value, set, data }) => {
        const choices = data.choices.payments;
        const setChannel = (ch: PaymentChannel, next: PaymentChannelSettings) =>
          set({ ...value, [ch]: next });
        const labelOf = (ch: PaymentChannel, id: PaymentMethodId) => {
          const choice = choices[ch].find((c) => c.id === id);
          if (!choice) return { title: id, sub: '' };
          if (ch === 'bill') {
            const key = choice.labelKey as BillMethodKey;
            return {
              title: service(`payBill.methods.${key}.title`),
              sub: service(`payBill.methods.${key}.mobileSub`),
            };
          }
          const key = choice.labelKey as CheckoutMethodKey;
          return {
            title: checkout(`payment.methods.${key}.title`),
            sub: checkout(`payment.methods.${key}.mobileSub`),
          };
        };
        const modeOff = (ch: PaymentChannel) =>
          (ch === 'takeaway' && !region.modes.takeaway.enabled) ||
          (ch === 'delivery' && !region.modes.delivery.enabled);

        return (
          <>
            {PAYMENT_CHANNELS.map((ch) => {
              const settings = value[ch];
              const offered = settings.methods;
              const rest = choices[ch].map((c) => c.id).filter((id) => !offered.includes(id));
              return (
                <SettingsCard
                  key={ch}
                  title={t(`adminSettings.payments.channels.${ch}.title`)}
                  hint={t(`adminSettings.payments.channels.${ch}.hint`)}
                >
                  {modeOff(ch) && (
                    <SettingsNote tone="warn">
                      {t(
                        `adminSettings.payments.modeOff.${ch === 'takeaway' ? 'takeaway' : 'delivery'}`,
                      )}
                    </SettingsNote>
                  )}
                  <ul className={styles.methods}>
                    {[...offered, ...rest].map((id) => {
                      const on = offered.includes(id);
                      const { title, sub } = labelOf(ch, id);
                      const index = offered.indexOf(id);
                      const fastest = settings.recommended === id;
                      return (
                        <li key={id} className={cx(styles.method, !on && styles.off)}>
                          <label className={styles.pick}>
                            <input
                              type="checkbox"
                              className={styles.check}
                              checked={on}
                              onChange={(event) =>
                                setChannel(ch, {
                                  methods: event.target.checked
                                    ? [...offered, id]
                                    : offered.filter((m) => m !== id),
                                  recommended:
                                    !event.target.checked && fastest ? null : settings.recommended,
                                })
                              }
                            />
                            <span className={styles.icon} aria-hidden="true">
                              <Icon name={PAYMENT_METHODS[id].icon} size="sm" />
                            </span>
                            <span className={styles.text}>
                              <span className={styles.title}>{title}</span>
                              {sub && <span className={styles.sub}>{sub}</span>}
                            </span>
                          </label>
                          {on && (
                            <div className={styles.actions}>
                              {MARKS_FASTEST.has(ch) && (
                                <Chip
                                  pressed={fastest}
                                  iconStart="flame"
                                  aria-label={t('adminSettings.payments.fastestFor', {
                                    method: title,
                                  })}
                                  onClick={() =>
                                    setChannel(ch, {
                                      ...settings,
                                      recommended: fastest ? null : id,
                                    })
                                  }
                                >
                                  {t('adminSettings.payments.fastest')}
                                </Chip>
                              )}
                              <IconButton
                                icon="chevd"
                                size="sm"
                                className={styles.up}
                                label={t('adminSettings.payments.up', { method: title })}
                                disabled={index === 0}
                                onClick={() =>
                                  setChannel(ch, { ...settings, methods: move(offered, id, -1) })
                                }
                              />
                              <IconButton
                                icon="chevd"
                                size="sm"
                                label={t('adminSettings.payments.down', { method: title })}
                                disabled={index === offered.length - 1}
                                onClick={() =>
                                  setChannel(ch, { ...settings, methods: move(offered, id, 1) })
                                }
                              />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {offered.length === 0 && (
                    <p className={styles.error} role="alert">
                      {t('adminSettings.errors.noMethods')}
                    </p>
                  )}
                </SettingsCard>
              );
            })}

            <AtTableCard
              value={value.atTable}
              choices={choices.atTable}
              onChange={(atTable) => set({ ...value, atTable } satisfies PaymentSettings)}
            />
          </>
        );
      }}
    </SettingsEditor>
  );
}

/** How the printed bill can be paid at the table, in the order the bill names them. */
function AtTableCard({
  value,
  choices,
  onChange,
}: {
  value: AtTableMethodKey[];
  choices: AtTableMethodKey[];
  onChange: (next: AtTableMethodKey[]) => void;
}) {
  const t = useContent('common');
  const rest = choices.filter((m) => !value.includes(m));
  return (
    <SettingsCard
      title={t('adminSettings.payments.atTable.title')}
      hint={t('adminSettings.payments.atTable.hint')}
    >
      <ul className={styles.methods}>
        {[...value, ...rest].map((key) => {
          const on = value.includes(key);
          const index = value.indexOf(key);
          const name = t(`paymentMethods.${key}`);
          return (
            <li key={key} className={cx(styles.method, !on && styles.off)}>
              <label className={styles.pick}>
                <input
                  type="checkbox"
                  className={styles.check}
                  checked={on}
                  onChange={(event) =>
                    onChange(
                      event.target.checked ? [...value, key] : value.filter((m) => m !== key),
                    )
                  }
                />
                <span className={styles.icon} aria-hidden="true">
                  <Icon
                    name={key === 'cash' ? 'cash' : key === 'card' ? 'card' : 'mobile'}
                    size="sm"
                  />
                </span>
                <span className={styles.text}>
                  <span className={styles.title}>{name}</span>
                </span>
              </label>
              {on && (
                <div className={styles.actions}>
                  <IconButton
                    icon="chevd"
                    size="sm"
                    className={styles.up}
                    label={t('adminSettings.payments.up', { method: name })}
                    disabled={index === 0}
                    onClick={() => onChange(move(value, key, -1))}
                  />
                  <IconButton
                    icon="chevd"
                    size="sm"
                    label={t('adminSettings.payments.down', { method: name })}
                    disabled={index === value.length - 1}
                    onClick={() => onChange(move(value, key, 1))}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {value.length === 0 && (
        <p className={styles.error} role="alert">
          {t('adminSettings.errors.noAtTable')}
        </p>
      )}
    </SettingsCard>
  );
}
