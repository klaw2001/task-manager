// Pure permission rules — safe to import from client components for UI hints.
// The server re-checks every one of these inside each action.
import type { MemberVisibility, Role } from "./constants";

type Actor = { id: string; role: Role };
type TaskLike = { assigneeId: string | null; createdById: string };

export const isAdmin = (role: Role) => role === "ADMIN";
export const isLead = (role: Role) => role === "ADMIN" || role === "MANAGER";

export const can = {
  manageCompany: (role: Role) => role === "ADMIN",
  manageUsers: (role: Role) => role === "ADMIN",
  manageTeams: (role: Role) => role === "ADMIN",
  /** Create tasks for other people / reassign. */
  assignToOthers: (role: Role) => isLead(role),
  viewWorkload: (role: Role) => isLead(role),
  viewAllTasks: (role: Role, visibility: MemberVisibility) => isLead(role) || visibility === "ALL",
};

export function canEditTask(user: Actor, task: TaskLike) {
  return isLead(user.role) || task.createdById === user.id;
}

export function canChangeStatus(user: Actor, task: TaskLike) {
  return isLead(user.role) || task.assigneeId === user.id || task.createdById === user.id;
}

export function canDeleteTask(user: Actor, task: TaskLike) {
  return isLead(user.role) || task.createdById === user.id;
}

export function canViewTask(user: Actor, task: TaskLike, visibility: MemberVisibility) {
  return (
    isLead(user.role) ||
    visibility === "ALL" ||
    task.assigneeId === user.id ||
    task.createdById === user.id
  );
}
