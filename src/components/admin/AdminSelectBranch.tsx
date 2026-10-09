'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBranches } from '@/api/hooks';
import { Button, Icon } from '@/components/ui';
import { selectAdminBranch, signOutAdmin } from '@/lib/adminAuth';
import { AdminAccess } from './AdminAccess';
import styles from './AdminSelectBranch.module.css';

const COPY = {
  brand: 'The Olive Table',
  descriptor: 'Restaurant & Bar',
  title: 'Select Your Branch',
  subtitle: 'Choose a branch to continue to your dashboard',
  search: 'Search branch...',
  locationSeparator: ', ',
  open: 'Open',
  closed: 'Closed',
  paused: 'Paused',
  tables: 'Tables',
  select: 'Select',
  noResults: 'No branches match your search.',
  signOut: 'Sign out',
} as const;

const BRANCH_IMAGES: Record<string, string> = {
  'blr-indiranagar': '/images/pasta-hero.jpg',
  'ktm-thamel': '/images/prawns.jpg',
};

function BranchCards() {
  const branches = useBranches();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const visibleBranches = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return branches;
    return branches.filter((branch) =>
      [branch.name, branch.shortName, branch.city, branch.address]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [branches, search]);

  const chooseBranch = (branchId: string) => {
    selectAdminBranch(branchId);
    router.push('/admin/dashboard/');
  };

  return (
    <main className={styles.main}>
      <div className={styles.heading}>
        <div className={styles.mark} aria-hidden="true">
          <Icon name="olive" size="lg" />
        </div>
        <p className={styles.brandName}>{COPY.brand}</p>
        <p className={styles.brandDescriptor}>{COPY.descriptor}</p>
        <h1>{COPY.title}</h1>
        <p className={styles.subtitle}>{COPY.subtitle}</p>
      </div>

      <label className={styles.search}>
        <Icon name="search" size="sm" />
        <span className="visually-hidden">{COPY.search}</span>
        <input
          type="search"
          value={search}
          placeholder={COPY.search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>

      <div className={styles.branchList}>
        {visibleBranches.length > 0 ? (
          <ul
            className={`${styles.cards} ${visibleBranches.length === 1 ? styles.singleCard : ''}`}
          >
            {visibleBranches.map((branch) => {
              const location = [branch.shortName, branch.city].join(COPY.locationSeparator);
              const statusLabel =
                branch.status === 'open'
                  ? COPY.open
                  : branch.status === 'paused'
                    ? COPY.paused
                    : COPY.closed;
              return (
                <li className={styles.card} key={branch.id}>
                  <div className={styles.photo}>
                    <Image
                      src={BRANCH_IMAGES[branch.id] ?? '/images/pasta-hero.jpg'}
                      alt=""
                      fill
                      sizes="(max-width: 767px) 88px, (max-width: 1100px) 40vw, 520px"
                    />
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.cardHeading}>
                      <h2>{branch.shortName}</h2>
                      <span className={`${styles.status} ${styles[branch.status]}`}>
                        <span aria-hidden="true" />
                        {statusLabel}
                      </span>
                    </div>
                    <p className={styles.location}>
                      <Icon name="pin" size="xs" />
                      {location}
                    </p>
                    <div className={styles.meta}>
                      <span>
                        <Icon name="clock" size="xs" />
                        {branch.hoursToday}
                      </span>
                      <span>
                        <Icon name="table" size="xs" />
                        {COPY.tables} {branch.tables.first}–{branch.tables.last}
                      </span>
                    </div>
                    <p className={styles.address}>{branch.address}</p>
                    <Button
                      size="sm"
                      iconEnd="arrow"
                      disabled={branch.status !== 'open'}
                      onClick={() => chooseBranch(branch.id)}
                      className={styles.selectButton}
                    >
                      {COPY.select}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={styles.noResults} role="status">
            {COPY.noResults}
          </p>
        )}
      </div>
      <footer className={styles.footer}>
        <Button
          variant="secondary"
          size="sm"
          iconStart="user"
          onClick={() => {
            signOutAdmin();
            router.replace('/admin/login/');
          }}
        >
          {COPY.signOut}
        </Button>
      </footer>
    </main>
  );
}

export function AdminSelectBranch() {
  return (
    <AdminAccess>
      <div className={styles.page}>
        <BranchCards />
      </div>
    </AdminAccess>
  );
}
