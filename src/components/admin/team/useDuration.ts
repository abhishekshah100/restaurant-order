import { useCallback } from 'react';
import { useContent } from '@/api/hooks';

/**
 * How long, as Team writes it everywhere (rota hours, attendance, fixing times): "45 min",
 * "7 h", "3 h 15 min".
 */
export function useDuration(): (minutes: number) => string {
  const t = useContent('common');
  return useCallback(
    (minutes: number) => {
      const m = Math.max(0, Math.round(minutes));
      if (m < 60) return t('adminTeam.attendance.minutes', { minutes: m });
      const hours = Math.floor(m / 60);
      return m % 60 === 0
        ? t('adminTeam.attendance.hours', { hours })
        : t('adminTeam.attendance.hoursMinutes', { hours, minutes: m % 60 });
    },
    [t],
  );
}
