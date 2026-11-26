'use client';

import { useContent, useSetupTemplates } from '@/api/hooks';
import { Banner, Button } from '@/components/ui';
import { downloadFile } from '@/lib/saveFile';
import styles from './DevSetup.module.css';

/** The sample as it's downloaded and pasted: indented, ending in a newline. */
export const sampleText = (sample: unknown) => `${JSON.stringify(sample, null, 2)}\n`;

/**
 * Where a setup starts: the prompt to give Claude with the menu photos, the sample JSON it
 * follows, and the sample pasted straight into the box (to rehearse the page itself). `menu`:
 * the menu on its own, for loading into a branch.
 */
export function SetupTemplates({
  devKey,
  kind = 'restaurant',
  onUseSample,
}: {
  devKey: string;
  kind?: 'restaurant' | 'menu';
  onUseSample: (text: string) => void;
}) {
  const t = useContent('common');
  const templates = useSetupTemplates(devKey);
  const data = templates.data
    ? kind === 'menu'
      ? { prompt: templates.data.menuPrompt, sample: templates.data.menuSample }
      : templates.data
    : undefined;
  const words = kind === 'menu' ? 'devSetup.menu.templates' : 'devSetup.templates';
  return (
    <div className={styles.templates}>
      <h3 className={styles.subTitle}>{t(`${words}.title`)}</h3>
      <p className={styles.muted}>{t(`${words}.steps`)}</p>
      {templates.isError ? (
        <Banner tone="err" icon="alert">
          {t('devSetup.templates.failed')}
        </Banner>
      ) : (
        <div className={styles.actions}>
          <Button
            variant="secondary"
            size="sm"
            iconStart="msg"
            disabled={!data}
            onClick={() => {
              if (!data) return;
              downloadFile(
                new Blob([data.prompt], { type: 'text/plain;charset=utf-8' }),
                t(`${words}.promptFile`),
              );
            }}
          >
            {t(`${words}.prompt`)}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            iconStart="receipt"
            disabled={!data}
            onClick={() => {
              if (!data) return;
              downloadFile(
                new Blob([sampleText(data.sample)], { type: 'application/json' }),
                t(`${words}.sampleFile`),
              );
            }}
          >
            {t(`${words}.sample`)}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            iconStart="copy"
            disabled={!data}
            onClick={() => {
              if (data) onUseSample(sampleText(data.sample));
            }}
          >
            {t('devSetup.templates.useSample')}
          </Button>
        </div>
      )}
    </div>
  );
}
