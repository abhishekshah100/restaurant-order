'use client';

import { useState } from 'react';
import { isApiError } from '@/api/client';
import { useAdminStaff, useContent } from '@/api/hooks';
import {
  useRemoveStaff,
  useResetStaffPassword,
  useRestoreStaff,
  useSaveStaff,
} from '@/api/mutations';
import { Button, Chip, Tag } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { settingsHref } from '@/lib/adminSettings';
import type { AdminStaffMember, RemovedStaffMember } from '@/types/admin';
import { useAdminWorkspace } from '../../shell/AdminWorkspace';
import { SettingsNote, SettingsSkeleton } from '../shared/SettingsEditor';
import editor from '../shared/SettingsEditor.module.css';
import {
  AddStaffDialog,
  EditStaffDialog,
  ResetPasswordDialog,
  RestoreStaffDialog,
  StaffConfirmDialog,
  StaffMoreSheet,
} from './StaffDialogs';
import styles from './StaffManager.module.css';

type Open =
  | { kind: 'add' }
  | { kind: 'edit'; member: AdminStaffMember }
  | { kind: 'more'; member: AdminStaffMember }
  | { kind: 'reset'; member: AdminStaffMember }
  | { kind: 'off'; member: AdminStaffMember }
  | { kind: 'remove'; member: AdminStaffMember }
  | { kind: 'restore'; member: RemovedStaffMember }
  | null;

/** Active by default; Inactive: sign-in turned off; Removed: off the team, to add back. */
const FILTERS = ['active', 'inactive', 'removed'] as const;
type Filter = (typeof FILTERS)[number];

/** Quick picks for why (staff can write their own instead). */
const OFF_REASONS = ['leave', 'suspended', 'security', 'notNeeded'] as const;
const REMOVE_REASONS = ['left', 'contractEnded', 'mistake', 'transferred'] as const;

/**
 * Settings › Staff: everyone who works at the branch, and the restaurant's admins — their role
 * (and where it applies), how to reach them, whether they can sign in and when they last did —
 * to add, edit (name, email, mobile number, role), give a new password, turn sign-in off or on,
 * and remove from the team (softly: their history stays; Removed lists them to add back). Only
 * staff who manage staff get here; the server keeps the rules (not one's own role or status,
 * never the last admin).
 */
