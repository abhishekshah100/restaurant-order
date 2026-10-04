'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { isApiError } from '@/api/client';
import type { OtpChallenge, Payment } from '@/api/contracts';
import { useSendOtp, useVerifyOtp } from '@/api/mutations';
import type { PaymentMethodId } from '@/types/branch';
import type { DeliveryAddress } from '@/types/order';
import { isDeliveryAddress } from '@/lib/addresses';
import { isPaymentMethodId } from '@/lib/payments';
import { STORAGE_KEYS, readJSON, removeKey, writeJSON } from '@/lib/storage';
import { useGuestSession } from './GuestSessionContext';

/** The code last sent, as the server described it (POST /otp). */
export type OtpState = Omit<OtpChallenge, 'phone' | 'verified'>;

/** The open online payment request (POST /payments). */
export type PendingPayment = Pick<Payment, 'id' | 'method' | 'createdAt' | 'expiresAt'>;

interface CheckoutSession {
  name: string;
  phone: string;
  /** Null until a code has been sent. */
  otp: OtpState | null;
  verified: boolean;
  /** The payment method picked on the payment step; null until one is (the branch's first is shown). */
  method: PaymentMethodId | null;
  /** The payment request the processing screen is waiting on. */
  payment: PendingPayment | null;
  /** Takeaway: the pickup slot chosen (ISO); null for as soon as possible. */
  pickupAt: string | null;
  /** Delivery: where to; null until the guest has entered it. */
  address: DeliveryAddress | null;
}

const EMPTY_SESSION: CheckoutSession = {
  name: '',
  phone: '',
  otp: null,
  verified: false,
  method: null,
  payment: null,
  pickupAt: null,
  address: null,
};

/** How the order reaches the guest, as chosen on the details step. */
export type FulfilmentChoice = Pick<CheckoutSession, 'pickupAt' | 'address'>;

type Action =
  | { type: 'hydrate'; session: CheckoutSession; guestSessionId: string }
  | { type: 'details'; name: string; phone: string; otp: OtpState; verified: boolean }
  | { type: 'otp'; otp: OtpState }
  | { type: 'verified' }
  | { type: 'method'; method: PaymentMethodId }
  | { type: 'payment'; payment: PendingPayment }
  | { type: 'fulfilment'; choice: FulfilmentChoice }
  | { type: 'reset' };

interface State {
  session: CheckoutSession;
  /** The guest session this checkout belongs to; null until the saved one has been read. */
  guestSessionId: string | null;
}

