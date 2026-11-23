'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { isBackendEnabled } from '@/api/backend';
import { ApiError } from '@/api/client';
import { useContent, useSetupRestaurants } from '@/api/hooks';
import { Banner, Button, Input } from '@/components/ui';
import { saveDevKey, savedDevKey } from '@/lib/devSetup';
import { SetupImport } from './SetupImport';
import { SetupRestaurants } from './SetupRestaurants';
import styles from './DevSetup.module.css';

type KeyProblem = 'wrong' | 'tooMany' | 'failed';

/** The saved key only changes on this page, which re-renders when it does. */
const noChange = () => () => undefined;

function keyProblem(error: unknown): KeyProblem {
  if (error instanceof ApiError && error.status === 401) return 'wrong';
  if (error instanceof ApiError && error.status === 429) return 'tooMany';
  return 'failed';
}

/**
 * The developer setup page (/dev-setup/, linked from nowhere): a client's restaurant, menu and
 * staff loaded from one JSON before a demo. The developer key unlocks it; the server checks the
 * key on every request, so the page itself gives nothing away.
 */
export function DevSetup() {
  const t = useContent('common');
  // The key this tab unlocked with before (none in the prerendered HTML), or the one just typed.
  const saved = useSyncExternalStore(noChange, savedDevKey, () => null);
  const [entered, setEntered] = useState<string | null>(null);
  const key = entered ?? saved;
  const [draft, setDraft] = useState('');
  const restaurants = useSetupRestaurants(key);
  const unlocked = key !== null && restaurants.isSuccess;
  const problem = key !== null && restaurants.isError ? keyProblem(restaurants.error) : null;

  // Kept for the tab once the server takes it; forgotten when it doesn't.
  useEffect(() => {
    if (key && restaurants.isSuccess) saveDevKey(key);
    if (restaurants.isError) saveDevKey(null);
  }, [key, restaurants.isSuccess, restaurants.isError]);

  const lock = () => {
    saveDevKey(null);
    setEntered(null);
    setDraft('');
  };

  const unlock = () => {
    const typed = draft.trim();
    if (!typed) return;
    if (typed === key) void restaurants.refetch();
    else setEntered(typed);
  };

  return (
    <main id="main" className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('devSetup.title')}</h1>
          <p className={styles.subtitle}>{t('devSetup.subtitle')}</p>
        </div>
        {unlocked && (
          <Button variant="secondary" size="sm" iconStart="lock" onClick={lock}>
            {t('devSetup.key.lock')}
          </Button>
        )}
      </header>

      {!isBackendEnabled() ? (
        <Banner tone="err" icon="alert">
          {t('devSetup.noBackend')}
        </Banner>
      ) : !unlocked ? (
        <form
          className={styles.keyForm}
          onSubmit={(event) => {
            event.preventDefault();
            unlock();
          }}
        >
          {problem && (
            <Banner tone="err" icon="alert" live="assertive">
              {t(`devSetup.key.${problem}`)}
            </Banner>
          )}
          <Input
            id="dev-key"
            type="password"
            autoComplete="off"
            label={t('devSetup.key.label')}
            hint={t('devSetup.key.hint')}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button type="submit" iconStart="lock" loading={key !== null && restaurants.isFetching}>
            {t('devSetup.key.unlock')}
          </Button>
        </form>
      ) : (
        <>
          <SetupImport devKey={key} />
          <SetupRestaurants devKey={key} restaurants={restaurants.data} />
        </>
      )}
    </main>
  );
}
