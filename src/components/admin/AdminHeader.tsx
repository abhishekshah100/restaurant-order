'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Icon } from '@/components/ui';
import { signOutAdmin } from '@/lib/adminAuth';
import styles from './AdminHeader.module.css';

const COPY = {
  brand: 'The Olive Table',
  signOut: 'Sign out',
} as const;

export function AdminHeader({ branchName }: { branchName?: string }) {
  const router = useRouter();

  const signOut = () => {
    signOutAdmin();
    router.replace('/admin/login/');
  };

  return (
    <header className={styles.header}>
      <Link className={styles.brand} href="/admin/dashboard/">
        <Icon name="olive" size="md" />
        <span>{COPY.brand}</span>
        {branchName && <span className={styles.branch}>{branchName}</span>}
      </Link>
      <Button variant="secondary" size="sm" iconStart="user" onClick={signOut}>
        {COPY.signOut}
      </Button>
    </header>
  );
}
