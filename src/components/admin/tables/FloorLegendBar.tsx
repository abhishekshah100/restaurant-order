import { useContent } from '@/api/hooks';
import { FLOOR_LEGEND, type FloorLegend } from '@/lib/adminTables';
import { cx } from '@/lib/cx';
import styles from './FloorLegendBar.module.css';

/** The open area's tables by state: a colour key that also counts them. */
export function FloorLegendBar({ counts }: { counts: Record<FloorLegend, number> }) {
  const t = useContent('common');
  return (
    <ul className={styles.legend} aria-label={t('adminTables.legend.label')}>
      {FLOOR_LEGEND.map((group) => (
        <li key={group} className={cx(styles.item, styles[group])}>
          <span className={styles.dot} aria-hidden="true" />
          {t(`adminTables.legend.${group}`)}
          <span className={styles.count}>{counts[group]}</span>
        </li>
      ))}
    </ul>
  );
}
