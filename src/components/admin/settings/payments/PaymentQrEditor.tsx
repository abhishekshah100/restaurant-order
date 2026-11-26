'use client';

import Image from 'next/image';
import { useRef } from 'react';
import { useContent } from '@/api/hooks';
import { useUploadBranchImage } from '@/api/mutations';
import { Button, Input } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { LIMITS, paymentQrErrors } from '@/lib/branchSettings';
import { IMAGE_ACCEPT, imageProblemOf, prepareImage } from '@/lib/imageUpload';
import { qrFor } from '@/lib/payments';
import type { AtTableMethodKey } from '@/types/branch';
import type { PaymentQr } from '@/types/branchSettings';
import { useAdminWorkspace } from '../../shell/AdminWorkspace';
import { SettingsCard, SettingsEditor, SettingsNote } from '../shared/SettingsEditor';
import styles from './PaymentQrEditor.module.css';

/**
 * Settings › Payment QR codes: for each way the branch takes payment at the table by scanning
 * (eSewa, Khalti, Fonepay; UPI in India), its QR, uploaded sharp, and a line under it (who it
 * pays). Staff show it, with the amount, while they collect. eSewa and Khalti without their own
 * show the Fonepay QR, which they scan too.
 */
export function PaymentQrEditor() {
  const t = useContent('common');
  return (
    <SettingsEditor
      section="paymentQrs"
      title={t('adminSettings.sections.paymentQrs.title')}
      subtitle={t('adminSettings.paymentQrs.subtitle')}
      check={(value, data) => paymentQrErrors(value, data.choices.payments.qr)}
    >
      {({ value, set, data }) => {
        // The ways the branch takes at the table (and any with a QR saved before one was off).
        const taken = data.settings.payments.atTable;
        const methods = data.choices.payments.qr.filter(
          (m) => taken.includes(m) || value.some((q) => q.method === m),
        );
        if (methods.length === 0) {
          return <SettingsNote tone="warn">{t('adminSettings.paymentQrs.noMethods')}</SettingsNote>;
        }
        // One method's QR replaced or removed; the rest kept, in the page's order.
        const setQr = (method: AtTableMethodKey, next: PaymentQr | null) =>
          set(
            methods.flatMap((m) => {
              const qr = m === method ? next : value.find((q) => q.method === m);
              return qr ? [qr] : [];
            }),
          );
        return (
          <>
            {methods.includes('fonepay') && (
              <SettingsNote>{t('adminSettings.paymentQrs.fonepayTip')}</SettingsNote>
            )}
            {methods.map((method) => {
              const qr = value.find((q) => q.method === method);
              const name = t(`paymentMethods.${method}`);
              return (
                <SettingsCard
                  key={method}
                  title={name}
                  hint={
                    !qr && qrFor(method, value)
                      ? t('adminSettings.paymentQrs.usesFonepay', { method: name })
                      : undefined
                  }
                >
                  <QrField
                    method={method}
                    name={name}
                    qr={qr}
                    onChange={(next) => setQr(method, next)}
                  />
                </SettingsCard>
              );
            })}
          </>
        );
      }}
    </SettingsEditor>
  );
}

/** One method's QR: upload (kept sharp), replace or remove it, and the line under it. */
function QrField({
  method,
  name,
  qr,
  onChange,
}: {
  method: AtTableMethodKey;
  /** The method's name ("eSewa"). */
  name: string;
  qr: PaymentQr | undefined;
  onChange: (next: PaymentQr | null) => void;
}) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const { showToast } = useToast();
  const upload = useUploadBranchImage();
  const input = useRef<HTMLInputElement>(null);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    try {
      const prepared = await prepareImage(file, 'qr');
      const { image } = await upload.mutateAsync({
        branchId: branch.id,
        body: { ...prepared, purpose: 'qr' },
      });
      onChange({ method, image, note: qr?.note ?? '' });
    } catch (error) {
      showToast(t(`imageUpload.${imageProblemOf(error)}`), { tone: 'error' });
    }
  };

  return (
    <div className={styles.field}>
      <div className={styles.row}>
        <span className={styles.preview}>
          {qr ? (
            <Image
              src={qr.image.src}
              alt={t('adminSettings.paymentQrs.alt', { method: name })}
              width={qr.image.width}
              height={qr.image.height}
              className={styles.previewImg}
              sizes="128px"
            />
          ) : (
            <span className={styles.none}>{t('adminSettings.paymentQrs.none')}</span>
          )}
        </span>
        <div className={styles.actions}>
          <Button
            size="sm"
            variant="secondary"
            iconStart="plus"
            loading={upload.isPending}
            onClick={() => input.current?.click()}
          >
            {qr ? t('adminSettings.paymentQrs.replace') : t('adminSettings.paymentQrs.upload')}
          </Button>
          {qr && (
            <Button size="sm" variant="ghost" iconStart="trash" onClick={() => onChange(null)}>
              {t('adminSettings.paymentQrs.remove')}
            </Button>
          )}
          <p className={styles.hint}>{t('adminSettings.paymentQrs.hint')}</p>
        </div>
      </div>
      {qr && (
        <Input
          id={`qr-note-${method}`}
          label={t('adminSettings.paymentQrs.note')}
          placeholder={t('adminSettings.paymentQrs.notePlaceholder')}
          optional
          autoComplete="off"
          maxLength={LIMITS.qrNote + 10}
          value={qr.note}
          error={
            qr.note.trim().length > LIMITS.qrNote ? t('adminSettings.errors.qrNote') : undefined
          }
          onChange={(event) => onChange({ ...qr, note: event.target.value })}
        />
      )}
      <input
        ref={input}
        type="file"
        accept={IMAGE_ACCEPT}
        hidden
        onChange={(event) => {
          void choose(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
    </div>
  );
}
