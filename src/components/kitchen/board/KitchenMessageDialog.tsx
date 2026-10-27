'use client';

import { useState } from 'react';
import { useContent } from '@/api/hooks';
import type { KitchenMessageRequest } from '@/api/contracts';
import { useSendKitchenMessage } from '@/api/mutations';
import { useAdminWorkspace } from '@/components/admin/shell/AdminWorkspace';
import { Dialog, Icon, Input, type IconName } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import type { KitchenTicket } from '@/lib/kitchenBoard';
import { useKitchenThemeClass } from '../shell/useKitchenTheme';
import { useTicketWhere } from '../useTicketWhere';
import styles from './KitchenMessageDialog.module.css';

const REASONS: { id: KitchenMessageRequest['reason']; icon: IconName }[] = [
  { id: 'runningLate', icon: 'clock' },
  { id: 'unavailable', icon: 'xc' },
  { id: 'question', icon: 'help' },
];

/**
 * Telling the waiters about an order: one tap on why (running late, an item isn't available, a
 * question) sends it, with a note if one was typed. It lands on their Requests page.
 */
export function KitchenMessageDialog({
  ticket,
  onClose,
}: {
  ticket: KitchenTicket;
  onClose: () => void;
}) {
  const t = useContent('kitchen');
  const { branch } = useAdminWorkspace();
  const themeClass = useKitchenThemeClass();
  const whereOf = useTicketWhere();
  const { showToast } = useToast();
  const send = useSendKitchenMessage();
  const [note, setNote] = useState('');

  const pick = (reason: KitchenMessageRequest['reason']) => {
    send.mutate(
      {
        branchId: branch.id,
        orderId: ticket.orderId,
        reason,
        ...(note.trim() ? { note: note.trim() } : {}),
      },
      {
        onSuccess: () => {
          showToast(t('message.sent', { reason: t(`message.reasons.${reason}`) }));
          onClose();
        },
        onError: () => showToast(t('message.failed'), { tone: 'error' }),
      },
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('message.title')}
      description={t('message.subtitle', { where: whereOf(ticket), order: ticket.orderId })}
      presentation="adaptive"
      className={themeClass}
    >
      <div className={styles.body}>
        <Input
          id="kitchen-message-note"
          label={t('message.note')}
          optional
          maxLength={80}
          placeholder={t('message.notePlaceholder')}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <div className={styles.reasons}>
          {REASONS.map(({ id, icon }) => (
            <button
              key={id}
              type="button"
              className={styles.reason}
              disabled={send.isPending}
              onClick={() => pick(id)}
            >
              <Icon name={icon} size="md" />
              {t(`message.reasons.${id}`)}
            </button>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
