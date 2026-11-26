'use client';

import { useContent } from '@/api/hooks';
import { Button } from '@/components/ui';
import { whatsappLink } from '@/lib/adminPlan';
import { useAdminWorkspace } from './AdminWorkspace';

/**
 * Buttons to reach the platform (Restova) about the package: WhatsApp with the message written,
 * and a call; none where the platform hasn't set its contact.
 */
export function PlanContact({ message, size = 'md' }: { message: string; size?: 'sm' | 'md' }) {
  const t = useContent('common');
  const support = useAdminWorkspace().branch.plan?.support;
  const whatsapp = support ? whatsappLink(support.whatsapp || support.phone, message) : undefined;
  const phone = support?.phone.replace(/[^\d+]/g, '');
  if (!whatsapp && !phone) return null;
  return (
    <>
      {whatsapp && (
        <Button
          size={size}
          iconStart="whatsapp"
          onClick={() => window.open(whatsapp, '_blank', 'noopener')}
        >
          {t('adminShell.plan.whatsapp')}
        </Button>
      )}
      {phone && (
        <Button
          size={size}
          variant="secondary"
          iconStart="phone"
          onClick={() => window.location.assign(`tel:${phone}`)}
        >
          {t('adminShell.plan.call')}
        </Button>
      )}
    </>
  );
}
