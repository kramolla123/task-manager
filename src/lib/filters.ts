import type { Priority, Task, TaskStatus } from "./types";
import { isClosed, isOverdue } from "./format";

export type DeadlineFilter = "overdue" | "today" | "week" | "none";

export interface TaskFilters {
  scope: "mine" | "all";
  number?: string | undefined;
  ld?: string | undefined;
  category?: string | undefined;
  status?: TaskStatus | undefined;
  initiator?: string | undefined;
  executor?: string | undefined;
  priority?: Priority | undefined;
  deadline?: DeadlineFilter | undefined;
  showClosed?: boolean | undefined;
}

export function isMine(task: Task, userId: string) {
  return (
    task.created_by === userId ||
    task.creator_id === userId ||
    task.stylist_id === userId ||
    task.designer_id === userId
  );
}

export function applyFilters(
  tasks: Task[],
  f: TaskFilters,
  userId: string,
  now: Date = new Date(),
): Task[] {
  const num = f.number?.trim().replace(/^№|^#/, "");
  const ld = f.ld?.trim().toLowerCase();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const inWeek = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

  return tasks.filter((t) => {
    if (f.scope === "mine" && !isMine(t, userId)) return false;
    if (num && !String(t.number).includes(num)) return false;
    if (ld && !(t.ld_article ?? "").toLowerCase().includes(ld)) return false;
    if (f.category && t.category_id !== f.category) return false;
    if (f.status && t.status !== f.status) return false;
    if (!f.status && !f.showClosed && isClosed(t)) return false;
    if (f.initiator && t.created_by !== f.initiator) return false;
    if (
      f.executor &&
      t.creator_id !== f.executor &&
      t.stylist_id !== f.executor &&
      t.designer_id !== f.executor
    )
      return false;
    if (f.priority && t.priority !== f.priority) return false;
    if (f.deadline) {
      const d = t.deadline_at ? new Date(t.deadline_at) : null;
      if (f.deadline === "none" && d) return false;
      if (f.deadline === "overdue" && !isOverdue(t, now)) return false;
      if (f.deadline === "today" && (!d || isClosed(t) || d > endOfToday)) return false;
      if (f.deadline === "week" && (!d || isClosed(t) || d > inWeek)) return false;
    }
    return true;
  });
}