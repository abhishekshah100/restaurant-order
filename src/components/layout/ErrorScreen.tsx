import type { Translator } from '@/api/translator';
import type { ContentMap } from '@/api/queries';
import { Button, EmptyState } from '@/components/ui';
import styles from './ErrorScreen.module.css';

export interface ErrorScreenProps {
  /** Common copy. Passed in because global-error renders outside the query cache. */
  t: Translator<ContentMap['common']>;
  reset: () => void;
}

/** Recovery screen shared by app/error.tsx and app/global-error.tsx. */
export function ErrorScreen({ t, reset }: ErrorScreenProps) {
  return (
    <main id="main" className={styles.page}>
      <EmptyState
        icon="alert"
        tone="err"
        as="h1"
        title={t('error.title')}
        actions={
          <>
            <Button onClick={reset}>{t('error.retry')}</Button>
            <Button href="/menu/" variant="secondary">
              {t('error.backToMenu')}
            </Button>
          </>
        }
      >
        {t('error.body')}
      </EmptyState>
    </main>
  );
}
