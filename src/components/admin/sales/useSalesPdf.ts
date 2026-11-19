'use client';

import { useState } from 'react';
import { useContent } from '@/api/hooks';
import { useToast } from '@/context/ToastContext';
import { layoutPages } from '@/lib/pdfPages';
import { canShareFile, downloadFile, shareFile } from '@/lib/saveFile';

/** A4 in millimetres, the margins, and the room the page number takes at the foot. */
const PAGE = { width: 210, height: 297 };
const MARGIN = 12;
const FOOTER = 8;
/** Between sections, in the sheet's CSS pixels. */
const GAP = 16;

/**
 * The sales report as a PDF in one tap: the report drawn off-screen at A4 width (`sheet`, which
 * the page renders while `drawing`), each section turned into an image and laid on A4 pages
 * (whole where it fits; only one taller than a page is cut), each page numbered. Phones get the
 * share sheet, computers a download. The drawing libraries load only when a PDF is asked for.
 */
export function useSalesPdf() {
  const t = useContent('common');
  const { showToast } = useToast();
  const [drawing, setDrawing] = useState(false);

  /**
   * Makes and hands over the PDF. `render` shows the sheet and returns it once drawn (the
   * sections are its body's children: a `data-pdf-split` row of cards stands for its cards).
   */
  const download = async (render: () => HTMLElement | null, fileName: string) => {
    if (drawing) return;
    setDrawing(true);
    try {
      const sheet = render();
      if (!sheet) throw new Error('The report could not be drawn');
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
        document.fonts?.ready,
      ]);
      // Let the charts settle (their bars grow in) before taking them.
      await new Promise((resolve) => window.setTimeout(resolve, 450));

      const blocks: HTMLElement[] = [];
      for (const child of Array.from(sheet.children) as HTMLElement[]) {
        if (child.dataset.pdfBody !== undefined) {
          for (const part of Array.from(child.children) as HTMLElement[]) {
            if (part.dataset.pdfSplit !== undefined)
              blocks.push(...(Array.from(part.children) as HTMLElement[]));
            else blocks.push(part);
          }
        } else {
          blocks.push(child);
        }
      }
      const scale = 2;
      const images = await Promise.all(
        blocks.map((block) =>
          html2canvas(block, { scale, backgroundColor: '#ffffff', useCORS: true, logging: false }),
        ),
      );

      // Sheet pixels to millimetres: the sheet's width fills the page between the margins.
      const contentWidth = PAGE.width - MARGIN * 2;
      const mmPerPx = contentWidth / sheet.offsetWidth;
      const roomPx = (PAGE.height - MARGIN * 2 - FOOTER) / mmPerPx;
      const placements = layoutPages(
        blocks.map((b) => b.offsetHeight),
        roomPx,
        GAP,
      );
      const pages = Math.max(...placements.map((p) => p.page)) + 1;

      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      let current = 0;
      for (const place of placements) {
        if (place.page > current) {
          pdf.addPage();
          current = place.page;
        }
        const image = images[place.block] as HTMLCanvasElement;
        // The slice of the section that goes here.
        const slice = document.createElement('canvas');
        slice.width = image.width;
        slice.height = Math.max(1, Math.round(place.height * scale));
        slice
          .getContext('2d')
          ?.drawImage(
            image,
            0,
            Math.round(place.from * scale),
            image.width,
            slice.height,
            0,
            0,
            image.width,
            slice.height,
          );
        const width = (blocks[place.block] as HTMLElement).offsetWidth * mmPerPx;
        pdf.addImage(
          slice.toDataURL('image/jpeg', 0.92),
          'JPEG',
          MARGIN,
          MARGIN + place.y * mmPerPx,
          width,
          place.height * mmPerPx,
        );
      }
      // Each page numbered at the foot.
      for (let page = 1; page <= pages; page++) {
        pdf.setPage(page);
        pdf.setFontSize(8);
        pdf.setTextColor(120);
        pdf.text(
          t('adminSales.pdf.page', { page, pages }),
          PAGE.width - MARGIN,
          PAGE.height - MARGIN / 2,
          { align: 'right' },
        );
      }

      const file = new File([pdf.output('blob')], fileName, { type: 'application/pdf' });
      if (canShareFile(file)) {
        try {
          await shareFile(file);
        } catch {
          downloadFile(file, file.name);
        }
      } else {
        downloadFile(file, file.name);
      }
    } catch {
      showToast(t('adminSales.pdf.failed'), { tone: 'error' });
    } finally {
      setDrawing(false);
    }
  };

  return { drawing, download };
}
