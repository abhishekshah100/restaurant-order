'use client';

import { useState } from 'react';
import { useContent } from '@/api/hooks';
import type { AddStaffRequest, StaffResponse, UpdateStaffRequest } from '@/api/contracts';
import { Button, Dialog, Input, PhoneInput, Select } from '@/components/ui';
import { isPasswordLongEnough, temporaryPassword } from '@/lib/staffPassword';
import type { AdminStaffMember } from '@/types/admin';
import { useAdminWorkspace } from '../../shell/AdminWorkspace';
import { ToggleRow } from '../shared/SettingsEditor';
import styles from './StaffManager.module.css';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Roles = StaffResponse['roles'];

/** "Manager", or "Admin · all branches" for a role over the whole restaurant. */
function useRoleLabel() {
  const t = useContent('common');
  return (role: Roles[number]) =>
    role.scope === 'restaurant'
      ? t('adminSettings.staff.dialog.roleAll', { role: role.name })
      : role.name;
}

/** A temporary password with New one and Copy. */
function PasswordField({
  id,
  value,
  error,
  onChange,
}: {
  id: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const t = useContent('common');
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className={styles.passwordField}>
      <Input
        id={id}
        label={t('adminSettings.staff.dialog.password')}
        hint={t('adminSettings.staff.dialog.passwordHint')}
        autoComplete="off"
        spellCheck={false}
        value={value}
        error={error}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className={styles.passwordActions}>
        <Button
          size="sm"
          variant="secondary"
          iconStart="refresh"
          onClick={() => onChange(temporaryPassword())}
        >
          {t('adminSettings.staff.dialog.generate')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          iconStart={copied ? 'check' : 'copy'}
          onClick={() => void copy()}
        >
          {copied ? t('adminSettings.staff.dialog.copied') : t('adminSettings.staff.dialog.copy')}
        </Button>
      </div>
    </div>
  );
}

/** Someone new: name, email, mobile, role and a temporary password (made up to start with). */
export function AddStaffDialog({
  roles,
  saving,
  onSave,
  onClose,
}: {
  roles: Roles;
  saving: boolean;
  onSave: (body: AddStaffRequest) => void;
  onClose: () => void;
}) {
  const t = useContent('common');
  const { region } = useAdminWorkspace();
  const roleLabel = useRoleLabel();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [roleId, setRoleId] = useState('');
  const [password, setPassword] = useState(() => temporaryPassword());
  const [tried, setTried] = useState(false);
  const errors = {
    name: name.trim() ? undefined : t('adminSettings.staff.dialog.nameRequired'),
    email: EMAIL.test(email.trim()) ? undefined : t('adminSettings.staff.dialog.emailInvalid'),
    phone:
      phone.length === region.mobile.length ? undefined : t('adminSettings.staff.errors.phone'),
    roleId: roleId ? undefined : t('adminSettings.staff.dialog.roleRequired'),
    password: isPasswordLongEnough(password)
      ? undefined
      : t('adminSettings.staff.dialog.passwordShort'),
  };
  const shown = (field: keyof typeof errors) => (tried ? errors[field] : undefined);

  const submit = () => {
    setTried(true);
    if (Object.values(errors).some(Boolean)) return;
    onSave({ name: name.trim(), email: email.trim(), phone, roleId, password });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminSettings.staff.dialog.addTitle')}
      className={styles.dialog}
      footer={
        <Button block iconStart="plus" loading={saving} onClick={submit}>
          {t('adminSettings.staff.dialog.add')}
        </Button>
      }
    >
      <div className={styles.form}>
        <Input
          id="staff-name"
          label={t('adminSettings.staff.dialog.name')}
          placeholder={t('adminSettings.staff.dialog.namePlaceholder')}
          maxLength={100}
          value={name}
          error={shown('name')}
          onChange={(event) => setName(event.target.value)}
        />
        <div className={styles.row}>
          <Input
            id="staff-email"
            type="email"
            label={t('adminSettings.staff.dialog.email')}
            placeholder={t('adminSettings.staff.dialog.emailPlaceholder')}
            autoComplete="off"
            value={email}
            error={shown('email')}
            onChange={(event) => setEmail(event.target.value)}
          />
          <PhoneInput
            id="staff-phone"
            label={t('adminSettings.staff.dialog.phone')}
            rules={region.mobile}
            value={phone}
            error={shown('phone')}
            showCountryCode={region.mobile.showDialCode}
            onChange={setPhone}
          />
        </div>
        <Select
          id="staff-role"
          label={t('adminSettings.staff.dialog.role')}
          value={roleId}
          error={shown('roleId')}
          onChange={(event) => setRoleId(event.target.value)}
        >
          <option value="" disabled>
            {t('adminSettings.staff.dialog.rolePlaceholder')}
          </option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {roleLabel(role)}
            </option>
          ))}
        </Select>
        <PasswordField
          id="staff-password"
          value={password}
          error={shown('password')}
          onChange={setPassword}
        />
      </div>
    </Dialog>
  );
}

