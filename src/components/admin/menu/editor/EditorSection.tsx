'use client';

import { useState, type ReactNode } from 'react';
import { useContent } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { cx } from '@/lib/cx';
import styles from './Editor.module.css';

/**
 * One part of the dish editor, folded to a line with its summary ("5 groups", "2 sizes") and
 * opened to edit. A part with something to fix opens itself and says so. An optional part with
 * nothing in it yet (`empty` with `add`) is a single "+ Add sizes"-style button and a line on
 * what it's for, until it's opened: a simple dish stays a short form.
 */
export function EditorSection({
  title,
  summary,
  defaultOpen = false,
  error,
  empty,
  add,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  /** What's wrong in it, shown at its end (opens it). */
  error?: string;
  /** Nothing in it yet: shown as `add` until opened. */
  empty?: boolean;
  add?: { label: string; hint: string };
  children: ReactNode;
}) {
  const t = useContent('common');
  const [open, setOpen] = useState(defaultOpen);
  if (add && empty && !open && !error) {
    return (
      <button type="button" className={styles.addSection} onClick={() => setOpen(true)}>
        <span className={styles.addSectionIcon} aria-hidden="true">
          <Icon name="plus" size="xs" />
        </span>
        <span className={styles.addSectionText}>
          <strong>{add.label}</strong>
          <span>{add.hint}</span>
        </span>
      </button>
    );
  }
  return (
    <details
      className={cx(styles.section, error && styles.sectionError)}
      open={open || Boolean(error)}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className={styles.sectionHead}>
        <span className={styles.sectionTitle}>{title}</span>
        {error ? (
          <span className={styles.needsLook}>{t('adminMenu.editor.sections.needsLook')}</span>
        ) : (
          summary && <span className={styles.sectionSummary}>{summary}</span>
        )}
        <Icon name="chevd" size="xs" className={styles.sectionChevron} />
      </summary>
      <div className={styles.sectionBody}>
        {children}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
