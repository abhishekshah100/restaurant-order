/*
 * Master values for notifications: what can be announced, to whom, and how urgently. A
 * notification service (in-app alerts, sound, push) sends these. Words: common ›
 * masters.notificationTypes.
 */

/** Who receives a notification. */
export const NOTIFICATION_AUDIENCES = ['kitchen', 'floor', 'cashier', 'guest'] as const;
export type NotificationAudience = (typeof NOTIFICATION_AUDIENCES)[number];

export const NOTIFICATION_PRIORITIES = ['low', 'normal', 'high'] as const;
export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number];

export interface NotificationTypeMaster {
  /** What it's about. */
  group: 'order' | 'kitchen' | 'payment' | 'service';
  audiences: readonly NotificationAudience[];
  priority: NotificationPriority;
}

export const NOTIFICATION_TYPES = {
  /** A new order, or a new round on a running one. */
  newOrder: { group: 'order', audiences: ['kitchen', 'floor'], priority: 'high' },
  /** An order past its due time. */
  orderDelayed: { group: 'order', audiences: ['kitchen', 'floor', 'guest'], priority: 'high' },
  /** An order the restaurant cancelled. */
  orderCancelled: { group: 'order', audiences: ['kitchen', 'floor', 'guest'], priority: 'normal' },
  /** A dish (or a whole order) is ready to serve, hand over or send out. */
  itemReady: { group: 'kitchen', audiences: ['floor', 'guest'], priority: 'high' },
  /** A dish the kitchen can't make (a rejection reason). */
  itemRejected: { group: 'kitchen', audiences: ['floor'], priority: 'high' },
  /** A payment went through. */
  paymentReceived: { group: 'payment', audiences: ['cashier', 'guest'], priority: 'normal' },
  /** A payment failed or expired. */
  paymentFailed: { group: 'payment', audiences: ['cashier', 'guest'], priority: 'normal' },
  /** Money given back. */
  refundIssued: { group: 'payment', audiences: ['cashier', 'guest'], priority: 'normal' },
  /** A guest called a waiter or asked for the bill. */
  serviceRequest: { group: 'service', audiences: ['floor'], priority: 'high' },
} as const satisfies Record<string, NotificationTypeMaster>;
export type NotificationTypeCode = keyof typeof NOTIFICATION_TYPES;
export const NOTIFICATION_TYPE_CODES = Object.keys(NOTIFICATION_TYPES) as NotificationTypeCode[];

/** The notification types one audience receives. */
export const notificationsFor = (audience: NotificationAudience): NotificationTypeCode[] =>
  NOTIFICATION_TYPE_CODES.filter((code) => {
    const audiences: readonly NotificationAudience[] = NOTIFICATION_TYPES[code].audiences;
    return audiences.includes(audience);
  });
