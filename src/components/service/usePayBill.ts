'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { isApiError } from '@/api/client';
import { useCreatePayment, useSimulatePayment } from '@/api/mutations';
import { useRequestFailed } from '@/hooks/useRequestFailed';
import { billFor, type BillSummary } from '@/lib/service';
import type { Order } from '@/types/order';
import type { PaymentMethodId } from '@/types/branch';
import { useTableVisit } from './useTableVisit';

/** A payment in progress: the orders and amount the server fixed when the guest tapped Pay. */
export interface BillPayment {
  id: string;
  orderIds: string[];
  amount: number;
  method: PaymentMethodId;
}

/** A completed payment: the orders it covered, now paid. */
export interface PaidBill {
  orders: Order[];
  amount: number;
  method: PaymentMethodId;
}

interface PayBill {
  table: number;
  sessionId: string | undefined;
  /** This guest's "Just my orders" bill; `payable` is what they can pay here. */
  bill: BillSummary;
  hydrated: boolean;
  /**
   * Opens a payment for everything payable right now (POST /payments); null if it couldn't
   * be opened (nothing left to pay, or no answer).
   */
  startPayment: (method: PaymentMethodId) => Promise<BillPayment | null>;
  /**
   * Prototype "success": the partner confirms the payment and the server marks the orders paid.
   * Once one is recorded, later calls (a double tap) return the same result. Null if none of
   * the orders were still unpaid (paid in another tab) or there was no answer.
   */
  completePayment: (payment: BillPayment) => Promise<PaidBill | null>;
  /** Prototype "failure": the partner reports the payment failed (in the background). */
  failPayment: (payment: BillPayment) => void;
  /** True once a payment has been recorded: keep the buttons disabled. */
  settled: boolean;
}

/** Paying this guest's own outstanding orders in the app (/help/bill/pay). */
export function usePayBill(): PayBill {
  const { table, sessionId, orders, hydrated } = useTableVisit();
  const { mutateAsync: createPayment } = useCreatePayment();
  const { mutateAsync: simulate, mutate: report } = useSimulatePayment();
  const requestFailed = useRequestFailed();
  const receiptRef = useRef<Promise<PaidBill | null> | null>(null);
  const [settled, setSettled] = useState(false);
  const bill = useMemo(() => billFor(orders, 'mine', sessionId), [orders, sessionId]);

  const startPayment = useCallback(
    async (method: PaymentMethodId): Promise<BillPayment | null> => {
      if (!sessionId) return null;
      try {
        const payment = await createPayment({
          purpose: 'bill',
          sessionId,
          method,
          orderIds: bill.payable.map((o) => o.id),
        });
        return { id: payment.id, orderIds: payment.orderIds, amount: payment.amount, method };
      } catch (error) {
        // Nothing left to pay (paid in another tab): the bill is re-read and shows that.
        if (!isApiError(error, 'nothing_to_pay')) requestFailed();
        return null;
      }
    },
    [sessionId, bill, createPayment, requestFailed],
  );

  const completePayment = useCallback(
    (payment: BillPayment): Promise<PaidBill | null> => {
      receiptRef.current ??= simulate({ id: payment.id, outcome: 'succeeded' }).then(
        ({ orders: paid }) => {
          if (paid.length === 0) return null;
          setSettled(true);
          return {
            orders: paid,
            amount: paid.reduce((sum, o) => sum + o.total, 0),
            method: payment.method,
          };
        },
        () => {
          receiptRef.current = null;
          requestFailed();
          return null;
        },
      );
      return receiptRef.current;
    },
    [simulate, requestFailed],
  );

  const failPayment = useCallback(
    (payment: BillPayment) => report({ id: payment.id, outcome: 'failed' }),
    [report],
  );

  return {
    table,
    sessionId,
    bill,
    hydrated,
    startPayment,
    completePayment,
    failPayment,
    settled,
  };
}