function reducer(state: State, action: Action): State {
  const s = state.session;
  switch (action.type) {
    case 'hydrate':
      return { session: action.session, guestSessionId: action.guestSessionId };
    case 'details':
      return {
        ...state,
        session: {
          ...s,
          name: action.name.trim(),
          phone: action.phone,
          otp: action.otp,
          verified: action.verified,
        },
      };
    case 'otp':
      return { ...state, session: { ...s, otp: action.otp } };
    case 'verified':
      return { ...state, session: { ...s, verified: true } };
    case 'method':
      return { ...state, session: { ...s, method: action.method } };
    case 'payment':
      return {
        ...state,
        session: { ...s, method: action.payment.method, payment: action.payment },
      };
    case 'fulfilment':
      return { ...state, session: { ...s, ...action.choice } };
    case 'reset':
      return { ...state, session: EMPTY_SESSION };
    default:
      return state;
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isEpoch = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

const isOtpState = (v: unknown): v is OtpState =>
  isObject(v) &&
  isEpoch(v.sentAt) &&
  isEpoch(v.resendAt) &&
  typeof v.attemptsLeft === 'number' &&
  typeof v.maxAttempts === 'number' &&
  v.attemptsLeft >= 0 &&
  v.attemptsLeft <= v.maxAttempts;

const isPendingPayment = (v: unknown): v is PendingPayment =>
  isObject(v) &&
  typeof v.id === 'string' &&
  isPaymentMethodId(v.method) &&
  isEpoch(v.createdAt) &&
  isEpoch(v.expiresAt);

/** Saved with the guest session it belongs to. */
type SavedCheckout = CheckoutSession & { guestSessionId: string };

function isSavedCheckout(v: unknown): v is SavedCheckout {
  return (
    isObject(v) &&
    typeof v.guestSessionId === 'string' &&
    typeof v.name === 'string' &&
    typeof v.phone === 'string' &&
    typeof v.verified === 'boolean' &&
    (v.otp === null || isOtpState(v.otp)) &&
    (v.method === null || isPaymentMethodId(v.method)) &&
    (v.payment === null || isPendingPayment(v.payment)) &&
    (v.pickupAt === undefined || v.pickupAt === null || typeof v.pickupAt === 'string') &&
    (v.address === undefined || v.address === null || isDeliveryAddress(v.address))
  );
}

/** What a code check came to: on to payment, a wrong code (tries left), or no answer. */
export type VerifyResult =
  { status: 'verified' } | { status: 'wrong'; attemptsLeft: number } | { status: 'failed' };

/** What a resend came to: sent, refused (cooldown still running) or no answer. */
export type ResendResult = 'sent' | 'tooSoon' | 'failed';

interface CheckoutContextValue {
  session: CheckoutSession;
  hydrated: boolean;
  /** Saves the name and number and texts a code (POST /otp); false if it couldn't be sent. */
  submitDetails: (name: string, phone: string) => Promise<boolean>;
  /** Sends a new code; refused (and nothing changes) while the resend cooldown is running. */
  resendOtp: () => Promise<ResendResult>;
  /** Checks the code with the server (POST /otp/verify). */
  verifyCode: (code: string) => Promise<VerifyResult>;
  setMethod: (method: PaymentMethodId) => void;
  /** Records the payment request just opened (see usePayCheckout). */
  setPayment: (payment: PendingPayment) => void;
  /** Records the pickup time or delivery address chosen on the details step. */
  setFulfilment: (choice: FulfilmentChoice) => void;
  reset: () => void;
}

const CheckoutContext = createContext<CheckoutContextValue | null>(null);

/** The tab's saved checkout if it belongs to this guest session, else a fresh one. */
function readSavedCheckout(guestSessionId: string): CheckoutSession {
  const saved = readJSON(STORAGE_KEYS.checkout, isSavedCheckout, 'session');
  if (saved?.guestSessionId !== guestSessionId) return EMPTY_SESSION;
  const { guestSessionId: _owner, ...session } = saved;
  return { ...EMPTY_SESSION, ...session };
}

const otpState = ({ sentAt, resendAt, attemptsLeft, maxAttempts }: OtpChallenge): OtpState => ({
  sentAt,
  resendAt,
  attemptsLeft,
  maxAttempts,
});

/**
 * The checkout as this tab shows it (sessionStorage), so a refresh mid-checkout keeps it: the
 * guest's name and number, and the server's answers about their code and payment request.
 * The rules (codes, attempts, resend cooldown, payment window) are the server's. Tied to the
 * guest session: a new session starts a fresh checkout.
 */
export function CheckoutProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    session: EMPTY_SESSION,
    guestSessionId: null,
  });
  const sessionRef = useRef(state.session);
  const guestId = useGuestSession()?.id;
  const { mutateAsync: sendOtp } = useSendOtp();
  const { mutateAsync: checkOtp } = useVerifyOtp();
  const resending = useRef(false);

  useEffect(() => {
    if (guestId)
      dispatch({ type: 'hydrate', session: readSavedCheckout(guestId), guestSessionId: guestId });
  }, [guestId]);

  useEffect(() => {
    sessionRef.current = state.session;
    const { session, guestSessionId } = state;
    if (!guestSessionId) return;
    if (session === EMPTY_SESSION) removeKey(STORAGE_KEYS.checkout, 'session');
    else writeJSON(STORAGE_KEYS.checkout, { ...session, guestSessionId }, 'session');
  }, [state]);

  const submitDetails = useCallback(
    async (name: string, phone: string) => {
      if (!guestId) return false;
      try {
        const challenge = await sendOtp({ sessionId: guestId, phone });
        dispatch({
          type: 'details',
          name,
          phone,
          otp: otpState(challenge),
          verified: challenge.verified,
        });
        return true;
      } catch {
        return false;
      }
    },
    [guestId, sendOtp],
  );

  const resendOtp = useCallback(async (): Promise<ResendResult> => {
    const { phone } = sessionRef.current;
    // One resend at a time: a second tap before the answer is refused too.
    if (!guestId || resending.current) return 'tooSoon';
    resending.current = true;
    try {
      const challenge = await sendOtp({ sessionId: guestId, phone, resend: true });
      dispatch({ type: 'otp', otp: otpState(challenge) });
      return 'sent';
    } catch (error) {
      return isApiError(error, 'otp_resend_too_soon') ? 'tooSoon' : 'failed';
    } finally {
      resending.current = false;
    }
  }, [guestId, sendOtp]);

  const verifyCode = useCallback(
    async (code: string): Promise<VerifyResult> => {
      const { phone, otp } = sessionRef.current;
      if (!guestId || !otp) return { status: 'failed' };
      try {
        await checkOtp({ sessionId: guestId, phone, code });
        dispatch({ type: 'verified' });
        return { status: 'verified' };
      } catch (error) {
        if (!isApiError(error, 'otp_wrong_code') && !isApiError(error, 'otp_locked')) {
          return { status: 'failed' };
        }
        const attemptsLeft = error.body?.attemptsLeft ?? 0;
        const resendAt = error.body?.resendAt ?? otp.resendAt;
        dispatch({ type: 'otp', otp: { ...otp, attemptsLeft, resendAt } });
        return { status: 'wrong', attemptsLeft };
      }
    },
    [guestId, checkOtp],
  );

  const setMethod = useCallback(
    (method: PaymentMethodId) => dispatch({ type: 'method', method }),
    [],
  );
  const setPayment = useCallback(
    (payment: PendingPayment) => dispatch({ type: 'payment', payment }),
    [],
  );
  const setFulfilment = useCallback(
    (choice: FulfilmentChoice) => dispatch({ type: 'fulfilment', choice }),
    [],
  );
  const reset = useCallback(() => dispatch({ type: 'reset' }), []);

  const value = useMemo(
    () => ({
      session: state.session,
      hydrated: state.guestSessionId !== null,
      submitDetails,
      resendOtp,
      verifyCode,
      setMethod,
      setPayment,
      setFulfilment,
      reset,
    }),
    [state, submitDetails, resendOtp, verifyCode, setMethod, setPayment, setFulfilment, reset],
  );

  return <CheckoutContext.Provider value={value}>{children}</CheckoutContext.Provider>;
}

export function useCheckout(): CheckoutContextValue {
  const ctx = useContext(CheckoutContext);
  if (!ctx) throw new Error('useCheckout must be used inside <CheckoutProvider>');
  return ctx;
}
