'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { useContent } from '@/api/hooks';
import { WaiterRequestDialog } from '@/components/service/WaiterRequestDialog';
import { useGuestSession, useTableContext } from './GuestSessionContext';
import { useToast } from './ToastContext';
import {
  SERVICE_PATHS,
  cleanNote,
  isServiceRequests,
  latestRequest,
  liveRequests,
  type ServiceRequests,
} from '@/lib/service';
import { STORAGE_KEYS, readJSON, writeJSON } from '@/lib/storage';
import type {
  BillRequest,
  BillScope,
  ServiceKind,
  ServiceRequest,
  WaiterReason,
  WaiterRequest,
} from '@/types/service';

export type { ServiceKind, ServiceRequest } from '@/types/service';

interface ServiceRequestContextValue {
  /** Opens the waiter dialog, or the bill page; shows the pending request instead if one exists. */
  openRequest: (kind: ServiceKind) => void;
  /** The most recent pending request, if any. */
  active: ServiceRequest | null;
  /** Pending requests by kind (at most one of each). */
  requests: { waiter?: WaiterRequest; bill?: BillRequest };
  /** Cancels the request of that kind, or the most recent one. */
  cancelRequest: (kind?: ServiceKind) => void;
  /** Records a waiter request and shows its confirmation page. */
  sendWaiterRequest: (reason: WaiterReason, note: string) => void;
  /** Records a bill request and shows its confirmation page. */
  sendBillRequest: (scope: BillScope, balance: number) => void;
  /** False until saved requests have been read on the client. */
  hydrated: boolean;
}

const ServiceRequestContext = createContext<ServiceRequestContextValue | null>(null);

const BILL_PATH = '/help/bill/';

/** This guest session's pending requests; none before the session is known. */
const readSaved = (sessionId: string | undefined): ServiceRequests =>
  sessionId
    ? liveRequests(
        readJSON(STORAGE_KEYS.service, isServiceRequests, 'session') ?? {},
        sessionId,
        Date.now(),
      )
    : {};

/**
 * Waiter and bill requests from this guest session. Saved for the browser session so the
 * confirmation pages survive a reload; the waiter dialog is rendered here so any
 * screen can open it.
 */
export function ServiceRequestProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const table = useTableContext();
  const sessionId = useGuestSession()?.id;
  const { showToast } = useToast();
  const t = useContent('service');
  const [requests, setRequests] = useState<ServiceRequests>({});
  const [hydrated, setHydrated] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    // Storage is only readable after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRequests(readSaved(sessionId));
    setHydrated(true);
  }, [sessionId]);

  const save = useCallback((next: ServiceRequests) => {
    writeJSON(STORAGE_KEYS.service, next, 'session');
    setRequests(next);
  }, []);

  const openRequest = useCallback(
    (kind: ServiceKind) => {
      const pending = readSaved(sessionId)[kind];
      if (pending) router.push(SERVICE_PATHS[kind]);
      else if (kind === 'bill') router.push(BILL_PATH);
      else setDialogOpen(true);
    },
    [router, sessionId],
  );

  const cancelRequest = useCallback(
    (kind?: ServiceKind) => {
      const current = readSaved(sessionId);
      const target = kind ?? latestRequest(current)?.kind;
      if (!target) return;
      const next = { ...current };
      delete next[target];
      save(next);
    },
    [save, sessionId],
  );

  const sendWaiterRequest = useCallback(
    (reason: WaiterReason, note: string) => {
      if (!sessionId) return;
      const current = readSaved(sessionId);
      if (!current.waiter) {
        const request: WaiterRequest = {
          kind: 'waiter',
          table,
          sessionId,
          reason,
          note: cleanNote(note),
          requestedAt: new Date().toISOString(),
        };
        save({ ...current, waiter: request });
        showToast(t('waiterDialog.sentToast', { table }));
      }
      setDialogOpen(false);
      router.push(SERVICE_PATHS.waiter);
    },
    [router, save, showToast, table, sessionId, t],
  );

  const sendBillRequest = useCallback(
    (scope: BillScope, balance: number) => {
      if (!sessionId) return;
      const current = readSaved(sessionId);
      if (!current.bill) {
        const request: BillRequest = {
          kind: 'bill',
          table,
          sessionId,
          scope,
          balance,
          requestedAt: new Date().toISOString(),
        };
        save({ ...current, bill: request });
      }
      router.push(SERVICE_PATHS.bill);
    },
    [router, save, table, sessionId],
  );

  const value = useMemo<ServiceRequestContextValue>(
    () => ({
      openRequest,
      active: latestRequest(requests),
      requests: {
        waiter: requests.waiter?.kind === 'waiter' ? requests.waiter : undefined,
        bill: requests.bill?.kind === 'bill' ? requests.bill : undefined,
      },
      cancelRequest,
      sendWaiterRequest,
      sendBillRequest,
      hydrated,
    }),
    [openRequest, requests, cancelRequest, sendWaiterRequest, sendBillRequest, hydrated],
  );

  return (
    <ServiceRequestContext.Provider value={value}>
      {children}
      {dialogOpen && (
        <WaiterRequestDialog
          table={table}
          onSend={sendWaiterRequest}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </ServiceRequestContext.Provider>
  );
}

export function useServiceRequest(): ServiceRequestContextValue {
  const ctx = useContext(ServiceRequestContext);
  if (!ctx) throw new Error('useServiceRequest must be used inside <ServiceRequestProvider>');
  return ctx;
}
