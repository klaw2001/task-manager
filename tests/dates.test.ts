import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addDays, describeDue, diffDays, dueBucket, isValidYmd, todayIn } from "../src/lib/dates";

describe("todayIn", () => {
  it("uses the company timezone, not UTC", () => {
    // 23:30 UTC on Oct 16 is already Oct 17 in Tokyo and still Oct 16 in New York.
    const instant = new Date("2026-10-16T23:30:00Z");
    assert.equal(todayIn("UTC", instant), "2026-10-16");
    assert.equal(todayIn("Asia/Tokyo", instant), "2026-10-17");
    assert.equal(todayIn("America/New_York", instant), "2026-10-16");
  });
  it("falls back to UTC for an invalid timezone", () => {
    assert.equal(todayIn("Not/AZone", new Date("2026-01-02T03:00:00Z")), "2026-01-02");
  });
});

describe("date arithmetic", () => {
  it("adds days across month and year boundaries", () => {
    assert.equal(addDays("2026-12-30", 3), "2027-01-02");
    assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  });
  it("diffs whole days (DST-safe)", () => {
    assert.equal(diffDays("2026-03-30", "2026-03-28"), 2);
    assert.equal(diffDays("2026-11-02", "2026-11-01"), 1);
  });
  it("validates calendar dates", () => {
    assert.ok(isValidYmd("2026-02-28"));
    assert.ok(!isValidYmd("2026-02-30"));
    assert.ok(!isValidYmd("26-1-1"));
  });
});

describe("overdue rules", () => {
  const today = "2026-10-16";
  it("is overdue only when the due date has passed and the task isn't done", () => {
    assert.equal(dueBucket("2026-10-15", "TODO", today), "overdue");
    assert.equal(dueBucket("2026-10-16", "TODO", today), "today"); // due today ≠ overdue
    assert.equal(dueBucket("2026-10-17", "IN_PROGRESS", today), "upcoming");
    assert.equal(dueBucket(null, "TODO", today), "none");
    assert.equal(dueBucket("2026-01-01", "DONE", today), "done"); // finishing late clears overdue
  });
  it("describes how late a task is", () => {
    assert.equal(describeDue("2026-10-15", "TODO", today).label, "1 day overdue");
    assert.equal(describeDue("2026-10-07", "TODO", today).label, "9 days overdue");
    assert.equal(describeDue("2026-10-16", "TODO", today).label, "Due today");
    assert.equal(describeDue("2026-10-17", "TODO", today).label, "Tomorrow");
    assert.equal(describeDue("2026-10-07", "TODO", today).tone, "danger");
  });
});
