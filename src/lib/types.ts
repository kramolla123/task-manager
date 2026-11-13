export const ROLES = [
  "production_head",
  "sales_head",
  "sales_manager",
  "creator",
  "stylist",
  "designer",
  "pending",
] as const;
export type Role = string;

export const TASK_STATUSES = [
  "to_do",
  "stylist",
  "in_progress",
  "review",
  "rework",
  "ready",
  "testing",
  "design",
  "design_review",
  "design_rework",
  "completed",
  "cancelled",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const PRIORITIES = ["Low", "Medium", "High"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const ASSET_KINDS = [
  "manager_reference",
  "stylist_reference",
  "ai",
  "design",
  "test_screenshot",
] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export type ReviewState = "pending" | "approved" | "rejected";
export type CategoryRoute = "testing" | "design";

export interface Profile {
  id: string;
  full_name: string | null;
  telegram: string | null;
  role: Role;
  permissions?: string[];
  active: boolean;
  created_at?: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  deadline_days: number;
  route: CategoryRoute;
  active: boolean;
}

export interface Task {
  id: string;
  number: number;
  category_id: string;
  product_url: string | null;
  ld_article: string | null;
  description: string | null;
  requested_photos: number;
  source_url: string | null;
  priority: Priority;
  created_by: string | null;
  creator_id: string | null;
  stylist_id: string | null;
  designer_id: string | null;
  status: TaskStatus;
  stylist_required: boolean | null;
  current_cycle: number;
  design_cycle: number;
  deadline_at: string | null;
  ai_approved_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  version: number;
  category?: Category | null;
  initiator?: Profile | null;
  creator?: Profile | null;
  stylist?: Profile | null;
  designer?: Profile | null;
}

export interface AssetVersion {
  id: string;
  slot_id: string;
  version_number: number;
  storage_path: string;
  filename: string;
  mime_type: string | null;
  created_at: string;
  created_by: string | null;
}

export interface AssetSlot {
  id: string;
  task_id: string;
  kind: AssetKind;
  slot_number: number;
  review_state: ReviewState;
  current_version_id: string | null;
  created_at: string;
  versions: AssetVersion[];
  current: AssetVersion | null;
}

export interface TaskEvent {
  id: string;
  task_id: string;
  actor_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface ReviewRejection {
  id: string;
  task_id: string;
  slot_id: string | null;
  cycle: number;
  stage: string;
  reason: string;
  comment: string | null;
  created_at: string;
}

export interface TestResult {
  id: string;
  task_id: string;
  ctr_best: number | null;
  ctr_worst: number | null;
  used_main: boolean | null;
  notes: string | null;
  created_at: string;
}

export interface DesignSubmission {
  id: string;
  task_id: string;
  cycle: number;
  canva_url: string | null;
  notes: string | null;
  created_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
}

export type TaskAction =
  | "claim"
  | "set_stylist"
  | "finish_stylist"
  | "submit_ai"
  | "stylist_review"
  | "approve_ai"
  | "reject_ai"
  | "start_test"
  | "finish_test"
  | "assign"
  | "submit_design"
  | "approve_design"
  | "reject_design"
  | "update"
  | "deadline"
  | "cancel";
export interface AppRole { slug:string; name:string; description:string; is_system:boolean; active:boolean; created_at:string; }
export interface AppPermission { key:string; label:string; group_name:string; }
export interface AppRolePermission { role_slug:string; permission_key:string; }
