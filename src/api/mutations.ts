'use client';

/*
 * Every write, as a TanStack mutation over api/endpoints, one file per area in ./mutations
 * (guests, floor service, staff orders, menu, purchasing…). After a write, what it changed is read
 * again through the one list in api/refreshAfter ("after X, refresh Y"), so screens never refresh
 * caches themselves. Import from here: '@/api/mutations'.
 */

export * from './mutations/shared';
export * from './mutations/guests';
export * from './mutations/floor-service';
export * from './mutations/staff-orders';
export * from './mutations/tables';
export * from './mutations/shifts';
export * from './mutations/reservations';
export * from './mutations/menu';
export * from './mutations/cash-register';
export * from './mutations/purchasing';
export * from './mutations/inventory';
export * from './mutations/settings';
export * from './mutations/dev-setup';
export * from './mutations/platform';
