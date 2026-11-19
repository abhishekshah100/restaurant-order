/*
 * The API's contract: every request and response the app and the server agree on, one file per
 * area in ./contracts (errors, orders, payments, menu…). Import from here: '@/api/contracts'.
 */

export * from './contracts/errors';
export * from './contracts/admin-sessions';
export * from './contracts/branch-settings';
export * from './contracts/floor-service';
export * from './contracts/branch-status';
export * from './contracts/reservations';
export * from './contracts/menu';
export * from './contracts/history';
export * from './contracts/staff-orders';
export * from './contracts/kitchen';
export * from './contracts/staff';
export * from './contracts/sessions';
export * from './contracts/otp';
export * from './contracts/orders';
export * from './contracts/delivery';
export * from './contracts/promotions';
export * from './contracts/order-changes';
export * from './contracts/payments';
export * from './contracts/service-requests';
export * from './contracts/offers';
export * from './contracts/cash-register';
export * from './contracts/inventory';
export * from './contracts/reservation-rules';
export * from './contracts/audit-log';
export * from './contracts/invoices';
export * from './contracts/reports';