/** Someone on the staff: their name, their role here, whether they can sign in. */
export function EditStaffDialog({
  member,
  roles,
  saving,
  onSave,
  onClose,
}: {
  member: AdminStaffMember;
  roles: Roles;
  saving: boolean;
  onSave: (body: UpdateStaffRequest) => void;
  onClose: () => void;
}) {
  const t = useContent('common');
  const roleLabel = useRoleLabel();
  const [name, setName] = useState(member.name);
  const [roleId, setRoleId] = useState(member.role.id);
  const [active, setActive] = useState(member.active);
  const [tried, setTried] = useState(false);
  const nameMissing = name.trim() === '';

  const submit = () => {
    setTried(true);
    if (nameMissing) return;
    onSave({
      ...(name.trim() !== member.name ? { name: name.trim() } : {}),
      ...(!member.you && roleId !== member.role.id ? { roleId } : {}),
      ...(!member.you && active !== member.active ? { active } : {}),
    });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminSettings.staff.dialog.editTitle', { name: member.name })}
      className={styles.dialog}
      footer={
        <Button block iconStart="check" loading={saving} onClick={submit}>
          {t('adminSettings.staff.dialog.save')}
        </Button>
      }
    >
      <div className={styles.form}>
        <Input
          id="staff-edit-name"
          label={t('adminSettings.staff.dialog.name')}
          maxLength={100}
          value={name}
          error={tried && nameMissing ? t('adminSettings.staff.dialog.nameRequired') : undefined}
          onChange={(event) => setName(event.target.value)}
        />
        {member.you ? (
          <p className={styles.note}>{t('adminSettings.staff.dialog.youNote')}</p>
        ) : (
          <>
            <Select
              id="staff-edit-role"
              label={t('adminSettings.staff.dialog.role')}
              value={roleId}
              onChange={(event) => setRoleId(event.target.value)}
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {roleLabel(role)}
                </option>
              ))}
            </Select>
            <ToggleRow
              id="staff-edit-active"
              label={t('adminSettings.staff.dialog.active')}
              hint={
                active
                  ? t('adminSettings.staff.dialog.activeOn')
                  : t('adminSettings.staff.dialog.activeOff')
              }
              checked={active}
              onChange={setActive}
            />
          </>
        )}
      </div>
    </Dialog>
  );
}

/** A new temporary password for someone (they're signed out; they choose their own next). */
export function ResetPasswordDialog({
  member,
  saving,
  onSave,
  onClose,
}: {
  member: AdminStaffMember;
  saving: boolean;
  onSave: (password: string) => void;
  onClose: () => void;
}) {
  const t = useContent('common');
  const [password, setPassword] = useState(() => temporaryPassword());
  const short = !isPasswordLongEnough(password);
  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminSettings.staff.reset.title', { name: member.name })}
      className={styles.dialog}
      footer={
        <Button
          block
          iconStart="lock"
          loading={saving}
          disabled={short}
          onClick={() => onSave(password)}
        >
          {t('adminSettings.staff.reset.confirm')}
        </Button>
      }
    >
      <div className={styles.form}>
        <p className={styles.note}>{t('adminSettings.staff.reset.body')}</p>
        <PasswordField
          id="staff-reset-password"
          value={password}
          error={short ? t('adminSettings.staff.dialog.passwordShort') : undefined}
          onChange={setPassword}
        />
      </div>
    </Dialog>
  );
}
