'use client';

import { useState, type ReactNode } from 'react';
import type { BranchSettingsResponse } from '@/api/contracts';
import type { Vars } from '@/api/translator';
import { useBranchSettings, useContent } from '@/api/hooks';
import { useUpdateBranchSettings } from '@/api/mutations';
import { Button, EmptyState, Icon } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { sameSettings, type SettingsError } from '@/lib/branchSettings';
import { cx } from '@/lib/cx';
import type { BranchSettings, BranchSettingsSection } from '@/types/branchSettings';
import { useAdminWorkspace } from '../../shell/AdminWorkspace';
import { useLeaveGuard } from './useLeaveGuard';
import styles from './SettingsEditor.module.css';

/** What a settings page draws its form with. */
export interface SectionForm<K extends BranchSettingsSection> {
  /** The draft (the saved settings until something changes). */
  value: BranchSettings[K];
  /** As saved. */
  saved: BranchSettings[K];
  set: (next: BranchSettings[K]) => void;
  /** Every section as saved, and the choices. */
  data: BranchSettingsResponse;
  /** The draft's problems, first first. */
  errors: SettingsError[];
}

/**
 * One section of the branch's settings as a page (Settings › Branch details, Opening hours…):
 * its title, the form, and — once something changed — a bar to save or discard. Changes are
 * a draft until Save (PATCH …/settings with this section); leaving with changes asks first.
 */
export function SettingsEditor<K extends BranchSettingsSection>({
  section,
  title,
  subtitle,
  check,
  messageVars,
  children,
}: {
  section: K;
  title: string;
  subtitle: string;
  /** The draft's problems (lib/branchSettings), shown in the save bar; Save waits for none. */
  check: (value: BranchSettings[K], data: BranchSettingsResponse) => SettingsError[];
  /** Values the problems' words take (e.g. the phone's `{dialCode}`). */
  messageVars?: (value: BranchSettings[K]) => Vars;
  children: (form: SectionForm<K>) => ReactNode;
}) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const query = useBranchSettings(branch.id);

  if (query.data) {
    return (
      <Editor
        key={branch.id}
        {...{ section, title, subtitle, check, messageVars }}
        data={query.data}
      >
        {children}
      </Editor>
    );
  }
  if (query.isError) {
    return (
      <EmptyState
        icon="wifioff"
        tone="err"
        title={t('adminSettings.load.errorTitle')}
        actions={
          <Button iconStart="refresh" loading={query.isFetching} onClick={() => query.refetch()}>
            {t('adminSettings.load.retry')}
          </Button>
        }
      >
        {t('adminSettings.load.errorBody')}
      </EmptyState>
    );
  }
  return <SettingsSkeleton label={t('adminSettings.load.loading', { page: title })} />;
}

export function SettingsSkeleton({ label }: { label: string }) {
  return (
    <div className={styles.skeleton} role="status" aria-label={label}>
      <span />
      <span />
    </div>
  );
}

function Editor<K extends BranchSettingsSection>({
  section,
  title,
  subtitle,
  check,
  messageVars,
  data,
  children,
}: {
  section: K;
  title: string;
  subtitle: string;
  check: (value: BranchSettings[K], data: BranchSettingsResponse) => SettingsError[];
  messageVars?: (value: BranchSettings[K]) => Vars;
  data: BranchSettingsResponse;
  children: (form: SectionForm<K>) => ReactNode;
}) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const { showToast } = useToast();
  const save = useUpdateBranchSettings();
  const saved = data.settings[section];
  const [draft, setDraft] = useState<BranchSettings[K] | null>(null);

  const value = draft ?? saved;
  const dirty = draft !== null && !sameSettings(draft, saved);
  const errors = check(value, data);
  useLeaveGuard(dirty, t('adminSettings.save.leave'));

  const submit = () => {
    if (!dirty || errors.length > 0) return;
    save.mutate(
      { branchId: branch.id, body: { [section]: value } },
      {
        onSuccess: () => {
          setDraft(null);
          showToast(t('adminSettings.save.saved', { page: title }), { tone: 'success' });
        },
        onError: () => showToast(t('adminSettings.save.failed'), { tone: 'error' }),
      },
    );
  };

  return (
    <div className={cx(styles.page, dirty && styles.withBar)}>
      <header className={styles.head}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{subtitle}</p>
      </header>

      {children({ value, saved, set: setDraft, data, errors })}

      {dirty && (
        <SaveBar
          problem={
            errors.length > 0
              ? t(`adminSettings.errors.${errors[0]}`, messageVars?.(value))
              : undefined
          }
          saving={save.isPending}
          onDiscard={() => setDraft(null)}
          onSave={submit}
        />
      )}
    </div>
  );
}

