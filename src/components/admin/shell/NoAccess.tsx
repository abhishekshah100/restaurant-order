import { useContent } from '@/api/hooks';
import { Button, EmptyState } from '@/components/ui';
import { landingFor } from '@/lib/adminNav';
import { useAdminWorkspace } from './AdminWorkspace';

/** In place of a page the staff member's role at the branch doesn't include (opened by its link). */
export function NoAccess() {
  const t = useContent('common');
  // Where they start: somewhere they may be (none: no way out but signing out).
  const landing = landingFor(useAdminWorkspace().can);
  return (
    <EmptyState
      icon="lock"
      tone="neutral"
      as="h1"
      title={t('adminShell.noAccess.title')}
      actions={
        landing && (
          <Button href={landing} variant="secondary">
            {t('adminShell.noAccess.home')}
          </Button>
        )
      }
    >
      {t('adminShell.noAccess.body')}
    </EmptyState>
  );
}
