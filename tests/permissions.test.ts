import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { can, canChangeStatus, canDeleteTask, canEditTask, canViewTask } from "../src/lib/permissions";

const admin = { id: "a", role: "ADMIN" as const };
const manager = { id: "m", role: "MANAGER" as const };
const member = { id: "u1", role: "MEMBER" as const };
const task = { assigneeId: "u1", createdById: "m" };
const othersTask = { assigneeId: "u2", createdById: "m" };

describe("role capabilities", () => {
  it("only admins manage the company, people and teams", () => {
    assert.ok(can.manageCompany("ADMIN") && can.manageUsers("ADMIN") && can.manageTeams("ADMIN"));
    for (const r of ["MANAGER", "MEMBER"] as const) {
      assert.ok(!can.manageCompany(r) && !can.manageUsers(r) && !can.manageTeams(r));
    }
  });
  it("admins and managers can assign work to others; members can't", () => {
    assert.ok(can.assignToOthers("ADMIN") && can.assignToOthers("MANAGER"));
    assert.ok(!can.assignToOthers("MEMBER"));
  });
});

describe("task permissions", () => {
  it("members can change status only on their own tasks", () => {
    assert.ok(canChangeStatus(member, task));
    assert.ok(!canChangeStatus(member, othersTask));
    assert.ok(canChangeStatus(manager, othersTask));
  });
  it("members can't edit or delete tasks someone else created", () => {
    assert.ok(!canEditTask(member, task));
    assert.ok(!canDeleteTask(member, task));
    assert.ok(canEditTask(member, { assigneeId: "u1", createdById: "u1" }));
    assert.ok(canEditTask(admin, task) && canDeleteTask(manager, task));
  });
  it("respects the company visibility setting", () => {
    assert.ok(canViewTask(member, othersTask, "ALL"));
    assert.ok(!canViewTask(member, othersTask, "OWN"));
    assert.ok(canViewTask(member, task, "OWN"));
    assert.ok(canViewTask(manager, othersTask, "OWN"));
  });
});