/** Unsaved changes: what's wrong (or that they apply on saving), Discard and Save. */
export function SaveBar({
  problem,
  saving,
  saveLabel,
  onDiscard,
  onSave,
}: {
  problem?: string;
  saving: boolean;
  saveLabel?: string;
  onDiscard: () => void;
  onSave: () => void;
}) {
  const t = useContent('common');
  return (
    <div className={styles.saveBar} role="region" aria-label={t('adminSettings.save.unsaved')}>
      <div className={styles.saveText}>
        <strong>{t('adminSettings.save.unsaved')}</strong>
        <span role={problem ? 'alert' : undefined}>
          {problem ?? t('adminSettings.save.summary')}
        </span>
      </div>
      <div className={styles.saveActions}>
        <Button variant="secondary" onClick={onDiscard}>
          {t('adminSettings.save.discard')}
        </Button>
        <Button iconStart="check" loading={saving} disabled={Boolean(problem)} onClick={onSave}>
          {saveLabel ?? t('adminSettings.save.save')}
        </Button>
      </div>
    </div>
  );
}

/** A titled panel of related settings. */
export function SettingsCard({
  title,
  hint,
  action,
  children,
  className,
}: {
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx(styles.card, className)}>
      <div className={styles.cardHead}>
        <div className={styles.cardText}>
          <h2 className={styles.cardTitle}>{title}</h2>
          {hint && <p className={styles.cardHint}>{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Fields side by side from 768px. */
export function FieldGrid({ children }: { children: ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}

/** An on / off setting: its name, what the current choice means, and a switch. */
export function ToggleRow({
  id,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={styles.toggle} htmlFor={id}>
      <span className={styles.toggleText}>
        <span className={styles.toggleLabel}>{label}</span>
        {hint && (
          <span className={styles.toggleHint} id={`${id}-hint`}>
            {hint}
          </span>
        )}
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className={styles.switch}
        checked={checked}
        disabled={disabled}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

/** A note under a section: what a setting does for guests. */
export function SettingsNote({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: 'info' | 'warn';
}) {
  return (
    <p className={cx(styles.note, tone === 'warn' && styles.noteWarn)}>
      <Icon name={tone === 'warn' ? 'alert' : 'info'} size="xs" />
      <span>{children}</span>
    </p>
  );
}

/**
 * The text of a number field, kept while it's typed ("2." on the way to "2.5"), and the number
 * it stands for (NaN when it isn't one). Follows the value when it changes from outside
 * (Discard).
 */
export function useNumberText(
  value: number | undefined,
  format: (n: number) => string,
  parse: (text: string) => number | undefined,
) {
  const [text, setText] = useState(() => (value === undefined ? '' : format(value)));
  const [seen, setSeen] = useState(value);
  if (!Object.is(seen, value)) {
    // Only a change from outside re-formats; typing keeps the text as typed.
    setSeen(value);
    if (!Object.is(parse(text), value)) setText(value === undefined ? '' : format(value));
  }
  return [text, setText] as const;
}

/** "2.5" → 2.5; "" → undefined; anything else → NaN. At most two decimals. */
export function parseDecimal(text: string): number | undefined {
  const v = text.trim();
  if (!v) return undefined;
  return /^\d{1,7}(\.\d{0,2})?$/.test(v) ? Number(v) : Number.NaN;
}

/** "45" → 45; "" → undefined; anything else → NaN. */
export function parseWhole(text: string): number | undefined {
  const v = text.trim();
  if (!v) return undefined;
  return /^\d{1,6}$/.test(v) ? Number(v) : Number.NaN;
}

/** 2.5 → "2.5", 30 → "30". */
export const formatDecimal = (n: number) => (Number.isFinite(n) ? String(n) : '');
