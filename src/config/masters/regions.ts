/*
 * Master values for places and time: the countries with a branch and the days of the week.
 * Words: common › countryNames and common › adminSettings.hours.days.
 */

/** Countries with a branch. Region copy in content is keyed by these. */
export const COUNTRY_CODES = ['IN', 'NP'] as const;
export type CountryCodeMaster = (typeof COUNTRY_CODES)[number];

/** Days of the week, Monday first (the order Settings › Opening hours lists them). */
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type WeekdayCode = (typeof WEEKDAYS)[number];

/** Whether a branch is taking orders. */
export const BRANCH_STATUSES = ['open', 'closed', 'paused'] as const;
export type BranchStatusCode = (typeof BRANCH_STATUSES)[number];
