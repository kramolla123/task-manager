import { format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import type { Profile, Task } from "./types";

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = typeof value === "string" ? parseISO(value) : value;
  return isValid(d) ? d : null;
}

export function fmtDate(value: string | null | undefined) {
  const d = toDate(value);
  return d ? format(d, "d MMM yyyy", { locale: ru }) : "—";
}

export function fmtDateTime(value: string | null | undefined) {
  const d = toDate(value);
  return d ? format(d, "d MMM yyyy, HH:mm", { locale: ru }) : "—";
}

export function fmtRelative(value: string | null | undefined) {
  const d = toDate(value);
  return d ? formatDistanceToNowStrict(d, { locale: ru, addSuffix: true }) : "—";
}

export const CLOSED_STATUSES = ["completed", "cancelled"] as const;

export function isClosed(task: Pick<Task, "status">) {
  return task.status === "completed" || task.status === "cancelled";
}

export function isOverdue(task: Pick<Task, "status" | "deadline_at">, now: Date = new Date()) {
  if (isClosed(task) || !task.deadline_at) return false;
  const d = toDate(task.deadline_at);
  return !!d && d.getTime() < now.getTime();
}

/** Completed after the deadline, or still open past it. */
export function wasOverdue(
  task: Pick<Task, "status" | "deadline_at" | "completed_at">,
  now: Date = new Date(),
) {
  if (!task.deadline_at || task.status === "cancelled") return false;
  const deadline = toDate(task.deadline_at)!;
  if (task.status === "completed") {
    const done = toDate(task.completed_at);
    return !!done && done.getTime() > deadline.getTime();
  }
  return deadline.getTime() < now.getTime();
}

export function personName(p: Pick<Profile, "full_name" | "telegram"> | null | undefined) {
  if (!p) return "—";
  return p.full_name?.trim() || p.telegram?.trim() || "Без имени";
}

export function initials(p: Pick<Profile, "full_name" | "telegram"> | null | undefined) {
  const name = personName(p);
  if (name === "—") return "?";
  return name
    .replace(/^@/, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

export function toDatetimeLocal(value: string | null | undefined) {
  const d = toDate(value);
  return d ? format(d, "yyyy-MM-dd'T'HH:mm") : "";
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}