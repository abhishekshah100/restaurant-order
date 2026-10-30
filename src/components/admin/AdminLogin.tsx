'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { isApiError } from '@/api/client';
import { useAdminBranches, useContent, useDemoAdminAccount } from '@/api/hooks';
import { useBrandName, useBrandTitle } from '@/hooks/useBrandName';
import { useAdminLogin } from '@/api/mutations';
import { Banner, Button, Icon, Input } from '@/components/ui';
import { selectAdminBranch, signInAdmin } from '@/lib/adminAuth';
import { useAdminToken } from '@/hooks/useAdminSession';
import { adminLanding } from '@/lib/adminBranches';
import { adminLoginSchema, type AdminLoginValues } from '@/lib/adminLogin';
import styles from './AdminLogin.module.css';

const PHOTO = '/images/pasta-hero.jpg';
const PHOTO_WIDTH = 780;
const PHOTO_HEIGHT = 540;

export function AdminLogin() {
  const t = useContent('common');
  const brand = useBrandName();
  useBrandTitle(brand);
  const router = useRouter();
  const login = useAdminLogin();
  // The branches of the session just started decide where to go (one: its dashboard).
  const branches = useAdminBranches();
  const token = useAdminToken();
  const signedInNow = login.isSuccess && token === login.data.token;
  const branchesFailed = signedInNow && branches.isError;
  const demoAccount = useDemoAdminAccount();
  const [showPassword, setShowPassword] = useState(false);
  const schema = useMemo(() => adminLoginSchema(t.get('adminLogin.validation')), [t]);
  const {
    register,
    handleSubmit,
    setValue,
    clearErrors,
    formState: { errors },
  } = useForm<AdminLoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { identity: '', password: '' },
  });

  const onSubmit = (values: AdminLoginValues) => login.mutate(values, { onSuccess: signInAdmin });

  useEffect(() => {
    if (!signedInNow || !branches.data) return;
    const landing = adminLanding(branches.data);
    if (landing.select) selectAdminBranch(landing.select);
    router.replace(landing.to);
  }, [branches.data, signedInNow, router]);

  const fillDemoAccount = () => {
    if (!demoAccount) return;
    setValue('identity', demoAccount.identity);
    setValue('password', demoAccount.password);
    clearErrors();
    login.reset();
  };

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <Image className={styles.bandPhoto} src={PHOTO} alt="" fill loading="eager" sizes="100vw" />
        <div className={styles.brand}>
          <Icon name="olive" size="lg" className={styles.brandMark} />
          <span className={styles.brandText}>
            <span className={styles.brandName}>{brand}</span>
            <span className={styles.descriptor}>{t('adminLogin.descriptor')}</span>
          </span>
        </div>
        <div className={styles.story}>
          <p className={styles.headline}>{t('adminLogin.panel.headline')}</p>
          <span className={styles.rule} aria-hidden="true" />
          <p className={styles.supporting}>{t('adminLogin.panel.body')}</p>
          <Image
            className={styles.photo}
            src={PHOTO}
            alt=""
            width={PHOTO_WIDTH}
            height={PHOTO_HEIGHT}
            loading="eager"
            sizes="320px"
          />
        </div>
      </section>

      <div className={styles.formPane}>
        <div className={styles.card}>
          <header className={styles.intro}>
            <h1 className={styles.title}>{t('adminLogin.title')}</h1>
            <p className={styles.subtitle}>{t('adminLogin.subtitle')}</p>
          </header>

          {(login.isError || branchesFailed) && (
            <Banner tone="err" icon="alert" live="assertive" className={styles.alert}>
              {isApiError(login.error, 'invalid_credentials')
                ? t('adminLogin.errors.invalidCredentials')
                : isApiError(login.error, 'rate_limited')
                  ? t('adminLogin.errors.tooManyAttempts')
                  : t('adminLogin.errors.requestFailed')}
            </Banner>
          )}

          {/* POST: a submit before the page's script runs must never put the password in the URL. */}
          <form className={styles.form} method="post" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Input
              id="admin-identity"
              label={t('adminLogin.identity')}
              icon="user"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={t('adminLogin.identityPlaceholder')}
              error={errors.identity?.message}
              {...register('identity')}
            />

            <div className={styles.passwordField}>
              <Input
                id="admin-password"
                label={t('adminLogin.password')}
                icon="lock"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder={t('adminLogin.passwordPlaceholder')}
                error={errors.password?.message}
                {...register('password')}
              />
              <button
                className={styles.passwordToggle}
                type="button"
                aria-label={t('adminLogin.showPassword')}
                aria-pressed={showPassword}
                aria-controls="admin-password"
                onClick={() => setShowPassword((visible) => !visible)}
              >
                <Icon name={showPassword ? 'eyeoff' : 'eye'} size="sm" />
              </button>
            </div>

            <Button
              type="submit"
              block
              loading={login.isPending || (login.isSuccess && !branchesFailed)}
              iconEnd="arrow"
              className={styles.submit}
            >
              {t('adminLogin.submit')}
            </Button>
          </form>

          {demoAccount && (
            <aside className={styles.demo} aria-labelledby="admin-demo-title">
              <div className={styles.demoText}>
                <p id="admin-demo-title" className={styles.demoTitle}>
                  {t('adminLogin.demo.title')}
                </p>
                <p className={styles.demoBody}>{t('adminLogin.demo.body')}</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className={styles.demoButton}
                onClick={fillDemoAccount}
              >
                {t('adminLogin.demo.use')}
              </Button>
            </aside>
          )}
        </div>
      </div>
    </main>
  );
}
