'use client';

import { useState } from 'react';
import { useBranchSettings, useContent } from '@/api/hooks';
import { useUpdateBranchSettings } from '@/api/mutations';
import { Button, Dialog } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { SettingsCard, SettingsNote, SettingsSkeleton, ToggleRow } from './shared/SettingsEditor';
import editor from './shared/SettingsEditor.module.css';

/** The days a proof photo is kept when deletion is on (the server takes 30 to 3650). */
const KEEP_DAYS = 90;

/**
 * Settings › Proof photos (the owner: `branches.manage`): whether payment, deposit and supplier-
 * invoice photos are deleted for good 90 days after they were taken, or kept. The restaurant's,
 * for every branch. Turning it on asks first: photos already past 90 days go within the hour.
 */
export function PhotosSettings() {
  const t = useContent('common');
  const { branch, can } = useAdminWorkspace();
  const { showToast } = useToast();
  const query = useBranchSettings(branch.id);
  const save = useUpdateBranchSettings();
  const [confirming, setConfirming] = useState(false);
  const data = query.data;
  if (!data) return <SettingsSkeleton label={t('adminSettings.photos.loading')} />;
  const on = data.settings.photos.deleteProofsAfterDays !== null;
  const owner = can('branches.manage');

  const change = (next: boolean) =>
    save.mutate(
      { branchId: branch.id, body: { photos: { deleteProofsAfterDays: next ? KEEP_DAYS : null } } },
      {
        onSuccess: () => {
          setConfirming(false);
          showToast(t(next ? 'adminSettings.photos.turnedOn' : 'adminSettings.photos.turnedOff'), {
            tone: 'success',
          });
        },
        onError: () => showToast(t('adminSettings.photos.failed'), { tone: 'error' }),
      },
    );

  return (
    <div className={editor.page}>
      <header className={editor.head}>
        <h1 className={editor.title}>{t('adminSettings.sections.photos.title')}</h1>
        <p className={editor.subtitle}>{t('adminSettings.photos.subtitle')}</p>
      </header>
      <SettingsCard
        title={t('adminSettings.photos.card')}
        hint={t('adminSettings.photos.cardHint')}
      >
        <ToggleRow
          id="delete-proof-photos"
          label={t('adminSettings.photos.label')}
          hint={t(on ? 'adminSettings.photos.on' : 'adminSettings.photos.off')}
          checked={on}
          disabled={save.isPending || !owner}
          // Turning it on deletes photos already past 90 days: asked first. Off at once.
          onChange={(next: boolean) => (next ? setConfirming(true) : change(false))}
        />
        {!owner && <p className="t-small c3">{t('adminSettings.photos.ownerOnly')}</p>}
        <SettingsNote tone="warn">{t('adminSettings.photos.note')}</SettingsNote>
      </SettingsCard>

      <Dialog
        open={confirming}
        onClose={() => {
          if (!save.isPending) setConfirming(false);
        }}
        presentation="modal"
        title={t('adminSettings.photos.confirmTitle')}
        footer={
          <div className={editor.footer}>
            <Button
              variant="secondary"
              disabled={save.isPending}
              onClick={() => setConfirming(false)}
            >
              {t('adminSettings.photos.cancel')}
            </Button>
            <Button loading={save.isPending} onClick={() => change(true)}>
              {t('adminSettings.photos.confirm')}
            </Button>
          </div>
        }
      >
        <p>{t('adminSettings.photos.confirmBody')}</p>
      </Dialog>
    </div>
  );
}
