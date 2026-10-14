import { useContent } from '@/api/hooks';
import { Skeleton } from '@/components/ui';
import styles from './HomeSkeleton.module.css';

const COUNTERS = 4;
const ROWS = 3;

/** The home's shape while the floor loads. */
export function HomeSkeleton() {
  const t = useContent('common');
  return (
    <div className={styles.skeleton} aria-busy="true">
      <span className="visually-hidden" role="status">
        {t('adminHome.loading')}
      </span>
      <div className={styles.counters}>
        {Array.from({ length: COUNTERS }, (_, i) => (
          <Skeleton key={i} shape="block" className={styles.counter} />
        ))}
      </div>
      <div className={styles.panel}>
        <Skeleton shape="title" width="40%" />
        {Array.from({ length: ROWS }, (_, i) => (
          <Skeleton key={i} shape="block" className={styles.row} />
        ))}
      </div>
    </div>
  );
}
