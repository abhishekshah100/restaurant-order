/*
 * The text of a Wi-Fi QR code (the format phone cameras read to join a network):
 * WIFI:T:WPA;S:<name>;P:<password>;; — or T:nopass without a password. In the name and the
 * password, \ ; , : and " are escaped with a backslash.
 */

const escape = (value: string) => value.replace(/([\\;,:"])/g, '\\$1');

export function wifiQrText(name: string, password: string): string {
  return password
    ? `WIFI:T:WPA;S:${escape(name)};P:${escape(password)};;`
    : `WIFI:T:nopass;S:${escape(name)};;`;
}
