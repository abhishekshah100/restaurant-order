/** The route's `:params` if `path` matches `pattern` ("orders/:id"), else null. */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const want = pattern.split('/');
  const got = path.split('?')[0].split('/');
  if (want.length !== got.length) return null;
  const params: Record<string, string> = {};
  for (const [i, part] of want.entries()) {
    if (part.startsWith(':')) params[part.slice(1)] = decodeURIComponent(got[i]);
    else if (part !== got[i]) return null;
  }
  return params;
}
