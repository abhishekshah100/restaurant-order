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
  /**
   * Several lines before "more" (the CSS variable --lines on it or above sets how many, 3 by
   * default; a popup can lower it on short screens). One line without it.
   */
  multiline?: boolean;
}

/**
 * One line of text (or a few, `multiline`) with a "more" toggle that appears only when the text
 * is actually cut off:
 * measured to the fraction of a pixel (a last letter just past the edge still shows "…"), again
 * whenever the line or the row it sits in changes width (a dish with or without a photo, a turned
 * phone) and once the menu's fonts have loaded (they set how wide the text really is).
 */
export function ExpandableText({ text, itemName, className, multiline }: ExpandableTextProps) {
  const textRef = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const t = useContent('menu');

  useEffect(() => {
    const el = textRef.current;
    if (!el || expanded) return;
    const measure = () => {
      // Several lines: more lines than shown.
      if (multiline) {
        setTruncated(el.scrollHeight - el.clientHeight > 1);
        return;
      }
      // One line: the text's own width (the "…" is only drawn over it) against the room it has.
      const range = document.createRange();
      range.selectNodeContents(el);
      const needs = range.getBoundingClientRect().width;
      const has = el.getBoundingClientRect().width;
      setTruncated(needs - has > 0.01 || el.scrollWidth > el.clientWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.parentElement) observer.observe(el.parentElement);
    let live = true;
    void document.fonts?.ready.then(() => live && measure());
    return () => {
      live = false;
      observer.disconnect();
    };
  }, [expanded, text, multiline]);

  return (
    <p
      className={cx(
        styles.root,
        multiline && styles.multiline,
        expanded && styles.expanded,
        className,
      )}
    >
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
