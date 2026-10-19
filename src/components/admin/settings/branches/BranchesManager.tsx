'use client';

import { useState } from 'react';
import { isApiError } from '@/api/client';
import { useAdminBranches, useContent } from '@/api/hooks';
import { useRemoveBranch } from '@/api/mutations';
import { Button, Dialog, IconButton, Tag, type TagVariant } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { selectAdminBranch } from '@/lib/adminAuth';
import { settingsHref } from '@/lib/adminSettings';
import type { AdminBranch } from '@/types/admin';
import type { BranchStatus } from '@/types/branch';
import { useAdminWorkspace } from '../../shell/AdminWorkspace';
import { SettingsNote, SettingsSkeleton } from '../shared/SettingsEditor';
import editor from '../shared/SettingsEditor.module.css';
import { AddBranchDialog } from './AddBranchDialog';
import styles from './BranchesManager.module.css';

const STATUS_TAG: Record<BranchStatus, TagVariant> = { open: 'ok', paused: 'warn', closed: 'err' };

/**
 * Settings › Branches: every branch the admin manages — the one they're working in marked —
 * to switch to, add (a copy of one of them, with its own details) or remove. There's always at
 * least one: the last branch can't be removed, nor one with orders today still to finish or pay.
 */
export function BranchesManager() {
  const t = useContent('common');
  const { branch: current } = useAdminWorkspace();
  const { showToast } = useToast();
  const query = useAdminBranches();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<AdminBranch | null>(null);
  const branches = query.data;

  if (!branches) return <SettingsSkeleton label={t('adminSettings.branches.loading')} />;
  const only = branches.length <= 1;

  return (
    <div className={editor.page}>
      <header className={editor.head}>
        <div className={styles.headRow}>
          <div className={styles.headText}>
            <h1 className={editor.title}>{t('adminSettings.sections.branches.title')}</h1>
            <p className={editor.subtitle}>{t('adminSettings.branches.subtitle')}</p>
          </div>
          <Button iconStart="plus" onClick={() => setAdding(true)}>
            {t('adminSettings.branches.add')}
          </Button>
        </div>
      </header>

      {only && <SettingsNote>{t('adminSettings.branches.onlyOne')}</SettingsNote>}

      <ul className={styles.list}>
        {branches.map((b) => {
          const here = b.id === current.id;
          return (
            <li key={b.id} className={styles.branch} data-current={here || undefined}>
              <span className={styles.monogram} aria-hidden="true">
                {b.shortName.charAt(0).toUpperCase()}
              </span>
              <div className={styles.text}>
                <div className={styles.nameRow}>
                  <h2 className={styles.name}>{b.name}</h2>
                  {here && (
                    <Tag variant="ok" icon="check">
                      {t('adminSettings.branches.current')}
                    </Tag>
                  )}
                </div>
                <p className={styles.meta}>
                  {t('adminSettings.branches.where', { area: b.shortName, city: b.city })}
                </p>
                <p className={styles.address}>{b.address}</p>
                <Tag variant={STATUS_TAG[b.status]} icon={null}>
                  {t(`adminShell.status.${b.status}`)}
                </Tag>
              </div>
              <div className={styles.actions}>
                {here ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    iconStart="pencil"
                    href={settingsHref('details')}
                  >
                    {t('adminSettings.branches.edit')}
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    iconStart="swap"
                    onClick={() => {
                      selectAdminBranch(b.id);
                      showToast(t('adminSettings.branches.switched', { branch: b.shortName }), {
                        tone: 'success',
                      });
                    }}
                  >
                    {t('adminSettings.branches.switch')}
                  </Button>
                )}
                <IconButton
                  icon="trash"
                  variant="soft"
                  size="sm"
                  className={styles.remove}
                  disabled={only}
                  label={
                    only
                      ? t('adminSettings.branches.removeOnly', { branch: b.shortName })
                      : t('adminSettings.branches.remove', { branch: b.shortName })
                  }
                  onClick={() => setRemoving(b)}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {adding && (
        <AddBranchDialog
          branches={branches}
          copyFrom={current.id}
          onClose={() => setAdding(false)}
          onAdded={(created) => {
            setAdding(false);
            showToast(t('adminSettings.branches.added', { branch: created.shortName }), {
              tone: 'success',
            });
          }}
        />
      )}
      {removing && (
        <RemoveBranchDialog
          key={removing.id}
          branch={removing}
          next={branches.find((b) => b.id !== removing.id)}
          current={removing.id === current.id}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  );
}

/** "Remove Thamel?": what happens, then Keep or Remove; why the server said no, if it did. */
function RemoveBranchDialog({
  branch,
  next,
  current,
  onClose,
}: {
  branch: AdminBranch;
  /** The branch to work in if this is the current one. */
  next: AdminBranch | undefined;
  current: boolean;
  onClose: () => void;
}) {
  const t = useContent('common');
  const { showToast } = useToast();
  const remove = useRemoveBranch();
  const refused = isApiError(remove.error, 'last_branch')
    ? t('adminSettings.errors.lastBranch')
    : isApiError(remove.error, 'branch_in_use')
      ? t('adminSettings.errors.branchInUse')
      : remove.isError
        ? t('adminSettings.branches.removeFailed')
        : undefined;

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminSettings.branches.removeTitle', { branch: branch.shortName })}
      footer={
        <div className={styles.footer}>
          <Button variant="secondary" onClick={onClose}>
            {t('adminSettings.branches.keep')}
          </Button>
          <Button
            iconStart="trash"
            loading={remove.isPending}
            onClick={() =>
              remove.mutate(branch.id, {
                onSuccess: () => {
                  if (current && next) selectAdminBranch(next.id);
                  showToast(t('adminSettings.branches.removed', { branch: branch.shortName }), {
                    tone: 'success',
                  });
                  onClose();
                },
              })
            }
          >
            {t('adminSettings.branches.confirmRemove')}
          </Button>
        </div>
      }
    >
      <div className={styles.dialogBody}>
        <p>{t('adminSettings.branches.removeBody', { branch: branch.name })}</p>
        {current && next && (
          <p>{t('adminSettings.branches.removeCurrent', { next: next.shortName })}</p>
        )}
        {refused && (
          <p className={styles.refused} role="alert">
            {refused}
          </p>
        )}
      </div>
    </Dialog>
  );
}
