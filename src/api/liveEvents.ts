'use client';

import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';
import { useAdminToken } from '@/hooks/useAdminSession';
import { backendUrl, isBackendEnabled } from './backend';
import type { BranchEvent } from './contracts';
import { eventsConnected, setEventsConnected, subscribeEventsConnected } from './liveState';

/*
 * The branch's events (GET /admin/branches/:branchId/events, Server-Sent Events) for the staff
 * pages: when something changes at the branch, what it touched is read again at once instead
 * of at the next poll. Read with fetch, not EventSource, so the sign-in goes in the
 * Authorization header (never in an address a log could keep). While the stream is up the
 * pages poll rarely (api/liveState); while it's down they poll as before, and it reconnects
 * after a growing pause. Nothing without the backend (the mock has no events).
 */

/** The first pause before reconnecting, doubled each time up to the last. */
const RETRY_MS = 3_000;
const RETRY_MAX_MS = 30_000;

/** Whether the branch's events are coming in (re-renders when that changes). */
export function useEventsConnected(): boolean {
  return useSyncExternalStore(subscribeEventsConnected, eventsConnected, () => false);
}

/** What an event makes stale: orders, tables and the floor; requests; the menu; everything. */
function refresh(client: QueryClient, branchId: string, kind: BranchEvent['kind']) {
  if (kind === 'orders' || kind === 'service' || kind === 'resync') {
    void client.invalidateQueries({ queryKey: ['admin', 'service'] });
  }
  if (kind === 'menu' || kind === 'resync') {
    void client.invalidateQueries({ queryKey: ['branches', branchId, 'menu'] });
  }
}

/** The events in a chunk of the stream: blocks of `event:` and `data:` lines; the rest is left. */
function parse(buffer: string): { events: BranchEvent[]; rest: string } {
  const blocks = buffer.split('\n\n');
  const rest = blocks.pop() ?? '';
  const events = blocks.flatMap((block) => {
    const data = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('');
    if (!data) return [];
    try {
      return [JSON.parse(data) as BranchEvent];
    } catch {
      return [];
    }
  });
  return { events, rest };
}

/**
 * Keeps the branch's events coming while the page is open, reading again what each touches.
 * One per page (the staff shells mount it).
 */
export function useBranchEvents(branchId: string | undefined) {
  const client = useQueryClient();
  const token = useAdminToken();

  useEffect(() => {
    if (!branchId || !token || !isBackendEnabled()) return;
    let stopped = false;
    let controller: AbortController | undefined;
    let timer: number | undefined;
    let pause = RETRY_MS;
    let everConnected = false;

    const connect = async () => {
      controller = new AbortController();
      try {
        const res = await fetch(
          backendUrl(`admin/branches/${encodeURIComponent(branchId)}/events`),
          {
            headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
            cache: 'no-store',
            signal: controller.signal,
          },
        );
        if (!res.ok || !res.body) throw new Error(`Events: ${String(res.status)}`);
        setEventsConnected(true);
        pause = RETRY_MS;
        // Back after a gap: whatever changed meanwhile is read again.
        if (everConnected) refresh(client, branchId, 'resync');
        everConnected = true;
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          const parsed = parse(buffer + value.replace(/\r/g, ''));
          buffer = parsed.rest;
          for (const event of parsed.events) refresh(client, branchId, event.kind);
        }
      } catch {
        // Closed, refused or offline: polling carries on, and it tries again.
      }
      setEventsConnected(false);
      if (stopped) return;
      timer = window.setTimeout(() => void connect(), pause);
      pause = Math.min(pause * 2, RETRY_MAX_MS);
    };

    void connect();
    return () => {
      stopped = true;
      controller?.abort();
      window.clearTimeout(timer);
      setEventsConnected(false);
    };
  }, [branchId, token, client]);
}
