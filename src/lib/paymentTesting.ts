/**
 * Whether the payment screens show the test buttons ("Approve payment" / "Decline payment",
 * marked "For testing"), which stand in for the guest's bank or UPI app. No payment provider is
 * connected yet, so without them an online payment never completes: they're on by default.
 *
 * Once a real provider is connected, set NEXT_PUBLIC_PAYMENT_TEST_CONTROLS=false for the live
 * site (keep it on for test deployments and the e2e build).
 */
export const PAYMENT_TEST_CONTROLS = process.env.NEXT_PUBLIC_PAYMENT_TEST_CONTROLS !== 'false';
