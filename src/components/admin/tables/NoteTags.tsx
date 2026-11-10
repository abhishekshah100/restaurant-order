import { useContent } from '@/api/hooks';
import { Icon, type IconName } from '@/components/ui';
import { cx } from '@/lib/cx';
import type { NoteTag } from '@/types/admin';
import styles from './NoteTags.module.css';

const ICONS: Record<NoteTag, IconName> = {
  allergy: 'alert',
  vip: 'star',
  birthday: 'sparkle',
  regular: 'heart',
  highChair: 'user',
};

/** Allergy first (it matters most), then the rest in the catalog's order. */
const ORDER: readonly NoteTag[] = ['allergy', 'vip', 'birthday', 'regular', 'highChair'];

/**
 * A table note's tags as small chips (Allergy in red, VIP in gold…), at most `max` of them; on
 * the tiles they say at a glance who's at the table.
 */
export function NoteTags({
  tags,
  max,
  className,
}: {
  tags: readonly NoteTag[];
  max?: number;
  className?: string;
}) {
  const t = useContent('common');
  const shown = ORDER.filter((tag) => tags.includes(tag)).slice(0, max);
  if (shown.length === 0) return null;
  return (
    <span className={cx(styles.tags, className)}>
      {shown.map((tag) => (
        <span key={tag} className={cx(styles.tag, styles[tag])}>
          <Icon name={ICONS[tag]} size="xs" />
          {t(`adminTables.notes.tags.${tag}`)}
        </span>
      ))}
    </span>
  );
}
