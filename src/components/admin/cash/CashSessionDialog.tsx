'use client';

import { useCashSession, useContent } from '@/api/hooks';
import { Dialog } from '@/components/ui';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { CashTotalsRows, MovementList } from './CashRegister';
import styles from './CashRegister.module.css';

/** A past session in full: who opened and closed it, its sums, what was paid in and out. */
export function CashSessionDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useContent('common');
  const { branch, clock } = useAdminWorkspace();
  const session = useCashSession(branch.id, id).data;
  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={session ? t('adminCash.session.title', { number: session.number }) : ''}
    >
      {session ? (
        <div className={styles.form}>
          <dl className={styles.facts}>
            <div>
              <dt>{t('adminCash.session.opened')}</dt>
              <dd>
                {[clock.dateTime(session.openedAt), session.openedBy].filter(Boolean).join(' · ')}
              </dd>
            </div>
            {session.closedAt && (
              <div>
                <dt>{t('adminCash.session.closed')}</dt>
                <dd>
                  {[clock.dateTime(session.closedAt), session.closedBy].filter(Boolean).join(' · ')}
                </dd>
              </div>
            )}
            {session.note && (
              <div>
                <dt>{t('adminCash.session.note')}</dt>
                <dd>{session.note}</dd>
              </div>
            )}
          </dl>
          <CashTotalsRows session={session} />
          <MovementList session={session} />
        </div>
      ) : (
        <p className={styles.muted} aria-busy="true">
          {t('adminCash.loading')}
        </p>
      )}
    </Dialog>
  );
}
