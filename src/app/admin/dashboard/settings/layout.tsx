import type { ReactNode } from 'react';
import { SettingsFrame } from '@/components/admin/settings/SettingsFrame';

/** Every Settings page in one frame: the Settings menu beside it from 1024px. */
export default function SettingsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <SettingsFrame>{children}</SettingsFrame>;
}
