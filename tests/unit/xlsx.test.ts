import { describe, expect, it } from 'vitest';
import { toXlsx } from '@/lib/xlsx';

/*
 * The Excel export: a zip holding the workbook's parts, the sheet with a bold frozen header,
 * text escaped, numbers as numbers.
 */

/** The zip's files by name (stored, as toXlsx writes them). */
function unzip(bytes: Uint8Array): Record<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const files: Record<string, string> = {};
  let at = 0;
  while (view.getUint32(at, true) === 0x04034b50) {
    const size = view.getUint32(at + 18, true);
    const nameLength = view.getUint16(at + 26, true);
    const decoder = new TextDecoder();
    const name = decoder.decode(bytes.subarray(at + 30, at + 30 + nameLength));
    const start = at + 30 + nameLength;
    files[name] = decoder.decode(bytes.subarray(start, start + size));
    at = start + size;
  }
  return files;
}

describe('toXlsx', () => {
  const bytes = toXlsx(
    'Reservation history',
    [
      { guest: 'Meera & Co <VIP>', party: 4 },
      { guest: 'Ravi, "Table 2"', party: 2 },
    ],
    ['Guest', 'Party'],
    (r) => [r.guest, r.party],
  );
  const files = unzip(bytes);

  it('is a workbook: its parts in a zip', () => {
    expect(Object.keys(files)).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/worksheets/sheet1.xml',
      'xl/styles.xml',
    ]);
    expect(files['xl/workbook.xml']).toContain('<sheet name="Reservation history"');
  });

  it('puts each value in its own cell: the header bold and frozen, numbers as numbers', () => {
    const sheet = files['xl/worksheets/sheet1.xml'];
    expect(sheet).toContain('state="frozen"');
    expect(sheet).toContain('<c r="A1" t="inlineStr" s="1"><is><t xml:space="preserve">Guest</t>');
    expect(sheet).toContain('<t xml:space="preserve">Meera &amp; Co &lt;VIP&gt;</t>');
    expect(sheet).toContain('<t xml:space="preserve">Ravi, &quot;Table 2&quot;</t>');
    expect(sheet).toContain('<c r="B2"><v>4</v></c>');
    expect(sheet).toContain('<autoFilter ref="A1:B3"/>');
  });
});
