'use client';

import { useContent } from '@/api/hooks';
import { Button, Dialog } from '@/components/ui';
import type { Branch } from '@/types/branch';
import styles from './SwitchOutletDialog.module.css';

export interface SwitchOutletDialogProps {
  open: boolean;
  /** The outlet the guest is switching to. */
  branch: Branch;
  /** Items in the cart that would be emptied. */
  items: number;
  onConfirm: () => void;
  onCancel: () => void;
}

/** "Switch to Thamel?" — another outlet has its own menu and prices, so the cart is emptied. */
export function SwitchOutletDialog({
  open,
  branch,
  items,
  onConfirm,
  onCancel,
}: SwitchOutletDialogProps) {
  const t = useContent('home');
  const common = useContent('common');
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      presentation="adaptive"
      title={t('start.confirmBranch.title', { branch: branch.shortName })}
      footer={
        <div className={styles.actions}>
          <Button variant="secondary" block onClick={onCancel}>
            {t('start.confirmBranch.cancel')}
          </Button>
          <Button block onClick={onConfirm}>
            {t('start.confirmBranch.confirm')}
          </Button>
        </div>
      }
    >
      <p className={styles.body}>
        {t('start.confirmBranch.body', { items: common.plural('itemCount', items) })}
      </p>
    </Dialog>
  );
}
