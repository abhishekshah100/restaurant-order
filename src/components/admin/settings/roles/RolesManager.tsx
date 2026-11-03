'use client';

import { useState } from 'react';
import { isApiError } from '@/api/client';
import { useAdminRoles, useContent } from '@/api/hooks';
import { useRemoveRole, useSaveRole } from '@/api/mutations';
import { Button, Dialog, Icon, IconButton, Tag } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import {
  PERMISSION_GROUPS,
  permissionNeeds,
  roleDraft,
  roleInput,
  type RoleDraft,
} from '@/lib/adminRoles';
import type { AdminRole } from '@/types/admin';
import { useAdminWorkspace } from '../../shell/AdminWorkspace';
import { SettingsNote, SettingsSkeleton } from '../shared/SettingsEditor';
import editor from '../shared/SettingsEditor.module.css';
import { RoleDialog } from './RoleDialog';
import styles from './RolesManager.module.css';

const TOTAL = PERMISSION_GROUPS.reduce((n, g) => n + g.permissions.length, 0);

/** What the dialog is open on: a new role (maybe a copy), one to change, or one to look at. */
type Open =
  | { kind: 'new'; from?: AdminRole }
  | { kind: 'edit'; role: AdminRole }
  | { kind: 'view'; role: AdminRole }
  | null;

/**
 * Settings › Roles & permissions: the roles staff are given — the built-in ones (read-only, to
 * look at or duplicate) and the restaurant's own (added, changed and deleted here) — with how
 * many staff hold each and what each lets them do. Only staff who manage staff get here.
 */
