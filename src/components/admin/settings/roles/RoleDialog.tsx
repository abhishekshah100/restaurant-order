'use client';

import { useState } from 'react';
import { useContent } from '@/api/hooks';
import { Button, Dialog, Input, Textarea } from '@/components/ui';
import {
  groupsFor,
  neededBy,
  permissionWord,
  withNeeds,
  type PermissionNeeds,
  type RoleDraft,
} from '@/lib/adminRoles';
import { pagesOf } from '@/lib/adminNav';
import { useAdminWorkspace } from '../../shell/AdminWorkspace';
import type { StaffPermission } from '@/types/admin';
import { ToggleRow } from '../shared/SettingsEditor';
import styles from './RolesManager.module.css';

/**
 * A role's name, what it's for and what it lets staff do (the permissions in plain groups, on or
 * off). Switching one on switches on what it needs (`needs`, from the server); those stay on,
 * locked, while anything ticked needs them. A built-in role opens read-only, with Duplicate.
 */
export function RoleDialog({
  title,
  initial,
  needs,
  readOnly = false,
  isNew,
  saving,
  onSave,
  onDuplicate,
  onClose,
}: {
  title: string;
  initial: RoleDraft;
  needs: PermissionNeeds;
  readOnly?: boolean;
  isNew: boolean;
  saving: boolean;
  onSave: (draft: RoleDraft) => void;
  onDuplicate?: () => void;
  onClose: () => void;
}) {
  const t = useContent('common');
  // The groups of modules the restaurant has (a role keeps the others' permissions).
  const { branch } = useAdminWorkspace();
  const groups = groupsFor(branch.features);
  const shown = new Set(groups.flatMap((g) => g.permissions));
  const [draft, setDraft] = useState(initial);
  const [tried, setTried] = useState(false);
  const nameMissing = draft.name.trim() === '';
  // The pages a permission opens; a role shows exactly those of its permissions.
  const opensText = (permission: StaffPermission) => {
    const pages = pagesOf(permission);
    return pages.length > 0
      ? t('adminSettings.roles.dialog.opens', {
          pages: pages.map((id) => t(`adminShell.nav.${id}`)).join(', '),
        })
      : undefined;
  };

  const toggle = (permission: StaffPermission, on: boolean) =>
    setDraft((d) => ({
      ...d,
      permissions: on
        ? withNeeds([...d.permissions, permission], needs)
        : d.permissions.filter((p) => p !== permission),
    }));

  const submit = () => {
    setTried(true);
    if (!nameMissing) onSave(draft);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={title}
      className={styles.dialog}
      footer={
        readOnly ? (
          <div className={styles.footer}>
            <Button variant="secondary" onClick={onClose}>
              {t('adminSettings.roles.dialog.close')}
            </Button>
            {onDuplicate && (
              <Button iconStart="copy" onClick={onDuplicate}>
                {t('adminSettings.roles.duplicate')}
              </Button>
            )}
          </div>
        ) : (
          <Button block iconStart="check" loading={saving} onClick={submit}>
            {isNew ? t('adminSettings.roles.dialog.create') : t('adminSettings.roles.dialog.save')}
          </Button>
        )
      }
    >
      <div className={styles.form}>
        {readOnly ? (
          <p className={styles.note}>{t('adminSettings.roles.builtInHint')}</p>
        ) : (
          <>
            <Input
              id="role-name"
              label={t('adminSettings.roles.dialog.name')}
              placeholder={t('adminSettings.roles.dialog.namePlaceholder')}
              maxLength={60}
              value={draft.name}
              error={
                tried && nameMissing ? t('adminSettings.roles.dialog.nameRequired') : undefined
              }
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
            <Textarea
              id="role-description"
              label={t('adminSettings.roles.dialog.description')}
              optional
              rows={2}
              maxLength={300}
              placeholder={t('adminSettings.roles.dialog.descriptionPlaceholder')}
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            />
          </>
        )}
        <div className={styles.permissionsHead}>
          <h3 className={styles.permissionsTitle}>{t('adminSettings.roles.dialog.permissions')}</h3>
          <span className={styles.picked}>
            {t('adminSettings.roles.dialog.picked', {
              count: draft.permissions.filter((p) => shown.has(p)).length,
              total: shown.size,
            })}
          </span>
        </div>
        {groups.map((group) => (
          <fieldset key={group.id} className={styles.group}>
            <legend className={styles.groupName}>
              {t(`adminSettings.roles.groups.${group.id}`)}
            </legend>
            {group.permissions.map((permission) => {
              const word = permissionWord(permission);
              const by = neededBy(permission, draft.permissions, needs);
              return (
                <ToggleRow
                  key={permission}
                  id={`permission-${word}`}
                  label={t(`adminSettings.roles.permissions.${word}.label`)}
                  hint={[
                    by.length > 0
                      ? t('adminSettings.roles.dialog.neededBy', {
                          names: by
                            .map((p) =>
                              t(`adminSettings.roles.permissions.${permissionWord(p)}.label`),
                            )
                            .join(', '),
                        })
                      : t(`adminSettings.roles.permissions.${word}.hint`),
                    opensText(permission),
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  checked={draft.permissions.includes(permission)}
                  disabled={readOnly || by.length > 0}
                  onChange={(on) => toggle(permission, on)}
                />
              );
            })}
          </fieldset>
        ))}
      </div>
    </Dialog>
  );
}
