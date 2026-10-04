import '@testing-library/jest-dom/vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { getQueryClient } from '@/api/queryClient';

/**
 * The static site's dummy JSON, for any request a test makes to /api/<endpoint>.json (e.g. the
 * mock server reading its seed with an empty query cache). Anything else is a 404.
 */
async function staticApi(input: RequestInfo | URL): Promise<Response> {
  const url = String(input instanceof Request ? input.url : input);
  const match = /^\/api\/(.+\.json)$/.exec(url);
  if (!match) return new Response(null, { status: 404 });
  try {
    const body = await readFile(path.join(process.cwd(), 'public', 'api', match[1]), 'utf8');
    return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch {
    return new Response(null, { status: 404 });
  }
}

beforeAll(() => {
  globalThis.fetch = staticApi as typeof fetch;
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
  // One query cache per tab: start each test without the previous one's server data.
  getQueryClient().clear();
});
