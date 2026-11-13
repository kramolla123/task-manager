/** UI hints only: all actions and file access are additionally validated in PostgreSQL. */
import type { AssetKind, Profile, Role, Task, TaskAction } from "./types";
import { isClosed } from "./format";

type Me = Pick<Profile, "id" | "role" | "active"> & { permissions?: string[] };
export function hasPermission(me: Me | null | undefined, key: string): boolean {
 return !!me?.active && (me.role === "superuser" || !!me.permissions?.includes(key));
}
export const isProductionHead = (role?: Role | null) => role === "production_head" || role === "superuser";
export const isSalesRole = (role?: Role | null) => role === "sales_manager" || role === "sales_head";
export const isHeadRole = (role?: Role | null) => isProductionHead(role) || role === "sales_head";
export const canCreateTask = (me?: Me | null) => hasPermission(me, "tasks.create");
export const canManageEmployees = (me?: Me | null) => hasPermission(me, "employees.manage") || hasPermission(me, "employees.manage_sales");
export const canManageCategories = (me?: Me | null) => hasPermission(me, "categories.manage");
export const canViewAnalytics = (me?: Me | null) => hasPermission(me, "analytics.view");
export const canSeeComments = (me?: Me | null) => hasPermission(me, "comments.view");
export const seesOnlyApprovedAi = (me?: Me | null) =>
 !!me && hasPermission(me,"files.view_approved") && !hasPermission(me,"files.view_internal") && !hasPermission(me,"files.view_design");

function context(task: Task, me: Me) {
 return {
  owner: task.created_by === me.id,
  creator: !!task.creator_id && task.creator_id === me.id,
  stylist: !!task.stylist_id && task.stylist_id === me.id,
  designer: !!task.designer_id && task.designer_id === me.id,
  override: hasPermission(me,"workflow.override"),
  closed: isClosed(task),
 };
}
export function availableActions(task: Task, me: Me | null | undefined): TaskAction[] {
 if (!me?.active || me.role === "pending") return [];
 const c=context(task,me),s=task.status, actions:TaskAction[]=[];
 if (s==="to_do" && !task.creator_id && hasPermission(me,"tasks.claim")) actions.push("claim");
 if (s==="in_progress" && task.current_cycle===0 && (c.creator||c.override) && hasPermission(me,"styling.request")) actions.push("set_stylist");
 if (s==="stylist" && (!task.stylist_id||c.stylist||c.override) && hasPermission(me,"styling.finish")) actions.push("finish_stylist");
 if (["in_progress","rework"].includes(s) && (c.creator||c.override) && hasPermission(me,"ai.submit")) actions.push("submit_ai");
 if (s==="review" && (!task.stylist_id||c.stylist||c.override) && hasPermission(me,"styling.review")) actions.push("stylist_review");
 if (s==="review" && hasPermission(me,"ai.approve")) actions.push("approve_ai");
 if (s==="review" && hasPermission(me,"ai.reject")) actions.push("reject_ai");
 if (s==="ready" && (c.owner||c.override) && hasPermission(me,"testing.start")) actions.push("start_test");
 if (s==="testing" && (c.owner||c.override) && hasPermission(me,"testing.finish")) actions.push("finish_test");
 if (["design","design_rework"].includes(s) && (!task.designer_id||c.designer||c.override) && hasPermission(me,"design.submit")) actions.push("submit_design");
 if (s==="design_review" && hasPermission(me,"design.approve")) actions.push("approve_design");
 if (s==="design_review" && hasPermission(me,"design.reject")) actions.push("reject_design");
 if (!c.closed && hasPermission(me,"tasks.assign")) actions.push("assign");
 if (!c.closed && (hasPermission(me,"tasks.edit_all") || (c.owner && hasPermission(me,"tasks.edit_own")))) actions.push("update");
 if (!c.closed && hasPermission(me,"tasks.deadline")) actions.push("deadline");
 if (!c.closed && (hasPermission(me,"tasks.cancel_all") || (c.owner && hasPermission(me,"tasks.cancel_own")))) actions.push("cancel");
 return actions;
}
const DRIVING_ACTIONS:TaskAction[]=["claim","finish_stylist","submit_ai","stylist_review","approve_ai","start_test","finish_test","submit_design","approve_design"];
export function needsMyAction(task:Task,me:Me|null|undefined) {
 return availableActions(task,me).some(a=>DRIVING_ACTIONS.includes(a));
}
export function uploadableKinds(task: Task, me: Me | null | undefined): AssetKind[] {
 if(!me?.active||me.role==="pending"||isClosed(task))return [];
 const c=context(task,me),s=task.status, out:AssetKind[]=[];
 if((c.owner||c.override)&&hasPermission(me,"files.upload_manager"))out.push("manager_reference");
 if(s==="stylist" && (!task.stylist_id||c.stylist||c.override) && hasPermission(me,"files.upload_stylist"))out.push("stylist_reference");
 if(["in_progress","rework"].includes(s)&&(c.creator||c.override)&&hasPermission(me,"files.upload_ai"))out.push("ai");
 if(["design","design_rework"].includes(s)&&(!task.designer_id||c.designer||c.override)&&hasPermission(me,"files.upload_design"))out.push("design");
 if(s==="testing"&&(c.owner||c.override)&&hasPermission(me,"files.upload_test"))out.push("test_screenshot");
 return out;
}
