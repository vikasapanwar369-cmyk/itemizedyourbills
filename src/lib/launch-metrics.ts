/**
 * The two-week launch test, expressed as arithmetic.
 *
 * The agreed bar: at least 5 people scan two bills, and at least 2 of them come
 * back on their own within 7 days. This module turns raw rows into that verdict
 * and nothing else — no database, no React, so it can be tested directly.
 */

export const LAUNCH_TARGETS = {
  scannedTwoBills: 5,
  returnedWithin7Days: 2,
} as const;

/** A return counts only if it happens on a later day, within this many days. */
export const RETURN_WINDOW_DAYS = 7;

const DAY = 86_400_000;

export interface RawUser {
  id: string;
  email: string;
  createdAt: string;
}
export interface RawAttribution {
  user_id: string;
  source: string;
  campaign: string | null;
}
export interface RawVisit {
  user_id: string;
  visited_on: string;
}

export interface LaunchRow {
  id: string;
  email: string;
  source: string;
  joinedAt: string;
  daysSinceSignup: number;
  bills: number;
  visitDays: number;
  scannedTwoBills: boolean;
  returnedWithin7Days: boolean;
  /** Staff/test logins are counted separately so they can never fake a pass. */
  isStaff: boolean;
}

export interface LaunchScorecard {
  generatedAt: string;
  targets: { scannedTwoBills: number; returnedWithin7Days: number };
  totals: {
    signups: number;
    scannedTwoBills: number;
    returnedWithin7Days: number;
    staffAccounts: number;
  };
  passed: boolean;
  rows: LaunchRow[];
}

function dayIndex(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? -1 : Math.floor(t / DAY);
}

function countBy<T>(rows: T[], key: (row: T) => string): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const k = key(row);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

function visitsByUser(visits: RawVisit[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const v of visits) {
    const list = map.get(v.user_id) ?? [];
    if (!list.includes(v.visited_on)) list.push(v.visited_on);
    map.set(v.user_id, list);
  }
  return map;
}

export function returnedWithinWindow(
  signupCreatedAt: string,
  visitedOn: string[],
  windowDays: number = RETURN_WINDOW_DAYS,
): boolean {
  const signupDay = dayIndex(signupCreatedAt);
  if (signupDay < 0) return false;
  return visitedOn.some((v) => {
    const d = dayIndex(v) - signupDay;
    return d > 0 && d <= windowDays;
  });
}

export function buildScorecard(
  users: RawUser[],
  bills: { user_id: string }[],
  visits: RawVisit[],
  attributions: RawAttribution[],
  staffIds: string[],
  now: Date = new Date(),
): LaunchScorecard {
  const billCounts = countBy(bills, (b) => b.user_id);
  const visitDays = visitsByUser(visits);
  const attr = new Map(attributions.map((a) => [a.user_id, a]));
  const staff = new Set(staffIds);

  const rows: LaunchRow[] = users
    .filter((u) => Boolean(u.createdAt))
    .map((u) => {
      const days = visitDays.get(u.id) ?? [];
      return {
        id: u.id,
        email: u.email,
        source: attr.get(u.id)?.source ?? "direct",
        joinedAt: u.createdAt,
        daysSinceSignup: Math.max(0, Math.floor((now.getTime() - new Date(u.createdAt).getTime()) / DAY)),
        bills: billCounts.get(u.id) ?? 0,
        visitDays: days.length,
        scannedTwoBills: (billCounts.get(u.id) ?? 0) >= 2,
        returnedWithin7Days: returnedWithinWindow(u.createdAt, days),
        isStaff: staff.has(u.id),
      };
    })
    .sort((a, b) => b.joinedAt.localeCompare(a.joinedAt));

  const real = rows.filter((r) => !r.isStaff);

  const totals = {
    signups: real.length,
    scannedTwoBills: real.filter((r) => r.scannedTwoBills).length,
    returnedWithin7Days: real.filter((r) => r.returnedWithin7Days).length,
    staffAccounts: rows.length - real.length,
  };

  return {
    generatedAt: now.toISOString(),
    targets: { ...LAUNCH_TARGETS },
    totals,
    passed:
      totals.scannedTwoBills >= LAUNCH_TARGETS.scannedTwoBills &&
      totals.returnedWithin7Days >= LAUNCH_TARGETS.returnedWithin7Days,
    rows,
  };
}
