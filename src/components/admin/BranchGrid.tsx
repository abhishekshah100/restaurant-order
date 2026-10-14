import { Skeleton } from '@/components/ui';
import { cx } from '@/lib/cx';
import type { AdminBranch } from '@/types/admin';
import { BranchCard } from './BranchCard';
import styles from './BranchGrid.module.css';

export interface BranchGridProps {
  branches: readonly AdminBranch[];
  now: Date | null;
  lastUsedId: string | null;
  onSelect: (branchId: string) => void;
  /** Three columns on wide screens (set from the admin's branch count, not the search results). */
  wide?: boolean;
}

/** The branch cards: one column on phones, two from 768px, three on wide screens (many branches). */
export function BranchGrid({ branches, now, lastUsedId, onSelect, wide }: BranchGridProps) {
  return (
    <ul className={cx(styles.grid, wide && styles.wide)}>
      {branches.map((branch) => (
        <li key={branch.id} className={styles.cell}>
          <BranchCard
            branch={branch}
            now={now}
            lastUsed={branch.id === lastUsedId}
            onSelect={onSelect}
          />
        </li>
      ))}
    </ul>
  );
}

/** Placeholder cards shaped like BranchCard while the branches load. */
export function BranchGridSkeleton({ label, count = 2 }: { label: string; count?: number }) {
  return (
    <div className={styles.grid} aria-busy="true" role="status">
      <span className="visually-hidden">{label}</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={styles.skeleton}>
          <Skeleton shape="block" className={styles.skThumb} />
          <div className={styles.skHead}>
            <Skeleton shape="title" width="58%" />
            <Skeleton width="42%" />
          </div>
          <Skeleton shape="block" className={styles.skPill} />
          <div className={styles.skDetails}>
            <Skeleton width="78%" />
            <Skeleton width="52%" />
          </div>
          <div className={styles.skFoot}>
            <Skeleton shape="block" width="64%" height={26} />
            <Skeleton shape="circle" className={styles.skGo} />
          </div>
        </div>
      ))}
    </div>
  );
}
