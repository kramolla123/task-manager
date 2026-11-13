/**
 * UI-only permission hints. They decide which buttons are SHOWN.
 * The server (task-command edge function, RPCs, RLS) is the single source of truth
 * and re-checks every action; never rely on these for security.
 */
import type { AssetKind, Profile, Role, Task, TaskAction } from "./types";
import { isClosed } from "./format";

type Me = Pick<Profile, "id" | "role" | "active">;

export const isProductionHead = (role?: Role | null) => role === "production_head";
export const isSalesRole = (role?: Role | null) =>
  role === "sales_manager" || role === "sales_head";
export const isHeadRole = (role?: Role | null) =>
  role === "production_head" || role === "sales_head";

export const canCreateTask = (role?: Role | null) =>
  role === "sales_manager" || role === "sales_head" || role === "production_head";
export const canManageEmployees = (role?: Role | null) => role === "production_head";
export const canManageCategories = (role?: Role | null) => role === "production_head";
export const canViewAnalytics = (role?: Role | null) => isHeadRole(role);
/** Comments are a production-only channel. */
export const canSeeComments = (role?: Role | null) =>
  role === "production_head" || role === "creator" || role === "stylist" || role === "designer";
/** Sales roles only receive approved AI materials. */
export const seesOnlyApprovedAi = (role?: Role | null) => isSalesRole(role);

function ctx(task: Task, me: Me) {
  const head = me.role === "production_head";
  return {
    head,
    salesHead: me.role === "sales_head",
    sales: isSalesRole(me.role),
    initiator: !!task.created_by && task.created_by === me.id,
    myCreator: !!task.creator_id && task.creator_id === me.id,
    myStylist: !!task.stylist_id && task.stylist_id === me.id,
    myDesigner: !!task.designer_id && task.designer_id === me.id,
    closed: isClosed(task),
    route: task.category?.route ?? null,
  };
}

export function availableActions(task: Task, me: Me | null | undefined): TaskAction[] {
  if (!me || !me.active || me.role === "pending") return [];
  const c = ctx(task, me);
  const s = task.status;
  const out: TaskAction[] = [];

  if (s === "to_do" && (c.head || (me.role === "creator" && (!task.creator_id || c.myCreator))))
    out.push("claim");
  if (s === "in_progress" && task.current_cycle === 0 && (c.myCreator || c.head)) out.push("set_stylist");
  if (s === "stylist" && (c.myStylist || c.head)) out.push("finish_stylist");
  if ((s === "in_progress" || s === "rework") && (c.myCreator || c.head)) out.push("submit_ai");
  if (s === "review" && task.stylist_required && (c.myStylist || c.head))
    out.push("stylist_review");
  if (s === "review" && c.head) out.push("approve_ai", "reject_ai");
  if (s === "ready" && c.route === "testing" && (c.initiator || c.head))
    out.push("start_test");
  if (s === "testing" && (c.initiator || c.head)) out.push("finish_test");
  if ((s === "design" || s === "design_rework") && (c.myDesigner || c.head))
    out.push("submit_design");
  if (s === "design_review" && c.head) out.push("approve_design", "reject_design");
  if (!c.closed && c.head) out.push("assign");
  if (!c.closed && (c.initiator || c.head || c.salesHead)) out.push("update");
  if (!c.closed && c.head) out.push("deadline");
  if (!c.closed && (c.initiator || c.head || c.salesHead)) out.push("cancel");
  return out;
}

/** Workflow actions that mean "the ball is in your court". */
const DRIVING_ACTIONS: TaskAction[] = [
  "claim",
  "finish_stylist",
  "submit_ai",
  "stylist_review",
  "approve_ai",
  "start_test",
  "finish_test",
  "submit_design",
  "approve_design",
];

export function needsMyAction(task: Task, me: Me | null | undefined) {
  const acts = availableActions(task, me);
  if (task.status === "to_do" && me?.role === "production_head") return false; // heads don't claim by default
  return acts.some((a) => DRIVING_ACTIONS.includes(a));
}

export function uploadableKinds(task: Task, me: Me | null | undefined): AssetKind[] {
  if (!me || !me.active || me.role === "pending") return [];
  const c = ctx(task, me);
  if (c.closed) return [];
  const s = task.status;
  const out: AssetKind[] = [];
  if (c.initiator) out.push("manager_reference");
  if (me.role === "stylist" && s === "stylist" && (!task.stylist_id || c.myStylist))
    out.push("stylist_reference");
  if (c.myCreator && ["in_progress", "rework"].includes(s)) out.push("ai");
  if (me.role === "designer" && (c.myDesigner || !task.designer_id) && ["design", "design_rework"].includes(s)) out.push("design");
  if (c.initiator && s === "testing") out.push("test_screenshot");
  return out;
}