export function StaffManager() {
  const t = useContent('common');
  const { branch, clock } = useAdminWorkspace();
  const { showToast } = useToast();
  const query = useAdminStaff(branch.id);
  const save = useSaveStaff();
  const reset = useResetStaffPassword();
  const remove = useRemoveStaff();
  const restore = useRestoreStaff();
  const [open, setOpen] = useState<Open>(null);
  const [filter, setFilter] = useState<Filter>('active');

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
  const removed = data.removed ?? [];

  const failed = (error: unknown) =>
    showToast(
      isApiError(error, 'staff_exists')
        ? error.body?.field === 'phone'
          ? t('adminSettings.staff.errors.phoneTaken')
          : open?.kind === 'edit'
            ? t('adminSettings.staff.errors.emailTaken')
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
  type ToastKey = 'added' | 'saved' | 'reset' | 'off' | 'on' | 'removed' | 'restored' | 'signedOut';
  const done = (key: ToastKey, name: string) => {
    setOpen(null);
    showToast(t(`adminSettings.staff.toast.${key}`, { name }), { tone: 'success' });
  };
  const setActive = (member: AdminStaffMember, active: boolean, reason?: string) =>
    save.mutate(
      { branchId: branch.id, id: member.id, body: { active, ...(reason ? { reason } : {}) } },
      { onSuccess: () => done(active ? 'on' : 'off', member.name), onError: failed },
    );

  const counts: Record<Filter, number> = {
    active: data.staff.filter((m) => m.active).length,
    inactive: data.staff.filter((m) => !m.active).length,
    removed: removed.length,
  };
  const shown = data.staff.filter((m) => (filter === 'active' ? m.active : !m.active));

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

      <div
        className={styles.filters}
        role="group"
        aria-label={t('adminSettings.staff.filters.label')}
      >
        {FILTERS.map((f) => (
          <Chip key={f} pressed={filter === f} count={counts[f]} onClick={() => setFilter(f)}>
            {t(`adminSettings.staff.filters.${f}`)}
          </Chip>
        ))}
      </div>

      {filter === 'removed' ? (
        removed.length === 0 ? (
          <p className={styles.empty}>{t('adminSettings.staff.emptyFilter.removed')}</p>
        ) : (
          <ul className={styles.list}>
            {removed.map((member) => (
              <li key={member.id} className={styles.member} data-off>
                <span className={styles.avatar} aria-hidden="true">
                  {member.name.charAt(0).toUpperCase()}
                </span>
                <div className={styles.text}>
                  <div className={styles.nameRow}>
                    <h2 className={styles.name}>{member.name}</h2>
                    <Tag variant="plain" icon={null}>
                      {t('adminSettings.staff.filters.removed')}
                    </Tag>
                  </div>
                  <p className={styles.meta}>
                    {t('adminSettings.staff.wasRole', { role: member.role.name })}
                    {' · '}
                    {member.scope === 'restaurant'
                      ? t('adminSettings.staff.allBranches')
                      : t('adminSettings.staff.thisBranch')}
                  </p>
                  <p className={styles.detail}>
                    {member.phone} · {member.email}
                  </p>
                  <p className={styles.detail}>
                    {member.removedBy
                      ? t('adminSettings.staff.removedBy', {
                          date: clock.dateTime(member.removedAt),
                          name: member.removedBy,
                        })
                      : t('adminSettings.staff.removedOn', {
                          date: clock.dateTime(member.removedAt),
                        })}
                  </p>
                  {member.reason && (
                    <p className={styles.why}>
                      {t('adminSettings.staff.reason.shown', { reason: member.reason })}
                    </p>
                  )}
                </div>
                <div className={styles.actions}>
                  <Button
                    variant="secondary"
                    size="sm"
                    iconStart="refresh"
                    aria-label={t('adminSettings.staff.addBackLabel', { name: member.name })}
                    onClick={() => setOpen({ kind: 'restore', member })}
                  >
                    {t('adminSettings.staff.addBack')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : shown.length === 0 ? (
        <p className={styles.empty}>
          {t(`adminSettings.staff.emptyFilter.${filter === 'inactive' ? 'inactive' : 'active'}`)}
        </p>
      ) : (
        <ul className={styles.list}>
          {shown.map((member) => (
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
                {member.off && (
                  <p className={styles.why}>
                    {member.off.by
                      ? t('adminSettings.staff.offBy', {
                          date: clock.dateTime(member.off.at),
                          name: member.off.by,
                        })
                      : t('adminSettings.staff.offOn', { date: clock.dateTime(member.off.at) })}
                    {' · '}
                    {t('adminSettings.staff.reason.shown', { reason: member.off.reason })}
                  </p>
                )}
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
                    iconStart="dots"
                    aria-haspopup="dialog"
                    aria-label={t('adminSettings.staff.moreLabel', { name: member.name })}
                    onClick={() => setOpen({ kind: 'more', member })}
                  >
                    {t('adminSettings.staff.more')}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

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
            const signsOut =
              !open.member.you && (body.email !== undefined || body.phone !== undefined);
            save.mutate(
              { branchId: branch.id, id: open.member.id, body },
              {
                onSuccess: (saved) => done(signsOut ? 'signedOut' : 'saved', saved.name),
                onError: failed,
              },
            );
          }}
        />
      )}
      {open?.kind === 'more' && (
        <StaffMoreSheet
          member={open.member}
          onClose={() => setOpen(null)}
          onReset={() => setOpen({ kind: 'reset', member: open.member })}
          onToggle={() =>
            open.member.active
              ? setOpen({ kind: 'off', member: open.member })
              : setActive(open.member, true)
          }
          onRemove={() => setOpen({ kind: 'remove', member: open.member })}
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
      {open?.kind === 'off' && (
        <StaffConfirmDialog
          icon="xc"
          title={t('adminSettings.staff.confirmOff.title', { name: open.member.name })}
          body={t('adminSettings.staff.confirmOff.body')}
          confirm={t('adminSettings.staff.confirmOff.confirm')}
          saving={save.isPending}
          onClose={() => setOpen(null)}
          picks={OFF_REASONS.map((k) => t(`adminSettings.staff.reason.off.${k}`))}
          onConfirm={(reason) => setActive(open.member, false, reason)}
        />
      )}
      {open?.kind === 'remove' && (
        <StaffConfirmDialog
          icon="trash"
          title={t('adminSettings.staff.confirmRemove.title', { name: open.member.name })}
          body={t('adminSettings.staff.confirmRemove.body')}
          extra={
            open.member.scope === 'restaurant'
              ? t('adminSettings.staff.confirmRemove.admin', { name: open.member.name })
              : undefined
          }
          confirm={t('adminSettings.staff.confirmRemove.confirm')}
          saving={remove.isPending}
          onClose={() => setOpen(null)}
          picks={REMOVE_REASONS.map((k) => t(`adminSettings.staff.reason.remove.${k}`))}
          onConfirm={(reason) =>
            remove.mutate(
              { branchId: branch.id, id: open.member.id, reason },
              { onSuccess: () => done('removed', open.member.name), onError: failed },
            )
          }
        />
      )}
      {open?.kind === 'restore' && (
        <RestoreStaffDialog
          member={open.member}
          roles={data.roles}
          saving={restore.isPending}
          onClose={() => setOpen(null)}
          onSave={(roleId) =>
            restore.mutate(
              { branchId: branch.id, id: open.member.id, roleId },
              {
                onSuccess: (back) => {
                  done('restored', back.name);
                  setFilter('active');
                },
                onError: failed,
              },
            )
          }
        />
      )}
    </div>
  );
}
