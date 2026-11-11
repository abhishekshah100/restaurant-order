import { MovedTo } from '@/components/admin/team/MovedTo';
import { ADMIN_LINKS } from '@/lib/adminNav';

/** Moved: Team › Rota. */
export default function OldRotaPage() {
  return <MovedTo href={ADMIN_LINKS.rota} />;
}
