/*
 * A branch's settings (Settings › Branch details, Opening hours, Tax & service charge, Payment
 * methods, Delivery zones, Pickup): reading them off the branch, checking a draft (the pages
 * show the first problem; the server refuses the same with 400), and writing them back onto the
 * branch. Pure, so the pages and the mock server share them.
 */

export * from './branchSettings/shared';
export * from './branchSettings/reading';
export * from './branchSettings/checking';
export * from './branchSettings/writing';
export * from './branchSettings/help-page';
