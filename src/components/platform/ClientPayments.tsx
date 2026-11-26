'use client';

import { useState } from 'react';
import { api } from '@/api/endpoints';
import type { ClientDetail, ClientPayment, ClientPaymentMethod } from '@/api/contracts';
import { useContent, usePlatformSettings } from '@/api/hooks';
import { useRecordPlatformPayment, useRemovePlatformPayment } from '@/api/mutations';
import { SettingsCard } from '@/components/admin/settings/shared/SettingsEditor';
import { Banner, Button, Chip, Dialog, Input, Textarea } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { IMAGE_ACCEPT, imageProblemOf, prepareImage } from '@/lib/imageUpload';
import { addDays, nextTermEnd, priceOf, rupees } from '@/lib/platform';
import { ReceiptSheet, receiptNumber } from './ReceiptSheet';
import styles from './Platform.module.css';

const METHODS: ClientPaymentMethod[] = ['esewa', 'khalti', 'fonepay', 'bank', 'cash', 'other'];

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });

/**
 * What the client paid the platform: each payment (when, how much, how, the term it paid for,
 * the receipt), Record payment (extending the term by one cycle) and Remove for a mistake.
 */
export function ClientPayments({
  platformKey,
  by,
  client,
}: {
  platformKey: string;
  by: string;
  client: ClientDetail;
}) {
  const t = useContent('common');
  const { showToast } = useToast();
  const [recording, setRecording] = useState(false);
  const [removing, setRemoving] = useState<ClientPayment | null>(null);
  const [printing, setPrinting] = useState<ClientPayment | null>(null);
  const business = usePlatformSettings(platformKey).data;

  const openReceipt = async (payment: ClientPayment) => {
    // A tab opened now (not after the wait) isn't blocked as a pop-up.
    const tab = window.open('', '_blank');
    try {
      const blob = await api.platformReceipt(platformKey, client.id, payment.id);
      const url = URL.createObjectURL(blob);
      if (tab) tab.location.href = url;
      else window.open(url, '_blank');
    } catch {
      tab?.close();
      showToast(t('platform.payments.receiptFailed'), { tone: 'error' });
    }
  };

  return (
    <SettingsCard
      title={t('platform.payments.title')}
      hint={t('platform.payments.hint')}
      action={
        <Button size="sm" iconStart="plus" onClick={() => setRecording(true)}>
          {t('platform.payments.record')}
        </Button>
      }
    >
      {client.payments.length === 0 ? (
        <p className={styles.muted}>{t('platform.payments.none')}</p>
      ) : (
        <ul className={styles.payments}>
          {client.payments.map((p) => (
            <li key={p.id} className={styles.payment}>
              <div className={styles.tight}>
                <span className={styles.muted}>{receiptNumber(p.number)}</span>
                <strong>
                  {t('platform.payments.line', {
                    amount: rupees(p.amount),
                    method: t(`platform.payments.methods.${p.method}`),
                  })}
                </strong>
                <span className={styles.muted}>
                  {t('platform.payments.paidOn', { date: day(p.paidOn), by: p.by })}
                  {p.period
                    ? ` · ${t('platform.payments.period', { from: day(p.period.from), to: day(p.period.to) })}`
                    : ''}
                </span>
                {p.note && <span className={styles.muted}>{p.note}</span>}
              </div>
              <div className={styles.row}>
                <Button
                  variant="ghost"
                  size="sm"
                  iconStart="printer"
                  disabled={!business}
                  onClick={() => setPrinting(p)}
                >
                  {t('platform.payments.print')}
                </Button>
                {p.hasReceipt && (
                  <Button
                    variant="ghost"
                    size="sm"
                    iconStart="image"
                    onClick={() => void openReceipt(p)}
                  >
                    {t('platform.payments.receipt')}
                  </Button>
                )}
                <Button variant="ghost" size="sm" iconStart="trash" onClick={() => setRemoving(p)}>
                  {t('platform.payments.remove')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {printing && business && (
        <ReceiptSheet
          client={client}
          payment={printing}
          business={business}
          onDone={() => setPrinting(null)}
        />
      )}
      {recording && (
        <RecordDialog
          platformKey={platformKey}
          by={by}
          client={client}
          onClose={() => setRecording(false)}
        />
      )}
      {removing && (
        <RemoveDialog
          platformKey={platformKey}
          by={by}
          client={client}
          payment={removing}
          onClose={() => setRemoving(null)}
        />
      )}
    </SettingsCard>
  );
}

function RecordDialog({
  platformKey,
  by,
  client,
  onClose,
}: {
  platformKey: string;
  by: string;
  client: ClientDetail;
  onClose: () => void;
}) {
  const t = useContent('common');
  const { showToast } = useToast();
  const record = useRecordPlatformPayment(platformKey);
  const today = addDays('', 0, new Date());
  const [amount, setAmount] = useState(client.price === null ? '' : String(client.price));
  const [method, setMethod] = useState<ClientPaymentMethod>('esewa');
  const [paidOn, setPaidOn] = useState(today);
  const [extend, setExtend] = useState(true);
  const [note, setNote] = useState('');
  const [receipt, setReceipt] = useState<{ name: string; dataUrl: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const rupeesTyped = priceOf(amount);
  const newEnd = paidOn ? nextTermEnd(client.paidUntil, paidOn, client.billingCycle) : null;
  const valid = rupeesTyped !== null && !Number.isNaN(rupeesTyped) && paidOn !== '';

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setPreparing(true);
    setProblem(null);
    try {
      const prepared = await prepareImage(file, 'proof');
      setReceipt({ name: file.name, dataUrl: prepared.dataUrl });
    } catch (error) {
      setProblem(t(`imageUpload.${imageProblemOf(error)}`));
    } finally {
      setPreparing(false);
    }
  };

  const save = async () => {
    if (!valid || rupeesTyped === null) return;
    setProblem(null);
    try {
      await record.mutateAsync({
        id: client.id,
        body: {
          by,
          amount: rupeesTyped,
          method,
          // Noon on the day: the same date whatever the time zone reads it in.
          paidOn: new Date(`${paidOn}T12:00:00`).toISOString(),
          extend,
          note: note.trim(),
          ...(receipt ? { receipt: receipt.dataUrl } : {}),
        },
      });
      showToast(t('platform.payments.recorded', { name: client.name }));
      onClose();
    } catch {
      setProblem(t('platform.payments.failed'));
    }
  };

  return (
    <Dialog
      open
      onClose={() => !record.isPending && onClose()}
      presentation="modal"
      title={t('platform.payments.recordTitle', { name: client.name })}
      footer={
        <div className={styles.dialogActions}>
          <Button variant="secondary" disabled={record.isPending} onClick={onClose}>
            {t('platform.suspend.cancel')}
          </Button>
          <Button
            disabled={!valid || preparing}
            loading={record.isPending}
            onClick={() => void save()}
          >
            {t('platform.payments.save')}
          </Button>
        </div>
      }
    >
      <div className={styles.dialogBody}>
        <div className={styles.fields}>
          <Input
            id="payment-amount"
            inputMode="numeric"
            label={t('platform.payments.amount')}
            error={
              rupeesTyped !== null && Number.isNaN(rupeesTyped)
                ? t('platform.price.invalid')
                : undefined
            }
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <Input
            id="payment-date"
            type="date"
            label={t('platform.payments.date')}
            max={today}
            value={paidOn}
            onChange={(event) => setPaidOn(event.target.value)}
          />
        </div>
        <div className={styles.row} role="group" aria-label={t('platform.payments.method')}>
          {METHODS.map((m) => (
            <Chip key={m} pressed={method === m} onClick={() => setMethod(m)}>
              {t(`platform.payments.methods.${m}`)}
            </Chip>
          ))}
        </div>
        <label className={styles.check}>
          <input type="checkbox" checked={extend} onChange={(e) => setExtend(e.target.checked)} />
          {newEnd
            ? t('platform.payments.extend', {
                cycle: t(`platform.term.cycles.${client.billingCycle}`),
                date: day(newEnd),
              })
            : t('platform.payments.extendShort')}
        </label>
        <Input
          id="payment-note"
          label={t('platform.payments.note')}
          hint={t('platform.payments.noteHint')}
          maxLength={200}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <div className={styles.row}>
          <label className={styles.fileButton}>
            <input
              type="file"
              accept={IMAGE_ACCEPT}
              onChange={(event) => void pick(event.target.files?.[0])}
            />
            {receipt ? t('platform.payments.receiptChange') : t('platform.payments.receiptAdd')}
          </label>
          {receipt && <span className={styles.muted}>{receipt.name}</span>}
          {receipt && (
            <Button variant="ghost" size="sm" onClick={() => setReceipt(null)}>
              {t('platform.payments.receiptRemove')}
            </Button>
          )}
        </div>
        {problem && (
          <Banner tone="err" icon="alert" live="assertive">
            {problem}
          </Banner>
        )}
      </div>
    </Dialog>
  );
}

function RemoveDialog({
  platformKey,
  by,
  client,
  payment,
  onClose,
}: {
  platformKey: string;
  by: string;
  client: ClientDetail;
  payment: ClientPayment;
  onClose: () => void;
}) {
  const t = useContent('common');
  const { showToast } = useToast();
  const remove = useRemovePlatformPayment(platformKey);
  const [reason, setReason] = useState('');
  const confirm = async () => {
    try {
      await remove.mutateAsync({
        id: client.id,
        paymentId: payment.id,
        body: { by, reason: reason.trim() },
      });
      showToast(t('platform.payments.removed'));
      onClose();
    } catch {
      showToast(t('platform.payments.failed'), { tone: 'error' });
    }
  };
  return (
    <Dialog
      open
      onClose={() => !remove.isPending && onClose()}
      presentation="modal"
      title={t('platform.payments.removeTitle', { amount: rupees(payment.amount) })}
      footer={
        <div className={styles.dialogActions}>
          <Button variant="secondary" disabled={remove.isPending} onClick={onClose}>
            {t('platform.suspend.cancel')}
          </Button>
          <Button
            variant="dark"
            disabled={!reason.trim()}
            loading={remove.isPending}
            onClick={() => void confirm()}
          >
            {t('platform.payments.remove')}
          </Button>
        </div>
      }
    >
      <div className={styles.dialogBody}>
        <p>{t('platform.payments.removeBody')}</p>
        <Textarea
          id="payment-remove-reason"
          label={t('platform.payments.removeReason')}
          maxLength={200}
          rows={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>
    </Dialog>
  );
}
