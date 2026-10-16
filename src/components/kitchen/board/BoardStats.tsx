import { useContent } from '@/api/hooks';
import type { BoardStats as Stats } from '@/lib/kitchenBoard';
import { StatTiles, type StatTile } from '../StatTiles';

/** The kitchen now: tickets in each lane, the late ones, items still to cook, the average ticket. */
export function BoardStats({ stats }: { stats: Stats }) {
  const t = useContent('kitchen');
  const minutes = (count: number | null) =>
    count === null ? t('board.stats.none') : t('board.stats.minutes', { count });
  const tiles: StatTile[] = [
    { id: 'new', label: t('board.stats.new'), value: String(stats.new), icon: 'bell' },
    { id: 'cooking', label: t('board.stats.cooking'), value: String(stats.cooking), icon: 'flame' },
    {
      id: 'ready',
      label: t('board.stats.ready'),
      value: String(stats.ready),
      icon: 'cloche',
      tone: stats.ready > 0 ? 'ready' : undefined,
    },
    {
      id: 'late',
      label: t('board.stats.late'),
      value: String(stats.late),
      icon: 'alert',
      tone: stats.late > 0 ? 'alert' : undefined,
    },
    {
      id: 'items',
      label: t('board.stats.itemsToCook'),
      value: String(stats.itemsToCook),
      icon: 'list',
    },
    {
      id: 'average',
      label: t('board.stats.average'),
      value: minutes(stats.averageMinutes),
      icon: 'clock',
    },
  ];
  return <StatTiles tiles={tiles} label={t('board.stats.label')} />;
}
