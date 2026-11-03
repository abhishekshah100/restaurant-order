'use client';

import { useState } from 'react';
import { isApiError } from '@/api/client';
import { useContent } from '@/api/hooks';
import { useChangeOwnPassword } from '@/api/mutations';
import { Banner, Button, Input } from '@/components/ui';
import { isPasswordLongEnough } from '@/lib/staffPassword';
import styles from './AdminLogin.module.css';

/**
 * After signing in with a password an admin gave them (new, or reset), the staff member chooses
 * their own (twice) before going on; the server answers nothing else until they have.
 */
export function NewPasswordStep({
  given,
  onDone,
}: {
  /** The password they signed in with: the current one. */
  given: string;
  onDone: () => void;
}) {
  const t = useContent('common');
  const change = useChangeOwnPassword();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [tried, setTried] = useState(false);
  const problem = !isPasswordLongEnough(password)
    ? t('adminLogin.newPassword.short')
    : password === given
      ? t('adminLogin.newPassword.same')
      : undefined;
  const mismatch = again !== password ? t('adminLogin.newPassword.mismatch') : undefined;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setTried(true);
    if (problem || mismatch) return;
    change.mutate({ currentPassword: given, newPassword: password }, { onSuccess: onDone });
  };

  return (
    <>
      <header className={styles.intro}>
        <h1 className={styles.title}>{t('adminLogin.newPassword.title')}</h1>
        <p className={styles.subtitle}>{t('adminLogin.newPassword.body')}</p>
      </header>
      {change.isError && (
        <Banner tone="err" icon="alert" live="assertive" className={styles.alert}>
          {isApiError(change.error, 'wrong_password')
            ? t('adminLogin.errors.invalidCredentials')
            : t('adminLogin.newPassword.failed')}
        </Banner>
      )}
      <form className={styles.form} method="post" onSubmit={submit} noValidate>
        <Input
          id="admin-new-password"
          type="password"
          icon="lock"
          autoComplete="new-password"
          label={t('adminLogin.newPassword.password')}
          value={password}
          error={tried ? problem : undefined}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Input
          id="admin-new-password-again"
          type="password"
          icon="lock"
          autoComplete="new-password"
          label={t('adminLogin.newPassword.confirm')}
          value={again}
          error={tried && !problem ? mismatch : undefined}
          onChange={(event) => setAgain(event.target.value)}
        />
        <Button
          type="submit"
          block
          loading={change.isPending}
          iconEnd="arrow"
          className={styles.submit}
        >
          {t('adminLogin.newPassword.save')}
        </Button>
      </form>
    </>
  );
}
