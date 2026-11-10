'use client';

import { useContent } from '@/api/hooks';
import { Button, Icon, Input, Textarea } from '@/components/ui';
import { HELP_LIMITS, helpErrors, isSocialUrl, withHttps } from '@/lib/branchSettings';
import { moveItem } from '@/lib/adminMenu';
import { SOCIAL_NETWORKS, type HelpSocialNetwork } from '@/types/branch';
import type { HelpSettings } from '@/types/branchSettings';
import { RowButtons } from '../../menu/editor/parts';
import { FieldGrid, SettingsCard, SettingsEditor } from '../shared/SettingsEditor';
import styles from './HelpPageEditor.module.css';

const NETWORK_ICON = {
  instagram: 'instagram',
  facebook: 'facebook',
  youtube: 'youtube',
  x: 'xbrand',
  whatsapp: 'whatsapp',
  googleReviews: 'google',
} as const;

/**
 * Settings › Help page: what the guests' Help page offers, three cards in the order guests see
 * them. Guest Wi-Fi (name and password; only seated guests see them), social media links (one
 * field per network; shared by all branches; an empty one hides its icon), and the questions
 * and answers under "Allergens & FAQs". Anything empty isn't shown.
 */
export function HelpPageEditor() {
  const t = useContent('common');
  return (
    <SettingsEditor
      section="help"
      title={t('adminSettings.sections.help.title')}
      subtitle={t('adminSettings.help.subtitle')}
      check={(value) => helpErrors(value)}
    >
      {({ value, set, errors }) => {
        const has = (code: string) => errors.some((e) => e === code);
        const error = (code: Parameters<typeof has>[0]) =>
          has(code) ? t(`adminSettings.errors.${code as 'wifiLong'}`) : undefined;
        const setSocial = (network: HelpSocialNetwork, url: string) =>
          set({ ...value, social: { ...value.social, [network]: url } });
        const setFaq = (i: number, fields: Partial<HelpSettings['faqs'][number]>) =>
          set({
            ...value,
            faqs: value.faqs.map((f, j) => (j === i ? { ...f, ...fields } : f)),
          });
        return (
          <>
            <SettingsCard
              title={t('adminSettings.help.wifi')}
              hint={t('adminSettings.help.wifiHintCard')}
            >
              <FieldGrid>
                <Input
                  id="help-wifi-name"
                  icon="wifi"
                  label={t('adminSettings.help.wifiName')}
                  placeholder={t('adminSettings.help.wifiNamePlaceholder')}
                  optional
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={HELP_LIMITS.wifiName + 10}
                  value={value.wifiName}
                  error={error('wifiLong')}
                  onChange={(event) => set({ ...value, wifiName: event.target.value })}
                />
                <Input
                  id="help-wifi-password"
                  icon="lock"
                  label={t('adminSettings.help.wifiPassword')}
                  hint={t('adminSettings.help.wifiPasswordHint')}
                  optional
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={HELP_LIMITS.wifiPassword + 10}
                  value={value.wifiPassword}
                  error={error('wifiPasswordLong')}
                  onChange={(event) => set({ ...value, wifiPassword: event.target.value })}
                />
              </FieldGrid>
            </SettingsCard>

            <SettingsCard
              title={t('adminSettings.help.social')}
              hint={t('adminSettings.help.socialHint')}
            >
              <div className={styles.social}>
                {SOCIAL_NETWORKS.map((network) => {
                  const raw = value.social[network] ?? '';
                  const url = withHttps(raw);
                  const valid = url !== '' && isSocialUrl(network, url);
                  return (
                    <div key={network} className={styles.socialRow}>
                      <span className={styles.socialIcon} aria-hidden="true">
                        <Icon name={NETWORK_ICON[network]} size="sm" />
                      </span>
                      <Input
                        id={`help-social-${network}`}
                        label={t(`adminSettings.help.networks.${network}`)}
                        placeholder={t(`adminSettings.help.placeholders.${network}`)}
                        optional
                        type="url"
                        inputMode="url"
                        autoComplete="off"
                        spellCheck={false}
                        value={raw}
                        error={error(`${network}Url`)}
                        onChange={(event) => setSocial(network, event.target.value)}
                      />
                      {valid && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.check}
                          aria-label={t('adminSettings.help.openLabel', {
                            network: t(`adminSettings.help.networks.${network}`),
                          })}
                        >
                          {t('adminSettings.help.open')}
                          <Icon name="arrow" size="xs" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </SettingsCard>

            <SettingsCard
              title={t('adminSettings.help.faqs')}
              hint={t('adminSettings.help.faqsHint')}
            >
              {value.faqs.length === 0 ? (
                <p className="t-small c3">{t('adminSettings.help.noFaqs')}</p>
              ) : (
                <ol className={styles.faqs}>
                  {value.faqs.map((faq, i) => (
                    <li key={i} className={styles.faq}>
                      <div className={styles.faqHead}>
                        <span className={styles.faqNumber}>{i + 1}</span>
                        <Input
                          id={`help-faq-${i}-question`}
                          label={t('adminSettings.help.question')}
                          placeholder={t('adminSettings.help.questionPlaceholder')}
                          maxLength={HELP_LIMITS.faqQuestion + 10}
                          value={faq.question}
                          error={
                            has('faqQuestion') &&
                            ((!faq.question.trim() && faq.answer.trim()) ||
                              faq.question.trim().length > HELP_LIMITS.faqQuestion)
                              ? error('faqQuestion')
                              : undefined
                          }
                          onChange={(event) => setFaq(i, { question: event.target.value })}
                        />
                        <RowButtons
                          name={faq.question || t('adminSettings.help.question')}
                          first={i === 0}
                          last={i === value.faqs.length - 1}
                          removeLabel={
                            faq.question
                              ? t('adminSettings.help.removeFaq', { question: faq.question })
                              : t('adminSettings.help.removeFaqUntitled')
                          }
                          onMove={(by) => set({ ...value, faqs: moveItem(value.faqs, i, by) })}
                          onRemove={() =>
                            set({ ...value, faqs: value.faqs.filter((_, j) => j !== i) })
                          }
                        />
                      </div>
                      <Textarea
                        id={`help-faq-${i}-answer`}
                        label={t('adminSettings.help.answer')}
                        placeholder={t('adminSettings.help.answerPlaceholder')}
                        rows={3}
                        maxLength={HELP_LIMITS.faqAnswer + 20}
                        value={faq.answer}
                        error={
                          has('faqAnswer') &&
                          ((!faq.answer.trim() && faq.question.trim()) ||
                            faq.answer.trim().length > HELP_LIMITS.faqAnswer)
                            ? error('faqAnswer')
                            : undefined
                        }
                        onChange={(event) => setFaq(i, { answer: event.target.value })}
                      />
                    </li>
                  ))}
                </ol>
              )}
              <div className={styles.addRow}>
                <Button
                  variant="secondary"
                  iconStart="plus"
                  disabled={value.faqs.length >= HELP_LIMITS.faqs}
                  onClick={() =>
                    set({ ...value, faqs: [...value.faqs, { question: '', answer: '' }] })
                  }
                >
                  {t('adminSettings.help.addFaq')}
                </Button>
                <span className="t-small c3">
                  {t('adminSettings.help.faqCount', { count: value.faqs.length })}
                </span>
              </div>
            </SettingsCard>
          </>
        );
      }}
    </SettingsEditor>
  );
}
