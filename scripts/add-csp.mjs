#!/usr/bin/env node
/*
 * After `next build`: a Content-Security-Policy on every page of the static site (out/).
 *
 * The site is static files, so it can't send its own headers; each page gets the policy as a
 * <meta> tag, first thing in <head>. Scripts may only come from the site itself, plus the page's
 * own inline scripts (Next's page data), each allowed by its exact SHA-256 fingerprint, so a
 * script slipped into a page any other way doesn't run. Requests and images may only go to the
 * site and the API (NEXT_PUBLIC_BACKEND_URL / NEXT_PUBLIC_API_BASE_URL, read at build time), so
 * even injected code couldn't send the sign-in anywhere else.
 *
 * What a <meta> policy can't say (who may frame the site) is in vercel.json's headers.
 * Another host to allow (a separate image host, say): CSP_EXTRA_ORIGINS="https://a https://b".
 */
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const OUT = process.argv[2] ?? 'out';

/** The origin of an absolute URL, or nothing (a path on this site, or unset). */
function originOf(url) {
  if (!url) return [];
  try {
    const { origin } = new URL(url);
    return origin === 'null' ? [] : [origin];
  } catch {
    return [];
  }
}

const apiOrigins = [
  ...originOf(process.env.NEXT_PUBLIC_BACKEND_URL),
  ...originOf(process.env.NEXT_PUBLIC_API_BASE_URL),
  ...(process.env.CSP_EXTRA_ORIGINS ?? '').split(/\s+/).flatMap(originOf),
];
const allowed = [...new Set(apiOrigins)];
// Everything over https: ask the browser to upgrade any plain-http address too.
const allHttps = allowed.every((origin) => origin.startsWith('https:'));

/** The policy for a page whose inline scripts have these fingerprints. */
function policy(hashes) {
  return [
    "default-src 'self'",
    `script-src 'self' ${hashes.map((h) => `'sha256-${h}'`).join(' ')}`.trim(),
    // React's style={…} and a few libraries set styles inline; styles can't run code.
    "style-src 'self' 'unsafe-inline'",
    ['img-src', "'self'", 'data:', 'blob:', ...allowed].join(' '),
    "font-src 'self' data:",
    ['connect-src', "'self'", ...allowed].join(' '),
    "media-src 'self' data: blob:",
    "worker-src 'self' blob:",
    "frame-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(allHttps ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
const META_MARK = 'data-olive-csp';

async function* htmlFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(path);
    else if (entry.name.endsWith('.html')) yield path;
  }
}

let pages = 0;
let scripts = 0;
for await (const file of htmlFiles(OUT)) {
  let html = await readFile(file, 'utf8');
  // Built again over an old out/: the old tag goes first.
  html = html.replace(new RegExp(`<meta ${META_MARK}[^>]*>`, 'g'), '');
  const hashes = [
    ...new Set(
      [...html.matchAll(INLINE_SCRIPT)]
        .map((m) => m[1])
        .filter((body) => body.trim() !== '')
        .map((body) => createHash('sha256').update(body, 'utf8').digest('base64')),
    ),
  ];
  const tag = `<meta ${META_MARK} http-equiv="Content-Security-Policy" content="${policy(hashes)}"/>`;
  // Before anything else in <head> (after the charset, which must come first), so it covers
  // every script on the page.
  const charset = /<meta charSet="utf-8"\/>|<meta charset="utf-8"\/?>/i;
  if (charset.test(html)) html = html.replace(charset, (m) => `${m}${tag}`);
  else if (/<head[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, (m) => `${m}${tag}`);
  else throw new Error(`${file}: no <head> to put the policy in`);
  await writeFile(file, html);
  pages += 1;
  scripts += hashes.length;
}

if (pages === 0) throw new Error(`No pages in ${OUT}/: run next build first.`);
console.log(
  `Content-Security-Policy added to ${pages} pages (${scripts} inline scripts allowed by fingerprint; API: ${allowed.join(' ') || 'this site only'}).`,
);
