'use client';

import type { ClientSummary } from '@/api/contracts';
import { useContent } from '@/api/hooks';
import { usePlatformReminded } from '@/api/mutations';
import { Button } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { whatsappLink } from '@/lib/adminPlan';
import { rupees } from '@/lib/platform';

/**
 * One tap: WhatsApp opens with the renewal reminder written for the client's contact (their
 * package, when it ends, what to pay), and the console notes it was sent. Off without a phone.
 */
export function RemindButton({
  platformKey,
  by,
  client,
}: {
  platformKey: string;
  by: string;
  client: ClientSummary;
}) {
  const t = useContent('common');
  const { showToast } = useToast();
  const reminded = usePlatformReminded(platformKey);
  const ended = client.status === 'grace' || client.status === 'expired';
  const message = t(
    client.status === 'trial'
      ? 'platform.remind.trial'
      : ended
        ? 'platform.remind.ended'
        : 'platform.remind.ending',
    {
      name: client.contactName || client.name,
      restaurant: client.name,
      plan: client.plan.name,
      date: client.endsAt
        ? new Date(client.endsAt).toLocaleDateString(undefined, { dateStyle: 'medium' })
        : '',
      price: client.price === null ? t('platform.list.onRequest') : rupees(client.price),
    },
  );
  const link = whatsappLink(client.contactPhone, message);

  return (
    <Button
      variant="secondary"
      size="sm"
      iconStart="whatsapp"
      disabled={!link}
      aria-label={link ? undefined : t('platform.remind.noPhone')}
      onClick={() => {
        if (!link) return;
        window.open(link, '_blank', 'noopener');
        reminded.mutate(
          { id: client.id, by, daysLeft: client.daysLeft },
          { onSuccess: () => showToast(t('platform.remind.done', { name: client.name })) },
        );
      }}
    >
      {t('platform.remind.button')}
    </Button>
  );
}
