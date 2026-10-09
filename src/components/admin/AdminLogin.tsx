'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useBranches } from '@/api/hooks';
import { Button, Icon, Input } from '@/components/ui';
import { selectAdminBranch, signInAdmin } from '@/lib/adminAuth';
import {
  DEMO_ADMIN_CREDENTIALS,
  adminLoginSchema,
  isDemoAdminLogin,
  type AdminLoginValues,
} from '@/lib/adminLogin';
import styles from './AdminLogin.module.css';

const COPY = {
  brand: 'The Olive Table',
  descriptor: 'Restaurant & Bar',
  tagline: 'Good food · Great vibes · Together',
  welcome: 'Welcome Back',
  subtitle: 'Login to access your dashboard',
  identity: 'Email / Mobile Number',
  password: 'Password',
  showPassword: 'Show password',
  hidePassword: 'Hide password',
  forgotPassword: 'Forgot password?',
  login: 'Login',
  invalidCredentials: 'Those credentials do not match the demo account.',
  recovery: 'Password recovery will be available when admin accounts are connected.',
  loginError: 'Check the highlighted fields and try again.',
} as const;

function Brand({ className }: { className?: string }) {
  return (
    <div className={className}>
      <Icon name="olive" size="lg" />
      <div className={styles.brandText}>
        <span className={styles.brandName}>{COPY.brand}</span>
        <span className={styles.brandDescriptor}>{COPY.descriptor}</span>
      </div>
    </div>
  );
}

export function AdminLogin() {
  const branches = useBranches();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; success: boolean } | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AdminLoginValues>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: {
      identity: DEMO_ADMIN_CREDENTIALS.email,
      password: DEMO_ADMIN_CREDENTIALS.password,
    },
  });

  const onSubmit = (values: AdminLoginValues) => {
    if (!isDemoAdminLogin(values)) {
      setFeedback({ success: false, message: COPY.invalidCredentials });
      return;
    }

    signInAdmin();
    if (branches.length === 1) {
      selectAdminBranch(branches[0].id);
      router.replace('/admin/dashboard/');
    } else {
      router.replace('/admin/select-branch/');
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.visual} aria-label={COPY.brand}>
        <Image
          className={styles.visualImage}
          src="/images/pasta-hero.jpg"
          alt=""
          fill
          priority
          sizes="(max-width: 767px) 100vw, 58vw"
        />
        <div className={styles.visualShade} />
        <Brand className={styles.visualBrand} />
        <p className={styles.tagline}>{COPY.tagline}</p>
        <span className={styles.taglineRule} aria-hidden="true" />
      </section>

      <section className={styles.formPane}>
        <div className={styles.card}>
          <Brand className={styles.cardBrand} />
          <div className={styles.intro}>
            <h1 className={styles.title}>{COPY.welcome}</h1>
            <p className={styles.subtitle}>{COPY.subtitle}</p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
            <Input
              id="admin-identity"
              label={COPY.identity}
              icon="user"
              type="text"
              autoComplete="username"
              inputMode="email"
              placeholder={COPY.identity}
              error={errors.identity?.message}
              {...register('identity')}
            />

            <div className={styles.passwordField}>
              <Input
                id="admin-password"
                label={COPY.password}
                icon="lock"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder={COPY.password}
                error={errors.password?.message}
                {...register('password')}
              />
              <button
                className={styles.passwordToggle}
                type="button"
                aria-label={showPassword ? COPY.hidePassword : COPY.showPassword}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                <Icon name={showPassword ? 'eyeoff' : 'eye'} size="sm" />
              </button>
            </div>

            <div className={styles.forgotRow}>
              <button
                className={styles.forgot}
                type="button"
                onClick={() => setFeedback({ message: COPY.recovery, success: false })}
              >
                {COPY.forgotPassword}
              </button>
            </div>

            <Button type="submit" block loading={isSubmitting} iconEnd="arrow">
              {COPY.login}
            </Button>

            {feedback && (
              <p
                className={feedback.success ? styles.successMessage : styles.errorMessage}
                role={feedback.success ? 'status' : 'alert'}
              >
                {feedback.message}
              </p>
            )}
            {!feedback && Object.keys(errors).length > 0 && (
              <p className={styles.errorMessage} role="alert">
                {COPY.loginError}
              </p>
            )}
          </form>
        </div>
      </section>
    </main>
  );
}
