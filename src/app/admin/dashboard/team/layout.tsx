import type { ReactNode } from 'react';
import { TeamFrame } from '@/components/admin/team/TeamFrame';

/** Team: Rota, Attendance and Requests, as tabs. */
export default function TeamLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <TeamFrame>{children}</TeamFrame>;
}
