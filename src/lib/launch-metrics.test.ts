import { describe, expect, it } from "vitest";
import { LAUNCH_TARGETS, buildScorecard, returnedWithinWindow } from "./launch-metrics";

const DAY = 86_400_000;
const NOW = new Date("2026-10-20T12:00:00.000Z");

const user = (id: string, joinedDaysAgo: number) => ({
  id,
  email: `${id}@example.com`,
  createdAt: new Date(NOW.getTime() - joinedDaysAgo * DAY).toISOString(),
});

const billsFor = (ids: string[]) => ids.flatMap((id) => [{ user_id: id }, { user_id: id }]);

describe("the agreed success bar", () => {
  it("needs 5 people scanning two bills and 2 returning within 7 days", () => {
    expect(LAUNCH_TARGETS).toEqual({ scannedTwoBills: 5, returnedWithin7Days: 2 });
  });
});

describe("returnedWithinWindow", () => {
  it("counts a second visit on day 4 as a return", () => {
    expect(returnedWithinWindow("2026-10-01T10:00:00.000Z", ["2026-10-01", "2026-10-05"])).toBe(true);
  });

  it("does not count the signup-day visit as a return", () => {
    expect(returnedWithinWindow("2026-10-01T10:00:00.000Z", ["2026-10-01"])).toBe(false);
  });

  it("does not count a visit on day 8 as a return", () => {
    expect(returnedWithinWindow("2026-10-01T10:00:00.000Z", ["2026-10-09"])).toBe(false);
  });
});

describe("buildScorecard", () => {
  it("passes when 5 people scan two bills and 2 come back within 7 days", () => {
    const users = ["u1", "u2", "u3", "u4", "u5", "u6"].map((id) => user(id, 10));
    const card = buildScorecard(
      users,
      billsFor(["u1", "u2", "u3", "u4", "u5"]),
      [
        { user_id: "u1", visited_on: "2026-10-10" },
        { user_id: "u1", visited_on: "2026-10-13" },
        { user_id: "u2", visited_on: "2026-10-10" },
        { user_id: "u2", visited_on: "2026-10-14" },
        { user_id: "u3", visited_on: "2026-10-10" },
      ],
      [{ user_id: "u1", source: "whatsapp", campaign: null }],
      [],
      NOW,
    );
    expect(card.totals.scannedTwoBills).toBe(5);
    expect(card.totals.returnedWithin7Days).toBe(2);
    expect(card.passed).toBe(true);
    expect(card.rows.find((r) => r.id === "u1")?.source).toBe("whatsapp");
    expect(card.rows.find((r) => r.id === "u6")?.source).toBe("direct");
  });

  it("fails when only 4 people have scanned two bills", () => {
    const users = ["u1", "u2", "u3", "u4", "u5"].map((id) => user(id, 10));
    const card = buildScorecard(
      users,
      billsFor(["u1", "u2", "u3", "u4"]),
      [
        { user_id: "u1", visited_on: "2026-10-13" },
        { user_id: "u2", visited_on: "2026-10-14" },
      ],
      [],
      [],
      NOW,
    );
    expect(card.totals.scannedTwoBills).toBe(4);
    expect(card.passed).toBe(false);
  });

  it("keeps staff and test logins out of the totals", () => {
    const users = ["u1", "u2", "u3", "u4", "u5", "staff"].map((id) => user(id, 10));
    const card = buildScorecard(
      users,
      billsFor(["u1", "u2", "u3", "u4", "u5", "staff", "staff", "staff"]),
      [
        { user_id: "u1", visited_on: "2026-10-13" },
        { user_id: "u2", visited_on: "2026-10-14" },
      ],
      [],
      ["staff"],
      NOW,
    );
    expect(card.totals.signups).toBe(5);
    expect(card.totals.staffAccounts).toBe(1);
    expect(card.totals.scannedTwoBills).toBe(5);
    expect(card.passed).toBe(true);
  });
});
