/*
 * A settings change in plain words: the branch's settings before and after a save, compared
 * field by field, each change one line — "Tax & bill › Service charge: 5% → 10%", "Opening
 * hours › Monday: 11:00–23:00 → 12:00–23:00", "Delivery zones › Sector 18: Added". Pure: the
 * words come in (`SettingsWords`).
 */

/** One change: where (section › field), and what it was and is now, in words. */
export interface SettingChange {
  label: string;
  before: string;
  after: string;
}

/** The words a change is told in (the screen's content and money). */
export interface SettingsWords {
  /** A section's name ("Opening hours"); undefined: unknown. */
  section: (key: string) => string | undefined;
  /** A field's name ("Service charge"); undefined: unknown (it's spaced out instead). */
  field: (key: string) => string | undefined;
  /** "Monday" for "mon"; undefined: not a weekday. */
  day: (key: string) => string | undefined;
  /** A payment method's name ("UPI"). */
  method: (id: string) => string;
  money: (amount: number) => string;
  minutes: (n: number) => string;
  km: (n: number) => string;
  on: string;
  off: string;
  empty: string;
  closed: string;
  added: string;
  removed: string;
  changed: string;
  oldPhoto: string;
  newPhoto: string;
}

type Plain = Record<string, unknown>;

const isPlain = (v: unknown): v is Plain =>
  Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** "guestChanges" → "Guest changes": a code spaced out, for a field this screen doesn't name. */
const spaced = (code: string) => {
  const s = code.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const MONEY = new Set(['fee', 'freeAbove', 'minOrder']);
const METHODS = new Set(['methods', 'atTable', 'recommended']);

/** A session list as hours: "11:00–15:00, 18:00–23:00", or Closed. */
const isSessions = (v: unknown): v is { opens: string; closes: string; label?: string }[] =>
  Array.isArray(v) && v.every((s) => isPlain(s) && typeof s.opens === 'string');

/** What names an item of a list (a zone, a tax, a special day, a question). */
function itemKey(item: unknown, index: number): string {
  if (!isPlain(item)) return String(index);
  const key = item.id ?? item.name ?? item.question ?? item.from;
  return typeof key === 'string' ? key : String(index);
}

function itemName(item: unknown, index: number): string {
  if (!isPlain(item)) return String(index + 1);
  if (typeof item.name === 'string' && item.name) return item.name;
  if (typeof item.label === 'string' && item.label) return item.label;
  if (typeof item.question === 'string' && item.question) return item.question;
  if (typeof item.labelKey === 'string') {
    const last = item.labelKey.split('.').pop() ?? item.labelKey;
    return last.length <= 4 ? last.toUpperCase() : spaced(last);
  }
  if (typeof item.from === 'string') {
    return typeof item.to === 'string' && item.to !== item.from
      ? `${item.from} – ${item.to}`
      : item.from;
  }
  return String(index + 1);
}

/** The settings changed between `before` and `after` (both by section), in words. */
export function settingsChanges(
  before: Plain,
  after: Plain,
  words: SettingsWords,
): SettingChange[] {
  const out: SettingChange[] = [];

  const value = (key: string, v: unknown): string => {
    if (v === undefined || v === null || v === '') return words.empty;
    if (typeof v === 'boolean') return v ? words.on : words.off;
    if (typeof v === 'number') {
      if (key.endsWith('Bp')) return `${v / 100}%`;
      if (key.endsWith('Minutes')) return words.minutes(v);
      if (key.endsWith('Km')) return words.km(v);
      if (MONEY.has(key)) return words.money(v);
      return String(v);
    }
    if (typeof v === 'string') return METHODS.has(key) ? words.method(v) : v;
    if (isSessions(v)) {
      return v.length === 0
        ? words.closed
        : v.map((s) => `${s.opens}–${s.closes}${s.label ? ` (${s.label})` : ''}`).join(', ');
    }
    if (Array.isArray(v)) {
      if (v.length === 0) return words.empty;
      return v.map((x) => (METHODS.has(key) ? words.method(String(x)) : String(x))).join(', ');
    }
    return words.changed;
  };

  const label = (path: string[]) => path.join(' › ');
  const push = (path: string[], key: string, a: unknown, b: unknown) =>
    out.push({ label: label(path), before: value(key, a), after: value(key, b) });

  const walk = (path: string[], key: string, a: unknown, b: unknown) => {
    if (same(a, b)) return;
    // The branch photo: it changed (its address says nothing to staff).
    if (key === 'image') {
      out.push({
        label: label(path),
        before: a ? words.oldPhoto : words.empty,
        after: b ? words.newPhoto : words.removed,
      });
      return;
    }
    // Opening hours: a day's sessions.
    if (isSessions(a) || isSessions(b)) {
      push(path, key, a ?? [], b ?? []);
      return;
    }
    // A list of things (zones, taxes, special days, questions): each by its id or name.
    const list = (v: unknown) => Array.isArray(v) && v.some(isPlain);
    if (list(a) || list(b)) {
      const was = (Array.isArray(a) ? a : []) as unknown[];
      const is = (Array.isArray(b) ? b : []) as unknown[];
      const keys = [...new Set([...was.map(itemKey), ...is.map(itemKey)])];
      for (const k of keys) {
        const i = was.findIndex((x, n) => itemKey(x, n) === k);
        const j = is.findIndex((x, n) => itemKey(x, n) === k);
        const name = j >= 0 ? itemName(is[j], j) : itemName(was[i], i);
        if (i < 0)
          out.push({ label: label([...path, name]), before: words.empty, after: words.added });
        else if (j < 0) {
          out.push({ label: label([...path, name]), before: name, after: words.removed });
        } else walk([...path, name], k, was[i], is[j]);
      }
      return;
    }
    if (isPlain(a) || isPlain(b)) {
      const was = isPlain(a) ? a : {};
      const is = isPlain(b) ? b : {};
      for (const k of new Set([...Object.keys(was), ...Object.keys(is)])) {
        // Ids are bookkeeping, not settings.
        if (k === 'id') continue;
        const name = words.day(k) ?? words.field(k) ?? spaced(k);
        walk([...path, name], k, was[k], is[k]);
      }
      return;
    }
    push(path, key, a, b);
  };

  for (const section of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const name = words.section(section) ?? spaced(section);
    walk([name], section, before[section], after[section]);
  }
  return out;
}
