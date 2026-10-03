'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useOrders } from '@/context/OrdersContext';
import { useServiceRequest } from '@/context/ServiceRequestContext';
import { billFor, type BillSummary } from '@/lib/service';
import type { Order } from '@/types/order';
import type { BillPaymentMethod } from '@/types/service';
import { useTableOrders } from './useTableOrders';

/** A payment in progress: the orders and amount are fixed when the guest taps Pay. */
export interface BillPayment {
  orderIds: string[];
  amount: number;
  method: BillPaymentMethod;
}

/** A completed payment: the orders it covered, as now saved (paid). */
export interface PaidBill {
  orders: Order[];
  amount: number;
  method: BillPaymentMethod;
}

interface PayBill {
  table: number;
  sessionId: string | undefined;
  /** This guest's "Just my orders" bill; `payable` is what they can pay here. */
  bill: BillSummary;
  hydrated: boolean;
  /** The payment for everything payable right now. */
  startPayment: (method: BillPaymentMethod) => BillPayment;
  /**
   * Records a successful payment. Once one is recorded, later calls (a double tap) record
   * nothing and return the same result. Null if none of the orders were still unpaid (paid
   * in another tab).
   */
  completePayment: (payment: BillPayment) => PaidBill | null;
  /** True once a payment has been recorded: keep the buttons disabled. */
  settled: boolean;
}

/** Paying this guest's own outstanding orders in the app (/help/bill/pay). */
export function usePayBill(): PayBill {
  const { table, sessionId, orders, hydrated } = useTableOrders();
  const { markPaid } = useOrders();
  const { requests, cancelRequest } = useServiceRequest();
  const receiptRef = useRef<PaidBill | null>(null);
  const [settled, setSettled] = useState(false);
  const bill = useMemo(() => billFor(orders, 'mine', sessionId), [orders, sessionId]);
  const pendingScope = requests.bill?.scope;

  const startPayment = useCallback(
    (method: BillPaymentMethod): BillPayment => ({
      orderIds: bill.payable.map((o) => o.id),
      amount: bill.payableTotal,
      method,
    }),
    [bill],
  );

  const completePayment = useCallback(
    (payment: BillPayment): PaidBill | null => {
      if (receiptRef.current) return receiptRef.current;
      const paid = markPaid(payment.orderIds, payment.method);
      if (paid.length === 0) return null;
      // A "Just my orders" bill request is settled now; a whole-table one still stands for the others.
      if (pendingScope === 'mine') cancelRequest('bill');
      const receipt: PaidBill = {
        orders: paid,
        amount: paid.reduce((sum, o) => sum + o.total, 0),
        method: payment.method,
      };
      receiptRef.current = receipt;
      setSettled(true);
      return receipt;
    },
    [markPaid, pendingScope, cancelRequest],
  );

  return { table, sessionId, bill, hydrated, startPayment, completePayment, settled };
}