export function RolesManager() {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const { showToast } = useToast();
  const query = useAdminRoles(branch.id);
  const save = useSaveRole();
  const remove = useRemoveRole();
  const [open, setOpen] = useState<Open>(null);
  const [removing, setRemoving] = useState<AdminRole | null>(null);

  if (query.isError) {
    return (
      <div className={editor.page}>
        <SettingsNote tone="warn">{t('adminSettings.roles.failed')}</SettingsNote>
        <Button variant="secondary" onClick={() => void query.refetch()}>
          {t('adminSettings.roles.retry')}
        </Button>
      </div>
    );
  }
  if (!query.data) return <SettingsSkeleton label={t('adminSettings.roles.loading')} />;
  const { roles } = query.data;
  const needs = permissionNeeds(query.data.permissions);

  const failed = (error: unknown) =>
    showToast(
      isApiError(error, 'forbidden')
        ? t('adminSettings.roles.forbidden')
        : isApiError(error, 'role_in_use')
          ? t.plural('adminSettings.roles.inUse', error.body?.staff ?? 1)
          : t('adminSettings.roles.saveFailed'),
      { tone: 'error' },
    );

  const submit = (draft: RoleDraft) => {
    const id = open?.kind === 'edit' ? open.role.id : undefined;
    save.mutate(
      { branchId: branch.id, id, body: roleInput(draft) },
      {
        onSuccess: (saved) => {
          setOpen(null);
          showToast(
            t(id ? 'adminSettings.roles.saved' : 'adminSettings.roles.added', { name: saved.name }),
            { tone: 'success' },
          );
        },
        onError: failed,
      },
    );
  };
  const duplicate = (role: AdminRole) => setOpen({ kind: 'new', from: role });

  return (
    <div className={editor.page}>
      <header className={editor.head}>
        <div className={styles.headRow}>
          <div className={styles.headText}>
            <h1 className={editor.title}>{t('adminSettings.sections.roles.title')}</h1>
            <p className={editor.subtitle}>{t('adminSettings.roles.subtitle')}</p>
          </div>
          <Button iconStart="plus" onClick={() => setOpen({ kind: 'new' })}>
            {t('adminSettings.roles.add')}
          </Button>
        </div>
      </header>

      <ul className={styles.list}>
        {roles.map((role) => (
          <li key={role.id} className={styles.role} data-system={role.system || undefined}>
            <span className={styles.icon} aria-hidden="true">
              <Icon name="shield" size="md" />
            </span>
            <div className={styles.text}>
              <div className={styles.nameRow}>
                <h2 className={styles.name}>{role.name}</h2>
                {role.system && (
                  <Tag variant="plain" icon={null}>
                    {t('adminSettings.roles.builtIn')}
                  </Tag>
                )}
              </div>
              {role.description && <p className={styles.detail}>{role.description}</p>}
              <p className={styles.meta}>
                {role.staff > 0
                  ? t.plural('adminSettings.roles.staff', role.staff)
                  : t('adminSettings.roles.nobody')}
                {' · '}
                {t('adminSettings.roles.allowed', { count: role.permissions.length, total: TOTAL })}
              </p>
            </div>
            <div className={styles.actions}>
              {role.system ? (
                <Button
                  variant="secondary"
                  size="sm"
                  iconStart="eye"
                  onClick={() => setOpen({ kind: 'view', role })}
                >
                  {t('adminSettings.roles.view')}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  iconStart="pencil"
                  onClick={() => setOpen({ kind: 'edit', role })}
                >
                  {t('adminSettings.roles.edit')}
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                iconStart="copy"
                onClick={() => duplicate(role)}
              >
                {t('adminSettings.roles.duplicate')}
              </Button>
              {!role.system && (
                <IconButton
                  icon="trash"
                  variant="soft"
                  size="sm"
                  className={styles.remove}
                  label={t('adminSettings.roles.remove', { name: role.name })}
                  onClick={() => setRemoving(role)}
                />
              )}
            </div>
          </li>
        ))}
      </ul>

      {open && (
        <RoleDialog
          key={open.kind === 'new' ? `new-${open.from?.id ?? ''}` : open.role.id}
          title={
            open.kind === 'new'
              ? t('adminSettings.roles.dialog.newTitle')
              : open.kind === 'edit'
                ? t('adminSettings.roles.dialog.editTitle', { name: open.role.name })
                : t('adminSettings.roles.dialog.viewTitle', { name: open.role.name })
          }
          initial={
            open.kind === 'new'
              ? roleDraft(
                  open.from,
                  open.from
                    ? t('adminSettings.roles.duplicateName', { name: open.from.name })
                    : undefined,
                )
              : roleDraft(open.role)
          }
          needs={needs}
          readOnly={open.kind === 'view'}
          isNew={open.kind === 'new'}
          saving={save.isPending}
          onSave={submit}
          onDuplicate={open.kind === 'view' ? () => duplicate(open.role) : undefined}
          onClose={() => setOpen(null)}
        />
      )}

      {removing && (
        <Dialog
          open
          onClose={() => setRemoving(null)}
          presentation="adaptive"
          title={t('adminSettings.roles.removeTitle', { name: removing.name })}
          footer={
            <div className={styles.footer}>
              <Button variant="secondary" onClick={() => setRemoving(null)}>
                {t('adminSettings.roles.cancel')}
              </Button>
              <Button
                className={styles.danger}
                iconStart="trash"
                loading={remove.isPending}
                onClick={() =>
                  remove.mutate(
                    { branchId: branch.id, id: removing.id },
                    {
                      onSuccess: () => {
                        showToast(t('adminSettings.roles.removed', { name: removing.name }), {
                          tone: 'success',
                        });
                        setRemoving(null);
                      },
                      onError: (error) => {
                        setRemoving(null);
                        failed(error);
                      },
                    },
                  )
                }
              >
                {t('adminSettings.roles.removeConfirm')}
              </Button>
            </div>
          }
        >
          <p className={styles.note}>
            {removing.staff > 0
              ? t.plural('adminSettings.roles.inUse', removing.staff)
              : t('adminSettings.roles.removeBody')}
          </p>
        </Dialog>
      )}
    </div>
  );
}
