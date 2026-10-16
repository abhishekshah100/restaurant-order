import { useContent } from '@/api/hooks';
import { VegMark } from '@/components/ui';
import type { AllDayGroup } from '@/lib/kitchenBoard';
import type { Category } from '@/types/menu';
import styles from './AllDayList.module.css';

/**
 * "All day": every dish still to cook across the new and cooking tickets, added up by dish and
 * size and grouped by station, so a cook can fire six naans at once instead of reading six tickets.
 */
export function AllDayList({
  groups,
  categories,
}: {
  groups: readonly AllDayGroup[];
  categories: readonly Category[];
}) {
  const t = useContent('kitchen');
  if (groups.length === 0) return <p className={styles.empty}>{t('board.allDay.empty')}</p>;
  const nameOf = (id: string | undefined) => {
    const category = categories.find((c) => c.id === id);
    return category?.name ?? t('board.allDay.other');
  };
  return (
    <div className={styles.groups}>
      {groups.map((group) => (
        <section key={group.categoryId ?? 'other'} className={styles.group}>
          <h3 className={styles.station}>
            <span>{nameOf(group.categoryId)}</span>
            <span className={styles.total}>{group.quantity}</span>
          </h3>
          <ul className={styles.lines}>
            {group.lines.map((line) => (
              <li key={line.key} className={styles.line}>
                <span className={styles.qty}>{line.quantity}</span>
                <span className={styles.body}>
                  <span className={styles.name}>
                    <VegMark veg={line.veg} decorative />
                    {line.name}
                    {line.variant && <span className={styles.variant}>{line.variant}</span>}
                  </span>
                  <span className={styles.tickets}>
                    {t.plural('board.allDay.tickets', line.tickets)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
