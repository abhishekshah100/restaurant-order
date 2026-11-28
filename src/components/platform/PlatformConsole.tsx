'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { isBackendEnabled } from '@/api/backend';
import { ApiError } from '@/api/client';
import {
  useContent,
  usePlatformClients,
  usePlatformPackages,
  usePlatformSettings,
  useSetupRestaurants,
} from '@/api/hooks';
import { Banner, Button, Input, Skeleton, Tabs } from '@/components/ui';
import { saveDevKey, savedDevKey } from '@/lib/devSetup';
import { savedPlatformName, savePlatformName, type ClientFilter } from '@/lib/platform';
import { MenuLoad } from '../devSetup/MenuLoad';
import { SetupImport } from '../devSetup/SetupImport';
import { SetupRestaurants } from '../devSetup/SetupRestaurants';
import { ClientEditor } from './ClientEditor';
import { ClientList } from './ClientList';
import { NewClientDialog } from './NewClientDialog';
import { PlatformOverview } from './PlatformOverview';
import { CatalogTab } from './CatalogTab';
import { PlatformSettingsForm } from './PlatformSettingsForm';
import styles from './Platform.module.css';

type KeyProblem = 'wrong' | 'tooMany' | 'failed';
export type PlatformTab = 'overview' | 'clients' | 'packages' | 'settings' | 'devSetup';
type Tab = PlatformTab;

/** What's saved only changes on this page, which re-renders when it does. */
const noChange = () => () => undefined;

function keyProblem(error: unknown): KeyProblem {
  if (error instanceof ApiError && error.status === 401) return 'wrong';
  if (error instanceof ApiError && error.status === 429) return 'tooMany';
  return 'failed';
}

/**
 * The platform console (/platform/, and /dev-setup/ on its Dev setup tab; linked from nowhere):
 * the application owner's remote control for every client's package, limits, features, trial,
 * term, price and payments, and the developer setup for demos. The owner's one key
 * (DEV_SETUP_KEY) unlocks it (the server checks it on every request); the owner's name goes with
 * every change.
 */
