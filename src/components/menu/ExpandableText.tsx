'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useContent } from '@/api/hooks';
import { cx } from '@/lib/cx';
import styles from './ExpandableText.module.css';

export interface ExpandableTextProps {
  text: string;
  /** Used in the toggle's accessible name: "Show full description of Paneer Tikka". */
  itemName: string;
  className?: string;
}

/**
 * One line of text with a "more" toggle that appears only when the line is
 * actually cut off (measured, so it adapts to every screen width).
 */
export function ExpandableText({ text, itemName, className }: ExpandableTextProps) {
  const textRef = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const t = useContent('menu');

  useEffect(() => {
    const el = textRef.current;
    if (!el || expanded) return;
    const measure = () => setTruncated(el.scrollWidth > el.clientWidth + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [expanded, text]);

  return (
    <p className={cx(styles.root, expanded && styles.expanded, className)}>
      <span ref={textRef} id={id} className={styles.text}>
        {text}
      </span>
      {(truncated || expanded) && (
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={expanded}
          aria-controls={id}
          aria-label={
            expanded
              ? t('dish.showLessDescription', { dish: itemName })
              : t('dish.showFullDescription', { dish: itemName })
          }
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? t('dish.less') : t('dish.more')}
        </button>
      )}
    </p>
  );
}
