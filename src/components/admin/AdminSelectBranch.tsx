'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminBranches, useContent } from '@/api/hooks';
import { Button, EmptyState, SearchField } from '@/components/ui';
import { useAdminName, useSignOutAdmin } from '@/hooks/useAdminSession';
import { useNow } from '@/hooks/useNow';
import { selectAdminBranch, selectedAdminBranchId } from '@/lib/adminAuth';
import {
  ADMIN_PATHS,
  BRANCH_SEARCH_MIN,
  filterAdminBranches,
  sortAdminBranches,
} from '@/lib/adminBranches';
import { cx } from '@/lib/cx';
import { AdminAccess } from './AdminAccess';
import { AdminTopBar } from './AdminTopBar';
import { BranchGrid, BranchGridSkeleton } from './BranchGrid';
import styles from './AdminSelectBranch.module.css';

/** From this many branches wide screens get three columns (fewer would leave a gap). */
const WIDE_GRID_MIN = 3;

interface ShellProps {
  adminName?: string;
  onSignOut?: () => void;
  /** The search field, beside the title on wide screens. */
  toolbar?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}

/** The page frame: the app bar, the title and the content below it. */
function SelectBranchShell({ adminName, onSignOut, toolbar, wide, children }: ShellProps) {
  const t = useContent('common');
  return (
    <div className={styles.page}>
      <AdminTopBar adminName={adminName} onSignOut={onSignOut} />
      <main id="main" className={cx(styles.main, wide && styles.wide)}>
        <header className={styles.intro}>
          <div className={styles.introText}>
            <h1 className={styles.title}>{t('adminSelectBranch.title')}</h1>
            <p className={styles.subtitle}>{t('adminSelectBranch.subtitle')}</p>
          </div>
          {toolbar}
        </header>
        {children}
      </main>
    </div>
  );
}

function SelectBranchScreen() {
  const t = useContent('common');
  const router = useRouter();
  const adminName = useAdminName();
  const signOut = useSignOutAdmin();
  const query = useAdminBranches();
  const now = useNow();
  // Read once, so choosing a branch doesn't reorder the cards on the way out.
  const [lastUsedId] = useState(selectedAdminBranchId);
  const [search, setSearch] = useState('');

  const branches = useMemo(
    () => sortAdminBranches(query.data ?? [], lastUsedId),
    [query.data, lastUsedId],
  );
  const searchable = branches.length >= BRANCH_SEARCH_MIN;
  const visible = useMemo(
    () => (searchable ? filterAdminBranches(branches, search) : branches),
    [branches, search, searchable],
  );

  const choose = (branchId: string) => {
    selectAdminBranch(branchId);
    router.push(ADMIN_PATHS.dashboard);
  };
  const leave = () => {
    signOut();
    router.replace(ADMIN_PATHS.login);
  };

  let content: ReactNode;
  if (query.isPending) {
    content = <BranchGridSkeleton label={t('adminSelectBranch.loading')} />;
  } else if (query.isError) {
    content = (
      <EmptyState
        icon="wifioff"
        tone="err"
        title={t('adminSelectBranch.error.title')}
        titleClassName={styles.stateTitle}
        className={styles.state}
        actions={
          <Button iconStart="refresh" loading={query.isFetching} onClick={() => query.refetch()}>
            {t('adminSelectBranch.error.retry')}
          </Button>
        }
      >
        {t('adminSelectBranch.error.body')}
      </EmptyState>
    );
  } else if (branches.length === 0) {
    content = (
      <EmptyState
        icon="store"
        tone="neutral"
        title={t('adminSelectBranch.empty.title')}
        titleClassName={styles.stateTitle}
        className={styles.state}
      >
        {t('adminSelectBranch.empty.body')}
      </EmptyState>
    );
  } else if (visible.length === 0) {
    content = (
      <EmptyState
        icon="search"
        tone="neutral"
        title={t('adminSelectBranch.noResults.title', { query: search.trim() })}
        titleClassName={styles.stateTitle}
        className={styles.state}
        actions={
          <Button variant="secondary" onClick={() => setSearch('')}>
            {t('adminSelectBranch.noResults.clear')}
          </Button>
        }
      >
        {t('adminSelectBranch.noResults.body')}
      </EmptyState>
    );
  } else {
    content = (
      <BranchGrid
        branches={visible}
        now={now}
        lastUsedId={lastUsedId}
        onSelect={choose}
        wide={branches.length >= WIDE_GRID_MIN}
      />
    );
  }

  return (
    <SelectBranchShell
      adminName={adminName}
      onSignOut={leave}
      wide={branches.length >= WIDE_GRID_MIN}
      toolbar={
        searchable && (
          <div className={styles.toolbar}>
            <SearchField
              id="branch-search"
              value={search}
              onChange={setSearch}
              onEscape={() => setSearch('')}
              label={t('adminSelectBranch.search.label')}
              placeholder={t('adminSelectBranch.search.placeholder')}
              clearLabel={t('adminSelectBranch.search.clear')}
            />
            <p className="visually-hidden" role="status">
              {search.trim() && t.plural('adminSelectBranch.results', visible.length)}
            </p>
          </div>
        )
      }
    >
      {content}
    </SelectBranchShell>
  );
}

/** /admin/select-branch/: the admin picks the branch to work in (GET /admin/branches). */
export function AdminSelectBranch() {
  const t = useContent('common');
  return (
    <AdminAccess
      fallback={
        <SelectBranchShell>
          <BranchGridSkeleton label={t('adminSelectBranch.loading')} />
        </SelectBranchShell>
      }
    >
      <SelectBranchScreen />
    </AdminAccess>
  );
}
