'use client';

import { useState } from 'react';
import { ApiError } from '@/api/client';
import type { MenuCheckResponse, SetupClient, SetupIssue } from '@/api/contracts';
import { useContent, useSetupClients } from '@/api/hooks';
import { useCheckMenu, useLoadMenu } from '@/api/mutations';
import { Banner, Button, Select, Skeleton, Textarea } from '@/components/ui';
import { parsePasted } from '@/lib/devSetup';
import { SetupTemplates } from './SetupTemplates';
import styles from './DevSetup.module.css';

/** Why a load was refused, as the card words it. */
type Refusal = 'hasMenu' | 'hasOrders' | 'planLimit' | 'invalid' | 'failed';

function refusalOf(error: unknown): Refusal {
  if (!(error instanceof ApiError)) return 'failed';
  const reason = error.body?.reason;
  if (error.code === 'conflict' && (reason === 'hasMenu' || reason === 'hasOrders')) return reason;
  if (error.code === 'plan_limit') return 'planLimit';
  if (error.body?.issues?.length) return 'invalid';
  return 'failed';
}

/**
 * Load a menu into a branch: any client's (a new branch starts empty), from a menu JSON Claude
 * wrote from the menu's photos. Pick the client and branch, paste, Check, then Load. A branch
 * with a menu is replaced only when ticked; one that has taken orders is never touched here.
 */
