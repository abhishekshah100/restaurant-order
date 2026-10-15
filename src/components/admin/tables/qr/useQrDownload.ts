'use client';

import { useContent } from '@/api/hooks';
import { useToast } from '@/context/ToastContext';
import { qrPng, tableLink } from '@/lib/tableQr';
import type { TableQrCode } from '@/types/admin';

/** Saves a table's QR code as a large PNG ("table-5-qr.png"), for a print shop or a stand. */
export function useQrDownload(origin: string) {
  const t = useContent('common');
  const { showToast } = useToast();
  return async (code: TableQrCode) => {
    try {
      const link = document.createElement('a');
      link.href = await qrPng(tableLink(origin, code.path));
      link.download = `table-${code.table}-qr.png`;
      link.click();
    } catch {
      showToast(t('adminQr.failed'), { tone: 'error' });
    }
  };
}
