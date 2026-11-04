'use client';

import { useState } from 'react';
import { useContent } from '@/api/hooks';
import { useSetReservationRules } from '@/api/mutations';
import { Button, Dialog } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import type { ReservationRules } from '@/types/admin';
import { AmountInput, parseAmount } from '../payments/PaymentFields';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './ReservationExtras.module.css';

/** A whole number typed in a box: none while it isn't one. */
const wholeNumber = (text: string, max: number): number | null =>
  /^\d{1,3}$/.test(text) && Number(text) <= max ? Number(text) : null;

/**
 * The branch's booking rules: when a late party becomes a no-show, and when a deposit is asked
 * (party size, past no-shows), how much a head, and how long before the booking a cancellation
 * is still refunded.
 */
export function BookingRulesDialog({
  rules,
  onClose,
}: {
  rules: ReservationRules;
  onClose: () => void;
}) {
  const t = useContent('common');
  const { branch, region } = useAdminWorkspace();
  const { showToast } = useToast();
  const save = useSetReservationRules();
  const [form, setForm] = useState({
    noShowAfterMinutes: String(rules.noShowAfterMinutes),
    depositPartySize: String(rules.depositPartySize),
    depositAfterNoShows: String(rules.depositAfterNoShows),
    depositPerPerson: String(rules.depositPerPerson),
    depositCancelHours: String(rules.depositCancelHours),
  });
  const next = {
    noShowAfterMinutes: wholeNumber(form.noShowAfterMinutes, 240),
    depositPartySize: wholeNumber(form.depositPartySize, 50),
    depositAfterNoShows: wholeNumber(form.depositAfterNoShows, 20),
    depositPerPerson: form.depositPerPerson === '' ? 0 : parseAmount(form.depositPerPerson),
    depositCancelHours: wholeNumber(form.depositCancelHours, 168),
  };
  const valid = Object.values(next).every((v) => v !== null);
  const field = (key: keyof typeof form, label: string, hint?: string) => (
    <AmountInput
      id={`rules-${key}`}
      label={label}
      symbol=""
      value={form[key]}
      onChange={(value) => setForm({ ...form, [key]: value })}
      hint={hint}
      compact
    />
  );

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminReservations.rules.title')}
      footer={
        <Button
          block
          iconStart="check"
          disabled={!valid}
          loading={save.isPending}
          onClick={() =>
            valid &&
            save.mutate(
              { branchId: branch.id, rules: next as ReservationRules },
              {
                onSuccess: () => {
                  showToast(t('adminReservations.rules.saved'), { tone: 'success' });
                  onClose();
                },
                onError: () => showToast(t('adminReservations.rules.failed'), { tone: 'error' }),
              },
            )
          }
        >
          {t('adminReservations.rules.save')}
        </Button>
      }
    >
      <div className={styles.form}>
        <section className={styles.block} aria-labelledby="rules-no-show">
          <h3 id="rules-no-show" className={styles.label}>
            {t('adminReservations.rules.noShowTitle')}
          </h3>
          {field(
            'noShowAfterMinutes',
            t('adminReservations.rules.noShowAfter'),
            t('adminReservations.rules.noShowHint'),
          )}
        </section>
        <section className={styles.block} aria-labelledby="rules-deposit">
          <h3 id="rules-deposit" className={styles.label}>
            {t('adminReservations.rules.depositTitle')}
          </h3>
          {field(
            'depositPartySize',
            t('adminReservations.rules.partySize'),
            t('adminReservations.rules.partySizeHint'),
          )}
          {field(
            'depositAfterNoShows',
            t('adminReservations.rules.afterNoShows'),
            t('adminReservations.rules.afterNoShowsHint'),
          )}
          <AmountInput
            id="rules-depositPerPerson"
            label={t('adminReservations.rules.perPerson')}
            symbol={region.currency.symbol}
            value={form.depositPerPerson}
            onChange={(value) => setForm({ ...form, depositPerPerson: value })}
            compact
          />
          {field(
            'depositCancelHours',
            t('adminReservations.rules.cancelHours'),
            t('adminReservations.rules.cancelHoursHint'),
          )}
        </section>
      </div>
    </Dialog>
  );
}