export function MenuLoad({ devKey, by }: { devKey: string; by: string }) {
  const t = useContent('common');
  const clients = useSetupClients(devKey);
  const check = useCheckMenu(devKey);
  const load = useLoadMenu(devKey);
  const [clientId, setClientId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [text, setText] = useState('');
  const [notJson, setNotJson] = useState<string | null>(null);
  /** The last check's answer, and the branch and text it was for. */
  const [checked, setChecked] = useState<{
    branchId: string;
    text: string;
    answer: MenuCheckResponse;
  } | null>(null);
  const [replace, setReplace] = useState(false);

  const list: SetupClient[] = clients.data ?? [];
  const client = list.find((c) => c.id === clientId);
  const branch = client?.branches.find((b) => b.id === branchId);
  const answer = checked?.answer;
  const stale = checked !== null && (checked.text !== text || checked.branchId !== branchId);
  const canLoad =
    answer?.valid === true && !stale && (!answer.replaces || replace) && !load.isPending;

  const parse = () => {
    const parsed = parsePasted(text);
    setNotJson(parsed.ok ? null : parsed.message);
    return parsed.ok ? parsed.data : undefined;
  };

  const choose = (nextClient: string, nextBranch: string) => {
    setClientId(nextClient);
    setBranchId(nextBranch);
    setReplace(false);
    load.reset();
  };

  const onCheck = () => {
    const data = parse();
    if (data === undefined || !branchId) return;
    load.reset();
    const sent = { branchId, text };
    check.mutate(
      { branchId, data },
      { onSuccess: (result) => setChecked({ ...sent, answer: result }) },
    );
  };

  const onLoad = async () => {
    const data = parse();
    if (data === undefined || !branchId) return;
    try {
      await load.mutateAsync({ branchId, data, replace, by });
      setChecked(null);
      setReplace(false);
    } catch {
      // Shown below from load.error.
    }
  };

  const refusal = load.isError ? refusalOf(load.error) : null;
  const loadIssues: SetupIssue[] =
    load.error instanceof ApiError ? (load.error.body?.issues ?? []) : [];

  return (
    <section className={styles.section} aria-labelledby="menu-load">
      <h2 id="menu-load" className={styles.sectionTitle}>
        {t('devSetup.menu.title')}
      </h2>
      <p className={styles.muted}>{t('devSetup.menu.intro')}</p>

      {clients.isError ? (
        <Banner tone="err" icon="alert">
          {t('devSetup.menu.clientsFailed')}
        </Banner>
      ) : !clients.data ? (
        <Skeleton height={56} />
      ) : (
        <div className={styles.pickers}>
          <Select
            id="menu-load-client"
            label={t('devSetup.menu.client')}
            value={clientId}
            onChange={(event) => {
              const next = list.find((c) => c.id === event.target.value);
              choose(event.target.value, next?.branches[0]?.id ?? '');
            }}
          >
            <option value="">{t('devSetup.menu.chooseClient')}</option>
            {list.map((c) => (
              <option key={c.id} value={c.id}>
                {c.demo ? t('devSetup.menu.demoClient', { name: c.name }) : c.name}
              </option>
            ))}
          </Select>
          <Select
            id="menu-load-branch"
            label={t('devSetup.menu.branch')}
            hint={
              branch
                ? branch.orders > 0
                  ? t.plural('devSetup.menu.branchOrders', branch.orders, {
                      dishes: branch.dishes,
                    })
                  : branch.dishes > 0
                    ? t('devSetup.menu.branchMenu', { dishes: branch.dishes })
                    : t('devSetup.menu.branchEmpty')
                : undefined
            }
            value={branchId}
            disabled={!client}
            onChange={(event) => choose(clientId, event.target.value)}
          >
            <option value="">{t('devSetup.menu.chooseBranch')}</option>
            {client?.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {t('devSetup.menu.branchOption', { branch: b.shortName, city: b.city })}
              </option>
            ))}
          </Select>
        </div>
      )}

      <SetupTemplates
        devKey={devKey}
        kind="menu"
        onUseSample={(sample) => {
          setText(sample);
          setNotJson(null);
        }}
      />
      <Textarea
        id="menu-load-json"
        className={styles.json}
        label={t('devSetup.menu.json')}
        hideLabel
        hint={t('devSetup.menu.jsonHint')}
        error={notJson ? t('devSetup.json.invalid', { message: notJson }) : undefined}
        spellCheck={false}
        autoComplete="off"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />

      {answer && !stale && answer.replaces && !answer.blocked && (
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={replace}
            onChange={(event) => setReplace(event.target.checked)}
          />
          <span>
            <span className={styles.checkLabel}>
              {t('devSetup.menu.replace', { dishes: answer.branch.dishes })}
            </span>
            <span className={styles.muted}>{t('devSetup.menu.replaceHint')}</span>
          </span>
        </label>
      )}

      <div className={styles.actions}>
        <Button
          variant="secondary"
          iconStart="check"
          loading={check.isPending}
          disabled={!text.trim() || !branchId}
          onClick={onCheck}
        >
          {t('devSetup.json.check')}
        </Button>
        <Button
          iconStart="sparkle"
          loading={load.isPending}
          disabled={!canLoad}
          onClick={() => void onLoad()}
        >
          {load.isPending ? t('devSetup.menu.loading') : t('devSetup.menu.load')}
        </Button>
        {!branchId ? (
          <span className={styles.muted}>{t('devSetup.menu.pickFirst')}</span>
        ) : !answer ? (
          <span className={styles.muted}>{t('devSetup.menu.checkFirst')}</span>
        ) : (
          stale && <span className={styles.muted}>{t('devSetup.json.changed')}</span>
        )}
      </div>

      {check.isError && (
        <Banner tone="err" icon="alert" live="assertive">
          {t('devSetup.menu.checkFailed')}
        </Banner>
      )}
      {answer && !stale && <MenuCheckAnswer answer={answer} />}

      {refusal && (
        <Banner tone="err" icon="alert" live="assertive">
          {t(`devSetup.menu.refused.${refusal}`, {
            limit: load.error instanceof ApiError ? (load.error.body?.max ?? 0) : 0,
          })}
        </Banner>
      )}
      {loadIssues.length > 0 && <IssueList issues={loadIssues} />}
      {load.data && (
        <Banner tone="ok" live="polite">
          {t(load.data.replaced ? 'devSetup.menu.replaced' : 'devSetup.menu.done', {
            branch: load.data.branch.name,
            dishes: load.data.summary.dishes,
            categories: load.data.summary.categories,
          })}{' '}
          <a
            href={`/?branch=${encodeURIComponent(load.data.branch.id)}`}
            target="_blank"
            rel="noreferrer"
          >
            {t('devSetup.menu.openGuest')}
          </a>
        </Banner>
      )}
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

/** What the check found: the branch now, the menu it would get, problems and warnings. */
function MenuCheckAnswer({ answer }: { answer: MenuCheckResponse }) {
  const t = useContent('common');
  const { summary, branch } = answer;
  return (
    <div className={styles.answer}>
      {answer.blocked ? (
        <Banner tone="err" icon="alert" live="assertive">
          {t.plural('devSetup.menu.blocked', branch.orders, { branch: branch.name })}
        </Banner>
      ) : answer.valid ? (
        <Banner tone="ok" live="polite">
          {t('devSetup.menu.valid')}
        </Banner>
      ) : (
        <Banner tone="err" icon="alert" live="assertive">
          {t('devSetup.check.invalid')}
        </Banner>
      )}
      {answer.issues.length > 0 && <IssueList issues={answer.issues} />}
      <dl className={styles.summary}>
        <dt>{t('devSetup.check.summary.branch')}</dt>
        <dd>{branch.name}</dd>
        <dt>{t('devSetup.menu.now')}</dt>
        <dd>
          {branch.dishes || branch.categories
            ? t('devSetup.check.menu', { dishes: branch.dishes, categories: branch.categories })
            : t('devSetup.menu.empty')}
        </dd>
        {summary && !answer.blocked && (
          <>
            <dt>{t('devSetup.menu.after')}</dt>
            <dd>
              {t('devSetup.check.menu', {
                dishes: summary.dishes,
                categories: summary.categories,
              })}
            </dd>
          </>
        )}
      </dl>
      {answer.warnings.length > 0 && !answer.blocked && (
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
