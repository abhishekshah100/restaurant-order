import { describe, expect, it } from 'vitest';
import { wifiQrText } from '@/lib/wifiQr';

/* The Wi-Fi QR code's text, as phone cameras read it. */

describe('wifiQrText', () => {
  it('names the network and its password, or that it needs none', () => {
    expect(wifiQrText('OliveTable-Guest', 'pasta2026')).toBe(
      'WIFI:T:WPA;S:OliveTable-Guest;P:pasta2026;;',
    );
    expect(wifiQrText('OliveTable-Guest', '')).toBe('WIFI:T:nopass;S:OliveTable-Guest;;');
  });

  it('escapes the characters the format uses', () => {
    expect(wifiQrText('Olive;Guest', String.raw`a:b,c"d\e`)).toBe(
      String.raw`WIFI:T:WPA;S:Olive\;Guest;P:a\:b\,c\"d\\e;;`,
    );
  });
});
