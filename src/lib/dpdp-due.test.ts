import { describe, expect, it } from "vitest";
import {
  ACK_DEADLINE_HOURS,
  RESOLUTION_DEADLINE_DAYS,
  acknowledgedInTime,
  grievanceClock,
  resolutionDueAt,
} from "./dpdp-due";

const T0 = "2026-10-01T00:00:00.000Z";
const HOUR = 3_600_000;
const DAY = 86_400_000;

const at = (ms: number) => new Date(ms).toISOString();
const base = {
  created_at: T0,
  acknowledged_at: null as string | null,
  resolved_at: null as string | null,
  status: "open",
};

describe("grievance acknowledgement deadline", () => {
  it("is 48 hours to acknowledge and 7 days to resolve", () => {
    expect(ACK_DEADLINE_HOURS).toBe(48);
    expect(RESOLUTION_DEADLINE_DAYS).toBe(7);
  });

  it("counts an acknowledgement made at 47 hours as on time", () => {
    expect(acknowledgedInTime(T0, at(new Date(T0).getTime() + 47 * HOUR))).toBe(true);
  });

  it("counts an acknowledgement made at 49 hours as late", () => {
    expect(acknowledgedInTime(T0, at(new Date(T0).getTime() + 49 * HOUR))).toBe(false);
  });

  it("counts no acknowledgement as not on time", () => {
    expect(acknowledgedInTime(T0, null)).toBe(false);
  });
});

describe("resolution deadline", () => {
  it("falls exactly 7 days after the acknowledgement", () => {
    expect(resolutionDueAt(T0)).toBe(new Date(T0).getTime() + 7 * DAY);
  });

  it("does not exist until the request is acknowledged", () => {
    expect(resolutionDueAt(null)).toBeNull();
  });
});

describe("grievanceClock", () => {
  it("flags an unacknowledged request that has waited 49 hours", () => {
    const clock = grievanceClock(base, new Date(new Date(T0).getTime() + 49 * HOUR));
    expect(clock.state).toBe("acknowledgement overdue");
    expect(clock.overdueBy).toBe(HOUR);
  });

  it("treats a request still inside the 48 hour window as not acknowledged yet", () => {
    const clock = grievanceClock(base, new Date(new Date(T0).getTime() + 10 * HOUR));
    expect(clock.state).toBe("not acknowledged yet");
    expect(clock.overdueBy).toBe(0);
  });

  it("marks an open request one day past its deadline", () => {
    const clock = grievanceClock(
      { ...base, acknowledged_at: T0 },
      new Date(new Date(T0).getTime() + 8 * DAY),
    );
    expect(clock.state).toBe("past deadline, still open");
    expect(clock.overdueBy).toBe(DAY);
  });

  it("marks a request closed on day 6 as resolved in time", () => {
    const clock = grievanceClock(
      {
        ...base,
        acknowledged_at: T0,
        status: "closed",
        resolved_at: at(new Date(T0).getTime() + 6 * DAY),
      },
      new Date(new Date(T0).getTime() + 9 * DAY),
    );
    expect(clock.state).toBe("resolved in time");
    expect(clock.overdueBy).toBe(0);
  });

  it("marks a request closed on day 9 as resolved late", () => {
    const clock = grievanceClock(
      {
        ...base,
        acknowledged_at: T0,
        status: "closed",
        resolved_at: at(new Date(T0).getTime() + 9 * DAY),
      },
      new Date(new Date(T0).getTime() + 9 * DAY),
    );
    expect(clock.state).toBe("resolved late");
    expect(clock.overdueBy).toBe(2 * DAY);
  });
});
