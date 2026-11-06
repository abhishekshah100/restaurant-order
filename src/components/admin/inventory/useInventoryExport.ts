'use client';

import { useState } from 'react';
import { api } from '@/api/endpoints';
import { useContent } from '@/api/hooks';
import { useToast } from '@/context/ToastContext';
import { useAdminToken } from '@/hooks/useAdminSession';
import { useAdminWorkspace } from '../shell/AdminWorkspace';

export type ExportKind = 'ledger' | 'usage' | 'count';

/**
 * Downloads an inventory CSV (the ledger or usage report for some days, or one count), named
 * after the branch and what it holds. `busy` while it downloads.
 */
export function useInventoryExport() {
  const t = useContent('common');
  const token = useAdminToken();
  const { branch } = useAdminWorkspace();
  const { showToast } = useToast();
  const [busy, setBusy] = useState<ExportKind | null>(null);

  const download = async (
    kind: ExportKind,
    query: { from?: string; to?: string; id?: string },
    name: string,
  ) => {
    if (!token || busy) return;
    setBusy(kind);
    try {
      const blob = await api.inventoryExport(token, branch.id, kind, query);
      const url = URL.createObjectURL(new Blob([blob], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${branch.id}-${name}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast(t('adminInventory.export.failed'), { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };
  return { download, busy };
}
