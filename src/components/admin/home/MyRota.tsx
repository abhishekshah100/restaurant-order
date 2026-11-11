'use client';

import { isBackendEnabled } from '@/api/backend';
import { useContent, useMyRota } from '@/api/hooks';
import { Button } from '@/components/ui';
import { useAdminStaffId } from '@/hooks/useAdminSession';
import { addDays } from '@/lib/rota';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { MyRotaList } from './MyRotaList';
import { MyRotaRequests, swappingOf, useRotaAsks } from './MyRotaRequests';
import styles from './HomePanels.module.css';

/**
 * My rota: the signed-in person's shifts from the published rota, today and the 6 days after
 * (each day its hours or Off, Swap on a shift), their requests (swaps asked of them to answer,
 * their own time off and swaps), and Ask for time off.
 */
export function MyRota({ now }: { now: Date | null }) {
  const t = useContent('common');
  const { branch, clock } = useAdminWorkspace();
  const me = useAdminStaffId();
  const rota = useMyRota(branch.id, isBackendEnabled());
  const asks = useRotaAsks();
  if (!now || !rota.data) return null;
  const today = clock.dayKey(now);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const shifts = rota.data.shifts.filter((s) => days.includes(s.day));

  return (
    <section className={styles.panel} aria-labelledby="my-rota-title">
      <header className={styles.head}>
        <div>
          <h2 id="my-rota-title" className={styles.title}>
            {t('adminHome.rota.title')}
          </h2>
          <p className={styles.subtitle}>
            {shifts.length > 0 ? t('adminHome.rota.subtitle') : t('adminHome.rota.none')}
          </p>
        </div>
      </header>
      {shifts.length > 0 && (
        <MyRotaList
          today={today}
          shifts={shifts}
          onSwap={asks.askSwap}
          swapping={swappingOf(rota.data, me)}
        />
      )}
      <MyRotaRequests rota={rota.data} today={today} />
      <div className={styles.rotaAsk}>
        <Button size="sm" variant="secondary" iconStart="calendar" onClick={asks.askTimeOff}>
          {t('adminHome.rota.askTimeOff')}
        </Button>
      </div>
      {asks.dialogs}
    </section>
  );
}
