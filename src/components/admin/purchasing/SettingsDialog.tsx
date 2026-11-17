'use client';

import { useState } from 'react';
import { useContent } from '@/api/hooks';
import { useSetPurchasingSettings } from '@/api/mutations';
import { Button, Dialog, Input, OptionRow } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { parseCost } from '@/lib/inventory';
import type { PurchasingSettings } from '@/types/purchasing';
import { InfoTip } from '../inventory/InfoTip';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './Purchasing.module.css';

type Approval = 'off' | 'all' | 'above';

const approvalOf = (limit: number | null | undefined): Approval =>
  limit === null || limit === undefined ? 'off' : limit === 0 ? 'all' : 'above';

/**
 * Purchasing › Settings (`purchase.approve`): whether orders need approval before they go out
 * (no, every one, or those above an amount), and how far above the expected price a delivered
 * one is flagged. Saved together.
 */
export function SettingsDialog({
  settings,
  onClose,
}: {
  settings: PurchasingSettings;
  onClose: () => void;
}) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const { showToast } = useToast();
  const save = useSetPurchasingSettings();
  const [approval, setApproval] = useState<Approval>(approvalOf(settings.approvalLimit));
  const [limit, setLimit] = useState(settings.approvalLimit ? String(settings.approvalLimit) : '');
  const [alert, setAlert] = useState(String(settings.priceAlert));

  const amount = parseCost(limit);
  const alertValue = parseCost(alert);
  const limitError = approval === 'above' && (amount === null || amount <= 0);
  const alertError = alertValue === null || alertValue > 100;

  const submit = () => {
    if (limitError || alertError) return;
    save.mutate(
      {
        branchId: branch.id,
        body: {
          approvalLimit: approval === 'off' ? null : approval === 'all' ? 0 : amount,
          priceAlert: alertValue,
        },
      },
      {
        onSuccess: () => {
          showToast(t('adminPurchasing.settings.saved'), { tone: 'success' });
          onClose();
        },
        onError: () => showToast(t('adminInventory.errors.failed'), { tone: 'error' }),
      },
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminPurchasing.settings.title')}
      description={t('adminPurchasing.settings.intro')}
      footer={
        <Button block iconStart="check" loading={save.isPending} onClick={submit}>
          {t('adminPurchasing.settings.save')}
        </Button>
      }
    >
      <div className={styles.settings}>
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>
            {t('adminPurchasing.settings.approval')}
            <InfoTip label={t('adminInventory.tips.label')}>
              {t('adminPurchasing.tips.approval')}
            </InfoTip>
          </legend>
          {(['off', 'all', 'above'] as const).map((id) => (
            <OptionRow
              key={id}
              type="radio"
              checked={approval === id}
              onChange={() => setApproval(id)}
              label={t(`adminPurchasing.settings.approvalChoices.${id}.label`)}
              sub={t(`adminPurchasing.settings.approvalChoices.${id}.hint`)}
            />
          ))}
          {approval === 'above' && (
            <Input
              id="po-limit"
              label={t('adminPurchasing.settings.limit')}
              hint={t('adminPurchasing.settings.limitHint')}
              inputMode="decimal"
              value={limit}
              error={
                limitError && limit !== '' ? t('adminPurchasing.settings.limitError') : undefined
              }
              onChange={(e) => setLimit(e.target.value)}
            />
          )}
        </fieldset>
        <Input
          id="po-alert"
          label={t('adminPurchasing.settings.alert')}
          hint={t('adminPurchasing.settings.alertHint')}
          inputMode="decimal"
          value={alert}
          error={alertError ? t('adminPurchasing.settings.alertError') : undefined}
          onChange={(e) => setAlert(e.target.value)}
        />
      </div>
    </Dialog>
  );
}
