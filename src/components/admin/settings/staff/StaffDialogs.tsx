'use client';

import { useState } from 'react';
import { useContent } from '@/api/hooks';
import type { AddStaffRequest, StaffResponse, UpdateStaffRequest } from '@/api/contracts';
import {
  Button,
  Chip,
  Dialog,
  Icon,
  type IconName,
  Input,
  PhoneInput,
  Select,
  Textarea,
} from '@/components/ui';
import { cx } from '@/lib/cx';
import { isPasswordLongEnough, temporaryPassword } from '@/lib/staffPassword';
import type { AdminStaffMember, RemovedStaffMember } from '@/types/admin';
import { useAdminWorkspace } from '../../shell/AdminWorkspace';
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

/** "+919876543210" as the national digits the mobile field takes ("9876543210"). */
export const nationalPhone = (phone: string, dialCode: string) =>
  phone.startsWith(dialCode) ? phone.slice(dialCode.length) : phone.replace(/^\+/, '');

/**
 * Someone on the staff: their name, sign-in email and mobile number (a change signs them out),
 * and their role here. Signing in on or off and removing are in the More sheet.
 */
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
  const { region } = useAdminWorkspace();
  const roleLabel = useRoleLabel();
  const startPhone = nationalPhone(member.phone, region.mobile.dialCode);
  const [name, setName] = useState(member.name);
  const [email, setEmail] = useState(member.email);
  const [phone, setPhone] = useState(startPhone);
  const [roleId, setRoleId] = useState(member.role.id);
  const [tried, setTried] = useState(false);
  const errors = {
    name: name.trim() ? undefined : t('adminSettings.staff.dialog.nameRequired'),
    email: EMAIL.test(email.trim()) ? undefined : t('adminSettings.staff.dialog.emailInvalid'),
    phone:
      phone === startPhone || phone.length === region.mobile.length
        ? undefined
        : t('adminSettings.staff.errors.phone'),
  };
  const shown = (field: keyof typeof errors) => (tried ? errors[field] : undefined);
  const newEmail = email.trim().toLowerCase() !== member.email.toLowerCase();
  const newPhone = phone !== startPhone;

  const submit = () => {
    setTried(true);
    if (Object.values(errors).some(Boolean)) return;
    onSave({
      ...(name.trim() !== member.name ? { name: name.trim() } : {}),
      ...(newEmail ? { email: email.trim() } : {}),
      ...(newPhone ? { phone } : {}),
      ...(!member.you && roleId !== member.role.id ? { roleId } : {}),
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
          error={shown('name')}
          onChange={(event) => setName(event.target.value)}
        />
        <div className={styles.row}>
          <Input
            id="staff-edit-email"
            type="email"
            label={t('adminSettings.staff.dialog.email')}
            autoComplete="off"
            value={email}
            error={shown('email')}
            onChange={(event) => setEmail(event.target.value)}
          />
          <PhoneInput
            id="staff-edit-phone"
            label={t('adminSettings.staff.dialog.phone')}
            rules={region.mobile}
            value={phone}
            error={shown('phone')}
            showCountryCode={region.mobile.showDialCode}
            onChange={setPhone}
          />
        </div>
        {(newEmail || newPhone) && (
          <p className={styles.note} role="status">
            {member.you
              ? t('adminSettings.staff.dialog.youContactNote')
              : t('adminSettings.staff.dialog.contactNote')}
          </p>
        )}
        {member.you ? (
          <p className={styles.note}>{t('adminSettings.staff.dialog.youNote')}</p>
        ) : (
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
        )}
      </div>
    </Dialog>
  );
}

/**
 * More, for someone else on the staff: a new password, sign-in off or on, remove from the team.
 * Each a row with what it does; the risky ones ask first (their own dialogs).
 */
export function StaffMoreSheet({
  member,
  onReset,
  onToggle,
  onRemove,
  onClose,
}: {
  member: AdminStaffMember;
  onReset: () => void;
  onToggle: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const t = useContent('common');
  const row = (
    icon: IconName,
    label: string,
    hint: string,
    onClick: () => void,
    danger = false,
  ) => (
    <li>
      <button
        type="button"
        className={cx(styles.sheetRow, danger && styles.danger)}
        onClick={onClick}
      >
        <Icon name={icon} size="sm" />
        <span className={styles.sheetText}>
          <span className={styles.sheetLabel}>{label}</span>
          <span className={styles.sheetHint}>{hint}</span>
        </span>
      </button>
    </li>
  );
  return (
    <Dialog open onClose={onClose} presentation="adaptive" title={member.name}>
      <ul className={styles.sheet}>
        {row(
          'lock',
          t('adminSettings.staff.resetPassword'),
          t('adminSettings.staff.sheet.resetHint'),
          onReset,
        )}
        {member.active
          ? row(
              'xc',
              t('adminSettings.staff.sheet.turnOff'),
              t('adminSettings.staff.sheet.turnOffHint'),
              onToggle,
            )
          : row(
              'check',
              t('adminSettings.staff.sheet.turnOn'),
              t('adminSettings.staff.sheet.turnOnHint'),
              onToggle,
            )}
        {row(
          'trash',
          t('adminSettings.staff.sheet.remove'),
          t('adminSettings.staff.sheet.removeHint'),
          onRemove,
          true,
        )}
      </ul>
    </Dialog>
  );
}

/** At least this many characters of why (the server's rule too). */
const REASON_MIN = 3;
const REASON_MAX = 300;

/**
 * Asks before something that signs a person out (turning sign-in off, removing), and why: a
 * quick pick fills the reason in, or staff write their own. Can't go ahead without one.
 */
export function StaffConfirmDialog({
  icon,
  title,
  body,
  extra,
  picks,
  confirm,
  saving,
  onConfirm,
  onClose,
}: {
  icon: IconName;
  title: string;
  body: string;
  extra?: string;
  /** Common reasons, one tap each. */
  picks: readonly string[];
  confirm: string;
  saving: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const t = useContent('common');
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);
  const missing = reason.trim().length < REASON_MIN;
  const submit = () => {
    setTried(true);
    if (!missing) onConfirm(reason.trim());
  };
  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={title}
      className={styles.dialog}
      footer={
        <div className={styles.confirmActions}>
          <Button variant="secondary" onClick={onClose}>
            {t('adminSettings.staff.cancel')}
          </Button>
          <Button
            className={styles.dangerButton}
            iconStart={icon}
            loading={saving}
            onClick={submit}
          >
            {confirm}
          </Button>
        </div>
      }
    >
      <div className={styles.form}>
        <p className={styles.note}>{body}</p>
        {extra && <p className={styles.note}>{extra}</p>}
        <div className={styles.reason}>
          <div
            className={styles.picks}
            role="group"
            aria-label={t('adminSettings.staff.reason.picks')}
          >
            {picks.map((pick) => (
              <Chip key={pick} pressed={reason === pick} onClick={() => setReason(pick)}>
                {pick}
              </Chip>
            ))}
          </div>
          <Textarea
            id="staff-reason"
            label={t('adminSettings.staff.reason.label')}
            placeholder={t('adminSettings.staff.reason.placeholder')}
            rows={2}
            maxLength={REASON_MAX}
            value={reason}
            error={tried && missing ? t('adminSettings.staff.reason.required') : undefined}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
      </div>
    </Dialog>
  );
}

/** Someone removed, back on the team: their old role, or another (needed when it's gone). */
export function RestoreStaffDialog({
  member,
  roles,
  saving,
  onSave,
  onClose,
}: {
  member: RemovedStaffMember;
  roles: Roles;
  saving: boolean;
  onSave: (roleId: string | undefined) => void;
  onClose: () => void;
}) {
  const t = useContent('common');
  const roleLabel = useRoleLabel();
  const oldRole = roles.some((r) => r.id === member.role.id) ? (member.role.id ?? '') : '';
  const [roleId, setRoleId] = useState(oldRole);
  const [tried, setTried] = useState(false);
  const submit = () => {
    setTried(true);
    if (!roleId) return;
    onSave(roleId === oldRole ? undefined : roleId);
  };
  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminSettings.staff.restore.title', { name: member.name })}
      className={styles.dialog}
      footer={
        <Button block iconStart="check" loading={saving} onClick={submit}>
          {t('adminSettings.staff.restore.confirm')}
        </Button>
      }
    >
      <div className={styles.form}>
        <p className={styles.note}>{t('adminSettings.staff.restore.body')}</p>
        {!oldRole && <p className={styles.note}>{t('adminSettings.staff.restore.roleGone')}</p>}
        <Select
          id="staff-restore-role"
          label={t('adminSettings.staff.dialog.role')}
          value={roleId}
          error={tried && !roleId ? t('adminSettings.staff.dialog.roleRequired') : undefined}
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
