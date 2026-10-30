'use client';

import { useContent } from '@/api/hooks';
import { useToast } from '@/context/ToastContext';
import { qrPng, tableLink } from '@/lib/tableQr';
import type { TableQrCode } from '@/types/admin';
import { useAdminWorkspace } from '../../shell/AdminWorkspace';

/** "Udyog Vihar" → "udyog-vihar", for the file name. */
const fileSlug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * Saves a table's QR code as a large PNG with the restaurant's name and the table above it
 * ("udyog-vihar-table-5-qr.png"), for a print shop or a stand.
 */
export function useQrDownload(origin: string) {
  const t = useContent('common');
  const { branch, brand } = useAdminWorkspace();
  const { showToast } = useToast();
  return async (code: TableQrCode) => {
    try {
      const link = document.createElement('a');
      link.href = await qrPng(tableLink(origin, code.path), {
        name: brand,
        table: t('adminQr.card.table', { table: code.table }),
      });
      const branchName = fileSlug(branch.shortName);
      link.download = `${branchName ? `${branchName}-` : ''}table-${code.table}-qr.png`;
      link.click();
    } catch {
      showToast(t('adminQr.failed'), { tone: 'error' });
    }
  };
}
