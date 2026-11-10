// Mirrors the program and cohort option values of the applicant onboarding form
// (growth-x/app/(auth)/onboarding/_constants) and growth-x-admin's dashboard forms. Applications store
// these as free strings, so they are validated here: a typo would silently hide content from everyone.
export const PROGRAMS = [
  'zero-to-launch',
  'build-for-funding',
  'scale-your-sales',
  'price-for-profit',
  'lead-your-team',
] as const;

export const COHORTS = [
  'cohort-1',
  'cohort-2',
  'cohort-3',
  'cohort-4',
] as const;

export const DASHBOARD_ITEM_TYPES = [
  'announcement',
  'event',
  'assignment',
] as const;
export type DashboardItemType = (typeof DASHBOARD_ITEM_TYPES)[number];

export const MAX_ANNOUNCEMENTS = 5;
export const MAX_TODOS = 4;
