/**
 * Grievance redressal clock (DPDP Act, 2023, Sec. 13).
 *
 * The database stores only facts: when a request arrived (`created_at`), when we
 * acknowledged it (`acknowledged_at`) and when it closed (`resolved_at`). The
 * deadlines below are derived from those facts here, in one place, so the promise
 * the app makes and the promise the console measures are the same number.
 */

/** Acknowledge within 48 hours of the request arriving. */
export const ACK_DEADLINE_HOURS = 48;

/** Resolve within 7 days of acknowledging. */
export const RESOLUTION_DEADLINE_DAYS = 7;

const HOUR = 3_600_000;
const DAY = 86_400_000;

export interface ClockRequest {
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  status: string;
}

export type ClockState =
  | "not acknowledged yet"
  | "acknowledgement overdue"
  | "in progress"
  | "past deadline, still open"
  | "resolved in time"
  | "resolved late";

export interface GrievanceClock {
  state: ClockState;
  /** When the 7-day resolution deadline falls, or null until acknowledged. */
  dueAt: number | null;
  /** Was the acknowledgement made inside 48 hours? */
  ackInTime: boolean;
  /** How far past the deadline the request sits (0 when not past). */
  overdueBy: number;
}

export function acknowledgedInTime(
  createdAt: string,
  acknowledgedAt: string | null,
  now: Date = new Date(),
): boolean {
  if (!acknowledgedAt) return false;
  const took = new Date(acknowledgedAt).getTime() - new Date(createdAt).getTime();
  if (took < 0) return false;
  return took <= ACK_DEADLINE_HOURS * HOUR;
}

/** Resolution deadline = acknowledgement + 7 days. Null until acknowledged. */
export function resolutionDueAt(acknowledgedAt: string | null): number | null {
  if (!acknowledgedAt) return null;
  return new Date(acknowledgedAt).getTime() + RESOLUTION_DEADLINE_DAYS * DAY;
}

export function grievanceClock(r: ClockRequest, now: Date = new Date()): GrievanceClock {
  const acked = acknowledgedInTime(r.created_at, r.acknowledged_at, now);
  const dueAt = resolutionDueAt(r.acknowledged_at);
  const closed = r.status === "closed" && Boolean(r.resolved_at);

  if (!r.acknowledged_at) {
    const waiting = now.getTime() - new Date(r.created_at).getTime();
    return {
      state: waiting > ACK_DEADLINE_HOURS * HOUR ? "acknowledgement overdue" : "not acknowledged yet",
      dueAt,
      ackInTime: false,
      overdueBy: Math.max(0, waiting - ACK_DEADLINE_HOURS * HOUR),
    };
  }

  if (closed) {
    const resolved = new Date(r.resolved_at as string).getTime();
    const late = dueAt !== null && resolved > dueAt;
    return {
      state: late ? "resolved late" : "resolved in time",
      dueAt,
      ackInTime: acked,
      overdueBy: late ? resolved - (dueAt as number) : 0,
    };
  }

  const overdueBy = dueAt === null ? 0 : Math.max(0, now.getTime() - dueAt);
  return {
    state: overdueBy > 0 ? "past deadline, still open" : "in progress",
    dueAt,
    ackInTime: acked,
    overdueBy,
  };
}

/** Short human line for the console, e.g. "Resolve by 14 Oct — 2 days left". */
export function clockLabel(clock: GrievanceClock, fmt: (ms: number) => string): string {
  if (clock.state === "resolved in time") return "Closed within the deadline";
  if (clock.state === "resolved late") return `Closed ${Math.round(clock.overdueBy / DAY)} days late`;
  if (clock.state === "acknowledgement overdue") {
    return `Acknowledgement ${Math.round(clock.overdueBy / HOUR)} hours overdue`;
  }
  if (clock.dueAt === null) return "Awaiting acknowledgement";
  if (clock.overdueBy > 0) return `Past deadline by ${Math.round(clock.overdueBy / DAY)} days`;
  return `Resolve by ${fmt(clock.dueAt)}`;
}