export function PlatformConsole({ initialTab = 'overview' }: { initialTab?: Tab }) {
  const t = useContent('common');
  const saved = useSyncExternalStore(noChange, savedDevKey, () => null);
  const savedName = useSyncExternalStore(noChange, savedPlatformName, () => null);
  const [entered, setEntered] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const key = entered ?? saved;
  const by = name ?? savedName;
  const [draft, setDraft] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [tab, setTab] = useState<Tab>(initialTab);
  const [filter, setFilter] = useState<ClientFilter>('all');
  const [clientId, setClientId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const clients = usePlatformClients(key);
  const unlocked = key !== null && clients.isSuccess;
  const problem = key !== null && clients.isError ? keyProblem(clients.error) : null;
  const packages = usePlatformPackages(unlocked ? key : null);
  const setupRestaurants = useSetupRestaurants(unlocked && tab === 'devSetup' ? key : null);
  const settings = usePlatformSettings(unlocked ? key : null);

  useEffect(() => {
    if (key && clients.isSuccess) saveDevKey(key);
    if (clients.isError && keyProblem(clients.error) === 'wrong') saveDevKey(null);
  }, [key, clients.isSuccess, clients.isError, clients.error]);

  const lock = () => {
    saveDevKey(null);
    setEntered(null);
    setDraft('');
    setClientId(null);
  };

  const unlock = () => {
    const typed = draft.trim();
    if (!typed) return;
    if (typed === key) void clients.refetch();
    else setEntered(typed);
  };

  const keepName = () => {
    const typed = nameDraft.trim().slice(0, 40);
    if (!typed) return;
    savePlatformName(typed);
    setName(typed);
  };

  return (
    <main id="main" className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('platform.title')}</h1>
          <p className={styles.subtitle}>{t('platform.subtitle')}</p>
        </div>
        {unlocked && (
          <div className={styles.headerActions}>
            {by && (
              <Button
                variant="ghost"
                size="sm"
                iconStart="user"
                onClick={() => {
                  savePlatformName(null);
                  setName(null);
                  setNameDraft('');
                }}
              >
                {t('platform.name.change', { name: by })}
              </Button>
            )}
            <Button variant="secondary" size="sm" iconStart="lock" onClick={lock}>
              {t('platform.key.lock')}
            </Button>
          </div>
        )}
      </header>

      {!isBackendEnabled() ? (
        <Banner tone="err" icon="alert">
          {t('platform.noBackend')}
        </Banner>
      ) : !unlocked ? (
        <form
          className={`${styles.panel} ${styles.narrow}`}
          onSubmit={(event) => {
            event.preventDefault();
            unlock();
          }}
        >
          {problem && (
            <Banner tone="err" icon="alert" live="assertive">
              {t(`platform.key.${problem}`)}
            </Banner>
          )}
          <Input
            id="platform-key"
            type="password"
            autoComplete="off"
            label={t('platform.key.label')}
            hint={t('platform.key.hint')}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button type="submit" iconStart="lock" loading={key !== null && clients.isFetching}>
            {t('platform.key.unlock')}
          </Button>
        </form>
      ) : !by ? (
        <form
          className={`${styles.panel} ${styles.narrow}`}
          onSubmit={(event) => {
            event.preventDefault();
            keepName();
          }}
        >
          <h2 className={styles.clientName}>{t('platform.name.title')}</h2>
          <Input
            id="platform-name"
            autoComplete="name"
            maxLength={40}
            label={t('platform.name.label')}
            hint={t('platform.name.hint')}
            value={nameDraft}
            onChange={(event) => setNameDraft(event.target.value)}
          />
          <Button type="submit" disabled={!nameDraft.trim()}>
            {t('platform.name.save')}
          </Button>
        </form>
      ) : clientId ? (
        <ClientEditor
          platformKey={key}
          by={by}
          clientId={clientId}
          onBack={() => setClientId(null)}
          onLoadMenu={() => {
            setClientId(null);
            setTab('devSetup');
          }}
        />
      ) : (
        <>
          <Tabs
            label={t('platform.tabs.label')}
            value={tab}
            onChange={(id) => setTab(id as Tab)}
            items={(['overview', 'clients', 'packages', 'settings', 'devSetup'] as const).map(
              (id) => ({
                id,
                label: t(`platform.tabs.${id}`),
              }),
            )}
          />
          {tab === 'overview' ? (
            <PlatformOverview
              platformKey={key}
              by={by}
              clients={clients.data}
              onFilter={(f) => {
                setFilter(f);
                setTab('clients');
              }}
              onOpen={setClientId}
            />
          ) : tab === 'clients' ? (
            <>
              <div className={styles.spread}>
                <p className={styles.muted}>{t('platform.newClient.hint')}</p>
                <Button iconStart="plus" disabled={!packages.data} onClick={() => setAdding(true)}>
                  {t('platform.newClient.button')}
                </Button>
              </div>
              <ClientList
                clients={clients.data}
                filter={filter}
                onFilter={setFilter}
                onOpen={setClientId}
              />
              {adding && packages.data && (
                <NewClientDialog
                  platformKey={key}
                  by={by}
                  packages={packages.data}
                  onClose={() => setAdding(false)}
                  onOpen={(id) => {
                    setAdding(false);
                    setClientId(id);
                  }}
                />
              )}
            </>
          ) : tab === 'devSetup' ? (
            <>
              <SetupImport devKey={key} />
              <MenuLoad devKey={key} by={by} />
              {setupRestaurants.data ? (
                <SetupRestaurants devKey={key} restaurants={setupRestaurants.data} />
              ) : (
                <Skeleton height={200} />
              )}
            </>
          ) : !packages.data || (tab === 'settings' && !settings.data) ? (
            <Skeleton height={320} />
          ) : tab === 'packages' ? (
            <CatalogTab platformKey={key} by={by} />
          ) : settings.data ? (
            <PlatformSettingsForm
              platformKey={key}
              by={by}
              settings={settings.data}
              packages={packages.data}
            />
          ) : null}
        </>
      )}
    </main>
  );
}
