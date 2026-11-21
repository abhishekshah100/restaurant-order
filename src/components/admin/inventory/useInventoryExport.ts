'use client';

import { useState } from 'react';
import { api } from '@/api/endpoints';
import { useContent } from '@/api/hooks';
import { useToast } from '@/context/ToastContext';
import { useAdminToken } from '@/hooks/useAdminSession';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { downloadFile } from '@/lib/saveFile';

export type ExportKind = 'ledger' | 'usage' | 'count';

/**
 * Downloads an inventory CSV (the ledger or usage report for some days, or one count), named
 * after the branch and what it holds. `busy` while it downloads.
 */
export function useInventoryExport() {
  const t = useContent('common');
  const token = useAdminToken();
  const { branch, filePrefix } = useAdminWorkspace();
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
      downloadFile(new Blob([blob], { type: 'text/csv' }), `${filePrefix} - ${name}.csv`);
    } catch {
      showToast(t('adminInventory.export.failed'), { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };
  return { download, busy };
}
