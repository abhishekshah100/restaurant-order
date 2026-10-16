import { Icon, type IconName } from '@/components/ui';
import { cx } from '@/lib/cx';
import styles from './StatTiles.module.css';

export interface StatTile {
  id: string;
  label: string;
  value: string;
  icon: IconName;
  /** Calls for attention (late tickets), or food waiting at the pass. */
  tone?: 'alert' | 'ready';
}

/** From 1024px the tiles share one row (6 unless named here). */
const COLUMNS: Record<number, string | undefined> = { 4: styles.four, 7: styles.seven };

/** The kitchen's numbers as a row of tiles: a term and its value each. */
export function StatTiles({ tiles, label }: { tiles: readonly StatTile[]; label: string }) {
  return (
    <dl className={cx(styles.stats, COLUMNS[tiles.length])} aria-label={label}>
      {tiles.map((tile) => (
        <div key={tile.id} className={cx(styles.tile, tile.tone && styles[tile.tone])}>
          <dt>
            <Icon name={tile.icon} size="xs" />
            {tile.label}
          </dt>
          <dd>{tile.value}</dd>
        </div>
      ))}
    </dl>
  );
}
