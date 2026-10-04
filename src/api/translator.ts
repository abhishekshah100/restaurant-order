import { Fragment, createElement, type ReactNode } from 'react';

/** Values for `{placeholders}` in a content string. */
export type Vars = Record<string, string | number>;

/** Dot paths to the string leaves of a content object: "verify.title". */
export type TextKey<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : T[K] extends readonly unknown[]
      ? never
      : T[K] extends object
        ? TextKey<T[K], `${P}${K}.`>
        : never;
}[keyof T & string];

/** Dot paths to `{ one, other }` objects: "cart.items". */
export type PluralKey<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends { one: string; other: string }
    ? `${P}${K}`
    : T[K] extends readonly unknown[]
      ? never
      : T[K] extends object
        ? PluralKey<T[K], `${P}${K}.`>
        : never;
}[keyof T & string];

/** Dot paths to any value (lists and groups too): "faqs.items". */
export type AnyKey<T, P extends string = ''> = {
  [K in keyof T & string]:
    | `${P}${K}`
    | (T[K] extends readonly unknown[]
        ? never
        : T[K] extends object
          ? AnyKey<T[K], `${P}${K}.`>
          : never);
}[keyof T & string];

/** The value at a dot path. */
export type ValueAt<T, K extends string> = K extends `${infer H}.${infer R}`
  ? H extends keyof T
    ? ValueAt<T[H], R>
    : never
  : K extends keyof T
    ? T[K]
    : never;

/** Builds a JSX element for a `<tag>…</tag>` span in a rich string. */
export type TagRenderer = (chunks: ReactNode) => ReactNode;

export interface Translator<T> {
  /** The string at `key`, with `{placeholders}` filled in. */
  (key: TextKey<T>, vars?: Vars): string;
  /** Like t(), with `<b>…</b>`-style tags turned into elements: t.rich('sent', { b: (c) => <b>{c}</b> }). */
  rich(key: TextKey<T>, tags: Record<string, TagRenderer>, vars?: Vars): ReactNode;
  /** `{ one, other }` chosen by `count`; `{count}` is available in both. */
  plural(key: PluralKey<T>, count: number, vars?: Vars): string;
  /** A raw value (list, group or string), e.g. FAQ entries to map over. */
  get<K extends AnyKey<T>>(key: K): ValueAt<T, K>;
}

function lookup(dict: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object') return (node as Record<string, unknown>)[part];
    return undefined;
  }, dict);
}

/** Fills `{placeholders}` in a string; unknown ones are left as they are. */
export const fill = (text: string, vars?: Vars) =>
  vars ? text.replace(/\{(\w+)\}/g, (match, name: string) => String(vars[name] ?? match)) : text;

function missing(key: string): string {
  if (process.env.NODE_ENV !== 'production') console.warn(`Missing content: ${key}`);
  return key;
}

/** Turns "Sent to <b>{phone}</b>" into ["Sent to ", <b>…</b>]. Tags don't nest. */
function renderRich(text: string, tags: Record<string, TagRenderer>): ReactNode {
  const parts: ReactNode[] = [];
  const pattern = /<(\w+)>(.*?)<\/\1>/g;
  let last = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const render = tags[match[1]];
    parts.push(
      createElement(Fragment, { key: parts.length }, render ? render(match[2]) : match[2]),
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/** A translator over one content namespace (the JSON from /api/content/<ns>). */
export function createTranslator<T>(dict: T): Translator<T> {
  const text = (key: string, vars?: Vars) => {
    const value = lookup(dict, key);
    return typeof value === 'string' ? fill(value, vars) : missing(key);
  };
  const t = ((key: string, vars?: Vars) => text(key, vars)) as unknown as Translator<T>;
  t.rich = (key, tags, vars) => renderRich(text(key, vars), tags);
  t.plural = (key, count, vars) => {
    const value = lookup(dict, key) as { one?: string; other?: string } | undefined;
    const form = count === 1 ? value?.one : value?.other;
    return typeof form === 'string' ? fill(form, { count, ...vars }) : missing(key);
  };
  t.get = (key) => lookup(dict, key) as never;
  return t;
}
