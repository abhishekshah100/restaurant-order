import { useContent } from '@/api/hooks';
import { minutesSince } from '@/lib/adminService';
import { seatedFor } from '@/lib/adminTables';

/** "26 min" / "1 h 5 min" since `seatedAt`; null until the time is known (or nobody is seated). */
export function useSeatedLabel() {
  const t = useContent('common');
  return (seatedAt: string | undefined, now: Date | null): string | null => {
    if (!seatedAt || !now) return null;
    const { key, ...vars } = seatedFor(minutesSince(seatedAt, now));
    return t(`adminTables.seated.${key}`, vars);
  };
}
