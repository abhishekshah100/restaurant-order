'use client';

import { useState } from 'react';
import { isApiError } from '@/api/client';
import { useAdminStaff, useContent } from '@/api/hooks';
import { useResetStaffPassword, useSaveStaff } from '@/api/mutations';
import { Button, Tag } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { settingsHref } from '@/lib/adminSettings';
import type { AdminStaffMember } from '@/types/admin';
import { useAdminWorkspace } from '../../shell/AdminWorkspace';
import { SettingsNote, SettingsSkeleton } from '../shared/SettingsEditor';
import editor from '../shared/SettingsEditor.module.css';
import { AddStaffDialog, EditStaffDialog, ResetPasswordDialog } from './StaffDialogs';
import styles from './StaffManager.module.css';

type Open =
  | { kind: 'add' }
  | { kind: 'edit'; member: AdminStaffMember }
  | { kind: 'reset'; member: AdminStaffMember }
  | null;

/**
 * Settings › Staff: everyone who works at the branch, and the restaurant's admins — their role
 * (and where it applies), how to reach them, whether they can sign in and when they last did —
 * to add, edit (name, role, sign-in on or off) and give a new password. Only staff who manage
 * staff get here; the server keeps the rules (not one's own role, never the last admin).
 */
export function StaffManager() {
  const t = useContent('common');
  const { branch, clock } = useAdminWorkspace();
  const { showToast } = useToast();
  const query = useAdminStaff(branch.id);
  const save = useSaveStaff();
  const reset = useResetStaffPassword();
  const [open, setOpen] = useState<Open>(null);

  if (query.isError) {
    return (
      <div className={editor.page}>
        <SettingsNote tone="warn">{t('adminSettings.staff.failed')}</SettingsNote>
        <Button variant="secondary" onClick={() => void query.refetch()}>
          {t('adminSettings.staff.retry')}
        </Button>
      </div>
    );
  }
  const data = query.data;
  if (!data) return <SettingsSkeleton label={t('adminSettings.staff.loading')} />;

  const failed = (error: unknown) =>
    showToast(
      isApiError(error, 'staff_exists')
        ? error.body?.field === 'phone'
          ? t('adminSettings.staff.errors.phoneTaken')
          : t('adminSettings.staff.errors.emailExists')
        : isApiError(error, 'own_account')
          ? t('adminSettings.staff.errors.ownAccount')
          : isApiError(error, 'last_admin')
            ? t('adminSettings.staff.errors.lastAdmin')
            : isApiError(error, 'forbidden')
              ? t('adminSettings.staff.errors.forbidden')
              : isApiError(error, 'invalid_request') && error.body?.field === 'phone'
                ? t('adminSettings.staff.errors.phone')
                : t('adminSettings.staff.errors.failed'),
      { tone: 'error' },
    );
  const done = (key: 'added' | 'saved' | 'reset', name: string) => {
    setOpen(null);
    showToast(t(`adminSettings.staff.toast.${key}`, { name }), { tone: 'success' });
  };

  return (
    <div className={editor.page}>
      <header className={editor.head}>
        <div className={styles.headRow}>
          <div className={styles.headText}>
            <h1 className={editor.title}>{t('adminSettings.sections.staff.title')}</h1>
            <p className={editor.subtitle}>
              {t('adminSettings.staff.subtitle', { branch: branch.shortName })}
            </p>
          </div>
          <div className={styles.headActions}>
            <Button variant="ghost" iconStart="shield" href={settingsHref('roles')}>
              {t('adminSettings.staff.rolesLink')}
            </Button>
            <Button iconStart="plus" onClick={() => setOpen({ kind: 'add' })}>
              {t('adminSettings.staff.add')}
            </Button>
          </div>
        </div>
      </header>

      <ul className={styles.list}>
        {data.staff.map((member) => (
          <li key={member.id} className={styles.member} data-off={!member.active || undefined}>
            <span className={styles.avatar} aria-hidden="true">
              {member.name.charAt(0).toUpperCase()}
            </span>
            <div className={styles.text}>
              <div className={styles.nameRow}>
                <h2 className={styles.name}>{member.name}</h2>
                {member.you && (
                  <Tag variant="plain" icon={null}>
                    {t('adminSettings.staff.you')}
                  </Tag>
                )}
                {!member.active && (
                  <Tag variant="err" icon={null}>
                    {t('adminSettings.staff.off')}
                  </Tag>
                )}
                {member.active && member.mustChangePassword && (
                  <Tag variant="warn" icon={null}>
                    {t('adminSettings.staff.pending')}
                  </Tag>
                )}
              </div>
              <p className={styles.meta}>
                {member.role.name}
                {' · '}
                {member.scope === 'restaurant'
                  ? t('adminSettings.staff.allBranches')
                  : t('adminSettings.staff.thisBranch')}
              </p>
              <p className={styles.detail}>
                {member.phone} · {member.email}
              </p>
              <p className={styles.detail}>
                {member.lastSignInAt
                  ? t('adminSettings.staff.lastSignIn', {
                      date: clock.dateTime(member.lastSignInAt),
                    })
                  : t('adminSettings.staff.neverSignedIn')}
              </p>
            </div>
            <div className={styles.actions}>
              <Button
                variant="secondary"
                size="sm"
                iconStart="pencil"
                aria-label={t('adminSettings.staff.editLabel', { name: member.name })}
                onClick={() => setOpen({ kind: 'edit', member })}
              >
                {t('adminSettings.staff.edit')}
              </Button>
              {!member.you && (
                <Button
                  variant="secondary"
                  size="sm"
                  iconStart="lock"
                  aria-label={t('adminSettings.staff.resetLabel', { name: member.name })}
                  onClick={() => setOpen({ kind: 'reset', member })}
                >
                  {t('adminSettings.staff.resetPassword')}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {open?.kind === 'add' && (
        <AddStaffDialog
          roles={data.roles}
          saving={save.isPending}
          onClose={() => setOpen(null)}
          onSave={(body) =>
            save.mutate(
              { branchId: branch.id, body },
              { onSuccess: (added) => done('added', added.name), onError: failed },
            )
          }
        />
      )}
      {open?.kind === 'edit' && (
        <EditStaffDialog
          member={open.member}
          roles={data.roles}
          saving={save.isPending}
          onClose={() => setOpen(null)}
          onSave={(body) => {
            if (Object.keys(body).length === 0) {
              setOpen(null);
              return;
            }
            save.mutate(
              { branchId: branch.id, id: open.member.id, body },
              { onSuccess: (saved) => done('saved', saved.name), onError: failed },
            );
          }}
        />
      )}
      {open?.kind === 'reset' && (
        <ResetPasswordDialog
          member={open.member}
          saving={reset.isPending}
          onClose={() => setOpen(null)}
          onSave={(password) =>
            reset.mutate(
              { branchId: branch.id, id: open.member.id, password },
              { onSuccess: () => done('reset', open.member.name), onError: failed },
            )
          }
        />
      )}
    </div>
  );
}
