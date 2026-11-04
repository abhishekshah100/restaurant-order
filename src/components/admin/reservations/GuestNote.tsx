'use client';

import { isBackendEnabled } from '@/api/backend';
import { useContent, useGuestHistory, useReservations } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { cx } from '@/lib/cx';
import { depositAsked } from '@/lib/reservations';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './ReservationExtras.module.css';

/**
 * While booking: the guest's no-shows at the branch (by their number, the last six months) and
 * the deposit to ask for, by the branch's rules (the party's size, those no-shows).
 */
export function GuestNote({ phone, partySize }: { phone: string; partySize: number }) {
  const t = useContent('common');
  const { branch, region, money } = useAdminWorkspace();
  const backend = isBackendEnabled();
  const { length, pattern } = region.mobile;
  const complete = phone.length === length && new RegExp(pattern).test(phone);
  const history = useGuestHistory(branch.id, complete ? phone : null, backend).data;
  const rules = useReservations(branch.id).data?.rules;
  const noShows = complete ? (history?.noShows ?? 0) : 0;
  const asked = depositAsked(rules, partySize, noShows);
  if (!backend || (noShows === 0 && asked === 0)) return null;
  return (
    <div className={styles.block} aria-live="polite">
      {noShows > 0 && (
        <p className={cx(styles.note, styles.warn)}>
          <Icon name="flag" size="xs" />
          {t.plural('adminReservations.guest.noShows', noShows)}
        </p>
      )}
      {asked > 0 && (
        <p className={styles.note}>
          <Icon name="cash" size="xs" />
          {t('adminReservations.guest.depositAsked', { amount: money.format(asked) })}
        </p>
      )}
    </div>
  );
}
