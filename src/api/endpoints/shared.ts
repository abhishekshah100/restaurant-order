/* What every area's requests share: path pieces, query strings and the staff token. */

export const seg = encodeURIComponent;

/** A branch's purchasing endpoints. */
export const purchasing = (branchId: string) => `admin/branches/${seg(branchId)}/purchasing`;

/** A branch's inventory endpoints. */
export const inventory = (branchId: string) => `admin/branches/${seg(branchId)}/inventory`;

/** "?from=…&to=…" from the fields that are set ("" with none). */
export function searchOf(fields: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(fields) as [string, string | number | undefined][]) {
    if (value !== undefined) search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

/** Admin requests carry the staff session's token. */
export const bearer = (token: string): RequestInit => ({
  headers: { Authorization: `Bearer ${token}` },
});
