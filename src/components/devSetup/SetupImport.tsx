'use client';

import { useState } from 'react';
import { ApiError } from '@/api/client';
import type { SetupCheckResponse, SetupIssue } from '@/api/contracts';
import { useContent } from '@/api/hooks';
import { useCheckSetup, useImportSetup } from '@/api/mutations';
import { Banner, Button, Input, Textarea } from '@/components/ui';
import { parsePasted } from '@/lib/devSetup';
import { SetupResult } from './SetupResult';
import { SetupTemplates } from './SetupTemplates';
import styles from './DevSetup.module.css';

/** Paste the client's JSON, Check it, then Import it (replacing the one made before if asked). */
export function SetupImport({ devKey }: { devKey: string }) {
  const t = useContent('common');
  const check = useCheckSetup(devKey);
  const run = useImportSetup(devKey);
  const [text, setText] = useState('');
  const [notJson, setNotJson] = useState<string | null>(null);
  /** The last check's answer and the text it was for. */
  const [checked, setChecked] = useState<{ text: string; answer: SetupCheckResponse } | null>(null);
  const [replace, setReplace] = useState(false);
  const [confirmName, setConfirmName] = useState('');

  const answer = checked?.answer;
  const stale = checked !== null && checked.text !== text;
  const name = answer?.existing?.name ?? answer?.summary?.restaurant ?? '';
  const confirmed = !replace || confirmName.trim().toLowerCase() === name.toLowerCase();
  const canImport = answer?.valid === true && !stale && (!answer.existing || replace) && confirmed;

  const parse = () => {
    const parsed = parsePasted(text);
    setNotJson(parsed.ok ? null : parsed.message);
    return parsed.ok ? parsed.data : undefined;
  };

  const onCheck = () => {
    const data = parse();
    if (data === undefined) return;
    run.reset();
    const sent = text;
    check.mutate(data, { onSuccess: (result) => setChecked({ text: sent, answer: result }) });
  };

  const onImport = () => {
    const data = parse();
    if (data === undefined) return;
    run.mutate(
      { data, replace },
      {
        onSuccess: () => {
          setChecked(null);
          setReplace(false);
          setConfirmName('');
        },
      },
    );
  };

  const importError = run.error instanceof ApiError ? run.error : null;
  const importIssues: SetupIssue[] = importError?.body?.issues ?? [];

  return (
    <section className={styles.section} aria-labelledby="setup-json">
      <h2 id="setup-json" className={styles.sectionTitle}>
        {t('devSetup.json.label')}
      </h2>
      <SetupTemplates
        devKey={devKey}
        onUseSample={(sample) => {
          setText(sample);
          setNotJson(null);
        }}
      />
      <Textarea
        id="setup-json-text"
        className={styles.json}
        label={t('devSetup.json.label')}
        hideLabel
        hint={t('devSetup.json.hint')}
        error={notJson ? t('devSetup.json.invalid', { message: notJson }) : undefined}
        spellCheck={false}
        autoComplete="off"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />

      <label className={styles.check}>
        <input
          type="checkbox"
          checked={replace}
          onChange={(event) => {
            setReplace(event.target.checked);
            setConfirmName('');
          }}
        />
        <span>
          <span className={styles.checkLabel}>{t('devSetup.json.replace')}</span>
          <span className={styles.muted}>{t('devSetup.json.replaceHint')}</span>
        </span>
      </label>
      {replace && name && (
        <Input
          id="setup-confirm"
          autoComplete="off"
          label={t('devSetup.json.confirmLabel')}
          hint={t('devSetup.json.confirmHint', { name })}
          value={confirmName}
          onChange={(event) => setConfirmName(event.target.value)}
        />
      )}

      <div className={styles.actions}>
        <Button
          variant="secondary"
          iconStart="check"
          loading={check.isPending}
          disabled={!text.trim()}
          onClick={onCheck}
        >
          {t('devSetup.json.check')}
        </Button>
        <Button
          iconStart="sparkle"
          loading={run.isPending}
          disabled={!canImport || run.isPending}
          onClick={onImport}
        >
          {run.isPending ? t('devSetup.json.importing') : t('devSetup.json.import')}
        </Button>
        {!answer && <span className={styles.muted}>{t('devSetup.json.checkFirst')}</span>}
        {stale && <span className={styles.muted}>{t('devSetup.json.changed')}</span>}
      </div>

      {check.isError && (
        <Banner tone="err" icon="alert" live="assertive">
          {t('devSetup.import.failed')}
        </Banner>
      )}
      {answer && !stale && <CheckAnswer answer={answer} />}

      {run.isError && (
        <Banner tone="err" icon="alert" live="assertive">
          {importError?.code === 'conflict'
            ? t('devSetup.import.exists')
            : importIssues.length
              ? t('devSetup.check.invalid')
              : t('devSetup.import.failed')}
        </Banner>
      )}
      {importIssues.length > 0 && <IssueList issues={importIssues} />}
      {run.data && <SetupResult result={run.data} />}
    </section>
  );
}

function IssueList({ issues }: { issues: SetupIssue[] }) {
  return (
    <ul className={styles.issues}>
      {issues.map((issue) => (
        <li key={`${issue.path} ${issue.message}`}>
          <code>{issue.path}</code> {issue.message}
        </li>
      ))}
    </ul>
  );
}

/** What the check found: what will be made, what's wrong, what's worth a look. */
function CheckAnswer({ answer }: { answer: SetupCheckResponse }) {
  const t = useContent('common');
  const { summary } = answer;
  return (
    <div className={styles.answer}>
      {answer.valid ? (
        <Banner tone="ok" live="polite">
          {t('devSetup.check.valid')}
        </Banner>
      ) : (
        <Banner tone="err" icon="alert" live="assertive">
          {t('devSetup.check.invalid')}
        </Banner>
      )}
      {answer.issues.length > 0 && <IssueList issues={answer.issues} />}
      {answer.existing && (
        <Banner tone="info">
          {t('devSetup.check.existing', {
            name: answer.existing.name,
            date: new Date(answer.existing.createdAt).toLocaleString(),
          })}
        </Banner>
      )}
      {summary && (
        <dl className={styles.summary}>
          <dt>{t('devSetup.check.summary.restaurant')}</dt>
          <dd>{summary.restaurant}</dd>
          <dt>{t('devSetup.check.summary.branch')}</dt>
          <dd>{summary.branch}</dd>
          <dt>{t('devSetup.check.summary.region')}</dt>
          <dd>
            {summary.country} · {summary.currency}
          </dd>
          <dt>{t('devSetup.check.summary.tables')}</dt>
          <dd>{t.plural('devSetup.check.tables', summary.floors, { tables: summary.tables })}</dd>
          <dt>{t('devSetup.check.summary.staff')}</dt>
          <dd>
            {summary.staff.map((s) => `${s.name} (${t(`devSetup.roles.${s.role}`)})`).join(', ')}
          </dd>
          <dt>{t('devSetup.check.summary.menu')}</dt>
          <dd>
            {t('devSetup.check.menu', {
              dishes: summary.dishes,
              categories: summary.categories,
            })}
          </dd>
        </dl>
      )}
      {answer.warnings.length > 0 && (
        <>
          <p className={styles.muted}>{t('devSetup.check.warnings')}</p>
          <ul className={styles.warnings}>
            {answer.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
