'use client';

import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';
import { ApiError } from '@/api/client';
import { api } from '@/api/endpoints';
import { useContent } from '@/api/hooks';
import { refreshAfter } from '@/api/refreshAfter';
import { useToast } from '@/context/ToastContext';
import { useAdminToken } from '@/hooks/useAdminSession';
import {
  applyTap,
  enqueue,
  outboxTicketKey,
  parseOutbox,
  splitExpired,
  type KitchenTap,
  type OutboxEntry,
} from '@/lib/kitchenOutbox';
import { STORAGE_KEYS, readJSON, writeJSON } from '@/lib/storage';
import type { Order } from '@/types/order';

/** After no answer, try again this often (and at once when the device is back online). */
const RETRY_MS = 5_000;

/* ---------- The queue, shared by every kitchen component on this device ---------- */

const EMPTY: readonly OutboxEntry[] = [];
let entries: readonly OutboxEntry[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

const isArray = (value: unknown): value is unknown[] => Array.isArray(value);

function load() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  entries = parseOutbox(readJSON(STORAGE_KEYS.kitchenOutbox, isArray));
}

function setEntries(next: readonly OutboxEntry[]) {
  entries = next.length === 0 ? EMPTY : next;
  writeJSON(STORAGE_KEYS.kitchenOutbox, entries);
  listeners.forEach((l) => l());
}

function snapshot() {
  load();
  return entries;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let seq = 0;
/** One tap at a time is on its way; when the last try got no answer. */
let inFlight = false;
let failedAt = 0;

/** A kitchen tap: shown at once, sent as soon as it can be. */
export function queueKitchenTap(tap: KitchenTap) {
  load();
  seq += 1;
  const entry: OutboxEntry = {
    ...tap,
    id: `${Date.now().toString(36)}-${seq}`,
    at: Date.now(),
    tries: 0,
  };
  setEntries(enqueue(entries, entry));
}

/** The taps waiting to be sent (every branch), the same array until they change. */
export const useKitchenOutbox = (): readonly OutboxEntry[] =>
  useSyncExternalStore(subscribe, snapshot, () => EMPTY);

/** Tickets ("A105:2") with a tap that couldn't be sent yet (no answer came back). */
export function waitingTickets(list: readonly OutboxEntry[]): ReadonlySet<string> {
  return new Set(list.filter((e) => e.tries > 0).map(outboxTicketKey));
}

/* ---------- Sending ---------- */

function send(token: string, entry: OutboxEntry) {
  return entry.kind === 'step'
    ? api.setKitchenStatus(token, entry.branchId, entry.orderId, entry.round, {
        status: entry.step,
        ...(entry.back ? { back: true } : {}),
      })
    : api.setPlated(token, entry.branchId, entry.orderId, entry.round, entry.index, {
        plated: entry.plated,
      });
}

/** The branch's orders in the cache with a sent tap made on them, until they're read again. */
function keepInCache(client: QueryClient, entry: OutboxEntry) {
  client.setQueriesData<{ orders: Order[] }>(
    { queryKey: ['admin', 'service', 'orders', entry.branchId] },
    (data) =>
      data && Array.isArray(data.orders) ? { ...data, orders: applyTap(data.orders, entry) } : data,
  );
}

/** No answer, or the server failed: worth trying again. A 4xx is the server saying no. */
const worthRetrying = (error: unknown) =>
  !(error instanceof ApiError) || error.isNetworkError || error.status >= 500;

/**
 * Sends the kitchen's taps, oldest first, one at a time, while a member of staff is signed in.
 * No answer: kept, and tried again every few seconds and as soon as the device is back online.
 * Refused (the order was cancelled or served meanwhile): dropped, with a message, and the board
 * reads fresh. Taps over two hours old are dropped with a message. Mounted once by the shell.
 */
export function useKitchenOutboxSender() {
  const client = useQueryClient();
  const token = useAdminToken();
  const t = useContent('kitchen');
  const { showToast } = useToast();
  const list = useKitchenOutbox();

  useEffect(() => {
    if (!token || list.length === 0) return;

    // Sends the oldest tap; whatever happens changes the queue, which runs this again.
    const drain = async () => {
      if (inFlight) return;
      const { kept, expired } = splitExpired(entries, Date.now());
      if (expired.length > 0) {
        setEntries(kept);
        showToast(t.plural('outbox.expired', expired.length), { tone: 'error' });
        return;
      }
      const entry = entries[0];
      if (!entry) return;
      inFlight = true;
      try {
        await send(token, entry);
        inFlight = false;
        failedAt = 0;
        keepInCache(client, entry);
        setEntries(entries.filter((e) => e.id !== entry.id));
        if (entry.kind === 'step') void refreshAfter(client, 'kitchenStep', entry.branchId);
      } catch (error) {
        inFlight = false;
        if (worthRetrying(error)) {
          failedAt = Date.now();
          setEntries(entries.map((e) => (e.id === entry.id ? { ...e, tries: e.tries + 1 } : e)));
          return;
        }
        // Signed out meanwhile: kept for when someone signs in again.
        if (error instanceof ApiError && error.status === 401) return;
        setEntries(entries.filter((e) => e.id !== entry.id));
        showToast(t('outbox.refused', { order: entry.orderId }), { tone: 'error' });
        void refreshAfter(client, 'kitchenStep', entry.branchId);
      }
    };

    // Straight away, unless the last try got no answer a moment ago.
    const wait = failedAt === 0 ? 0 : Math.max(0, failedAt + RETRY_MS - Date.now());
    const timer = setTimeout(() => void drain(), wait);
    const online = () => {
      clearTimeout(timer);
      void drain();
    };
    window.addEventListener('online', online);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('online', online);
    };
  }, [client, list, showToast, t, token]);
}
