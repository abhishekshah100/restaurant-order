'use client';

import { useContent } from '@/api/hooks';
import { useMarkReminded } from '@/api/mutations';
import { Icon } from '@/components/ui';
import { smsLink, whatsappLink } from '@/lib/reservations';
import type { Reservation } from '@/types/admin';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { useReservationText } from './useReservationText';
import styles from './ReservationExtras.module.css';

/**
 * Remind the guest: WhatsApp or SMS opens on this phone with the message written (when, for how
 * many, the deposit held), and the booking notes who reminded them. Nothing is sent by the app.
 */
export function RemindActions({ reservation: r }: { reservation: Reservation }) {
  const t = useContent('common');
  const { branch, brand, region, clock, money } = useAdminWorkspace();
  const text = useReservationText();
  const mark = useMarkReminded();
  if (!r.phone) return null;
  const message = t('adminReservations.remind.message', {
    name: r.guestName,
    brand,
    party: text.guests(r.partySize),
    date: clock.date(r.at),
    time: clock.time(r.at),
    deposit:
      r.deposit?.status === 'held'
        ? t('adminReservations.remind.messageDeposit', { amount: money.format(r.deposit.amount) })
        : '',
  });
  const reminded = () => mark.mutate({ branchId: branch.id, id: r.id });
  const { dialCode } = region.mobile;
  return (
    <span className={styles.remind}>
      <a
        className={styles.remindLink}
        href={whatsappLink(dialCode, r.phone, message)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t('adminReservations.remind.whatsappLabel', { name: r.guestName })}
        onClick={reminded}
      >
        <Icon name="msg" size="xs" />
        {t('adminReservations.remind.whatsapp')}
      </a>
      <a
        className={styles.remindLink}
        href={smsLink(dialCode, r.phone, message)}
        aria-label={t('adminReservations.remind.smsLabel', { name: r.guestName })}
        onClick={reminded}
      >
        <Icon name="phone" size="xs" />
        {t('adminReservations.remind.sms')}
      </a>
    </span>
  );
}
