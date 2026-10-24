'use client';

import { isApiError } from '@/api/client';
import { useContent } from '@/api/hooks';
import { useRemoveBranch } from '@/api/mutations';
import { Button, Dialog } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { selectAdminBranch } from '@/lib/adminAuth';
import type { AdminBranch } from '@/types/admin';
import styles from './BranchesManager.module.css';

/** "Remove Thamel?": what happens, then Keep or Remove; why the server said no, if it did. */
export function RemoveBranchDialog({
  branch,
  next,
  current,
  onClose,
}: {
  branch: AdminBranch;
  /** The branch to work in if this is the current one. */
  next: AdminBranch | undefined;
  current: boolean;
  onClose: () => void;
}) {
  const t = useContent('common');
  const { showToast } = useToast();
  const remove = useRemoveBranch();
  const refused = isApiError(remove.error, 'last_branch')
    ? t('adminSettings.errors.lastBranch')
    : isApiError(remove.error, 'branch_in_use')
      ? t('adminSettings.errors.branchInUse')
      : remove.isError
        ? t('adminSettings.branches.removeFailed')
        : undefined;

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminSettings.branches.removeTitle', { branch: branch.shortName })}
      footer={
        <div className={styles.footer}>
          <Button variant="secondary" onClick={onClose}>
            {t('adminSettings.branches.keep')}
          </Button>
          <Button
            iconStart="trash"
            loading={remove.isPending}
            onClick={() =>
              remove.mutate(branch.id, {
                onSuccess: () => {
                  if (current && next) selectAdminBranch(next.id);
                  showToast(t('adminSettings.branches.removed', { branch: branch.shortName }), {
                    tone: 'success',
                  });
                  onClose();
                },
              })
            }
          >
            {t('adminSettings.branches.confirmRemove')}
          </Button>
        </div>
      }
    >
      <div className={styles.dialogBody}>
        <p>{t('adminSettings.branches.removeBody', { branch: branch.name })}</p>
        {current && next && (
          <p>{t('adminSettings.branches.removeCurrent', { next: next.shortName })}</p>
        )}
        {refused && (
          <p className={styles.refused} role="alert">
            {refused}
          </p>
        )}
      </div>
    </Dialog>
  );
}
