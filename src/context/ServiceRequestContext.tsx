'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { useContent, useServiceRequests } from '@/api/hooks';
import { useCancelServiceRequest, useCreateServiceRequest } from '@/api/mutations';
import { WaiterRequestDialog } from '@/components/service/WaiterRequestDialog';
import { useRequestFailed } from '@/hooks/useRequestFailed';
import { useGuestSession, useTableContext } from './GuestSessionContext';
import { useToast } from './ToastContext';
import { SERVICE_PATHS, byKind, latestRequest } from '@/lib/service';
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
  /** Records a bill request (the server works out the balance) and shows its confirmation page. */
  sendBillRequest: (scope: BillScope) => void;
  /** False until the session's requests have been read. */
  hydrated: boolean;
}

const ServiceRequestContext = createContext<ServiceRequestContextValue | null>(null);

const BILL_PATH = '/help/bill/';

/**
 * Waiter and bill requests from this guest session (GET /sessions/:id/service-requests; POST
 * and DELETE /service-requests). The waiter dialog is rendered here so any screen can open it.
 */
export function ServiceRequestProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const table = useTableContext();
  const sessionId = useGuestSession()?.id;
  const { showToast } = useToast();
  const requestFailed = useRequestFailed();
  const t = useContent('service');
  const { data } = useServiceRequests(sessionId);
  const { mutateAsync: create } = useCreateServiceRequest();
  const { mutate: cancel } = useCancelServiceRequest();
  const [dialogOpen, setDialogOpen] = useState(false);
  const sending = useRef(false);
  const requests = useMemo(() => byKind(data?.requests ?? []), [data]);

  const openRequest = useCallback(
    (kind: ServiceKind) => {
      if (requests[kind]) router.push(SERVICE_PATHS[kind]);
      else if (kind === 'bill') router.push(BILL_PATH);
      else setDialogOpen(true);
    },
    [router, requests],
  );

  const cancelRequest = useCallback(
    (kind?: ServiceKind) => {
      const target = kind ? requests[kind] : latestRequest(requests);
      if (target) cancel(target);
    },
    [cancel, requests],
  );

  /** Sends one request at a time; `then` runs with whether a new one was made. */
  const send = useCallback(
    async (
      body:
        { kind: 'waiter'; reason: WaiterReason; note: string } | { kind: 'bill'; scope: BillScope },
      then: (created: boolean) => void,
    ) => {
      if (!sessionId || sending.current) return;
      sending.current = true;
      try {
        const { created } = await create({ sessionId, ...body });
        then(created);
      } catch {
        requestFailed();
      } finally {
        sending.current = false;
      }
    },
    [create, sessionId, requestFailed],
  );

  const sendWaiterRequest = useCallback(
    (reason: WaiterReason, note: string) =>
      void send({ kind: 'waiter', reason, note }, (created) => {
        if (created) showToast(t('waiterDialog.sentToast', { table }));
        setDialogOpen(false);
        router.push(SERVICE_PATHS.waiter);
      }),
    [send, showToast, t, table, router],
  );

  const sendBillRequest = useCallback(
    (scope: BillScope) => void send({ kind: 'bill', scope }, () => router.push(SERVICE_PATHS.bill)),
    [send, router],
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
      hydrated: data !== undefined,
    }),
    [openRequest, requests, cancelRequest, sendWaiterRequest, sendBillRequest, data],
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
