import { FunctionsHttpError, FunctionsRelayError, FunctionsFetchError } from "@supabase/supabase-js";
import { ASSET_BUCKET, supabase } from "./supabase";
import type {
  AssetSlot,
  AssetVersion,
  Category,
  DesignSubmission,
  Profile,
  ReviewRejection,
  Task,
  TaskAction,
  TaskComment,
  TaskEvent,
  TestResult,
} from "./types";

export const qk = {
  profile: (id: string) => ["profile", id] as const,
  profiles: ["profiles"] as const,
  categories: ["categories"] as const,
  tasks: ["tasks"] as const,
  task: (id: string) => ["task", id] as const,
  taskPart: (id: string, part: string) => ["task", id, part] as const,
  analytics: (month: string) => ["analytics", month] as const,
};

/** Turn any Supabase / function error into a readable Russian message. */
export async function errorMessage(err: unknown): Promise<string> {
  if (err instanceof FunctionsHttpError) {
    try {
      const body = await err.context.json();
      return body?.error || body?.message || "Сервер отклонил действие";
    } catch {
      try {
        return (await err.context.text()) || "Сервер отклонил действие";
      } catch {
        return "Сервер отклонил действие";
      }
    }
  }
  if (err instanceof FunctionsRelayError) return "Сервер команд недоступен (relay)";
  if (err instanceof FunctionsFetchError) return "Не удалось связаться с сервером команд";
  if (err && typeof err === "object" && "message" in err) {
    const m = String((err as { message: unknown }).message);
    return translate(m);
  }
  return "Неизвестная ошибка";
}

function translate(m: string) {
  if (/Invalid login credentials/i.test(m)) return "Неверный email или пароль";
  if (/Email not confirmed/i.test(m)) return "Email не подтверждён — проверьте почту";
  if (/User already registered/i.test(m)) return "Пользователь с таким email уже зарегистрирован";
  if (/Password should be at least/i.test(m)) return "Пароль слишком короткий (минимум 6 символов)";
  if (/row-level security|permission denied/i.test(m)) return "Недостаточно прав для этого действия";
  if (/Failed to fetch|NetworkError/i.test(m)) return "Нет соединения с сервером";
  return m;
}

export class AppError extends Error {}

async function unwrap<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new AppError(await errorMessage(error));
  return data;
}

// ---------- Profiles & categories ----------
const PROFILE_COLS = "id,full_name,telegram,role,active";

export async function fetchProfile(userId: string): Promise<Profile | null> {
  return unwrap(supabase.from("profiles").select("*").eq("id", userId).maybeSingle()) as Promise<
    Profile | null
  >;
}

export async function fetchProfiles(): Promise<Profile[]> {
  return ((await unwrap(supabase.from("profiles").select("*").order("full_name"))) ??
    []) as Profile[];
}

export async function fetchCategories(): Promise<Category[]> {
  return ((await unwrap(supabase.from("categories").select("*").order("name"))) ??
    []) as Category[];
}

// ---------- Tasks ----------
const TASK_SELECTS = [
  `*, category:categories(*), initiator:profiles!created_by(${PROFILE_COLS}), creator:profiles!creator_id(${PROFILE_COLS}), stylist:profiles!stylist_id(${PROFILE_COLS}), designer:profiles!designer_id(${PROFILE_COLS})`,
  "*, category:categories(*)",
  "*",
];
let workingSelect = 0;

function isRelationshipError(error: unknown) {
  const code = (error as { code?: string } | null)?.code ?? "";
  return code.startsWith("PGRST2");
}

async function selectTasks(
  build: (select: string) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<unknown> {
  for (let i = workingSelect; i < TASK_SELECTS.length; i++) {
    const { data, error } = await build(TASK_SELECTS[i]!);
    if (!error) {
      workingSelect = i;
      return data;
    }
    if (!isRelationshipError(error)) throw new AppError(await errorMessage(error));
  }
  throw new AppError("Не удалось загрузить заявки");
}

export async function fetchTasks(): Promise<Task[]> {
  const data = await selectTasks((sel) =>
    supabase.from("tasks").select(sel).order("number", { ascending: false }).limit(2000),
  );
  return (data ?? []) as Task[];
}

export async function fetchTask(id: string): Promise<Task | null> {
  const data = await selectTasks((sel) =>
    supabase.from("tasks").select(sel).eq("id", id).maybeSingle(),
  );
  return (data ?? null) as Task | null;
}

/** Fill in embedded relations from lookup maps when the embed was unavailable. */
export function hydrateTask(
  t: Task,
  profiles: Map<string, Profile>,
  categories: Map<string, Category>,
): Task {
  const p = (id: string | null) => (id ? (profiles.get(id) ?? null) : null);
  return {
    ...t,
    category: t.category ?? categories.get(t.category_id) ?? null,
    initiator: t.initiator ?? p(t.created_by),
    creator: t.creator ?? p(t.creator_id),
    stylist: t.stylist ?? p(t.stylist_id),
    designer: t.designer ?? p(t.designer_id),
  };
}

// ---------- Task detail parts ----------
export async function fetchSlots(taskId: string): Promise<AssetSlot[]> {
  const slots = ((await unwrap(
    supabase
      .from("asset_slots")
      .select("*")
      .eq("task_id", taskId)
      .order("kind")
      .order("slot_number"),
  )) ?? []) as Omit<AssetSlot, "versions" | "current">[];
  if (!slots.length) return [];
  const versions = ((await unwrap(
    supabase
      .from("asset_versions")
      .select("*")
      .in(
        "slot_id",
        slots.map((s) => s.id),
      )
      .order("version_number", { ascending: false }),
  )) ?? []) as AssetVersion[];
  return slots.map((s) => {
    const vs = versions.filter((v) => v.slot_id === s.id);
    const current = vs.find((v) => v.id === s.current_version_id) ?? vs[0] ?? null;
    return { ...s, versions: vs, current };
  });
}

export async function fetchEvents(taskId: string): Promise<TaskEvent[]> {
  return ((await unwrap(
    supabase
      .from("task_events")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false }),
  )) ?? []) as TaskEvent[];
}

export async function fetchRejections(taskId: string): Promise<ReviewRejection[]> {
  return ((await unwrap(
    supabase
      .from("review_rejections")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false }),
  )) ?? []) as ReviewRejection[];
}

export async function fetchTestResults(taskId: string): Promise<TestResult[]> {
  return ((await unwrap(
    supabase
      .from("test_results")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false }),
  )) ?? []) as TestResult[];
}

export async function fetchDesignSubmissions(taskId: string): Promise<DesignSubmission[]> {
  return ((await unwrap(
    supabase
      .from("design_submissions")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false }),
  )) ?? []) as DesignSubmission[];
}

export async function fetchComments(taskId: string): Promise<TaskComment[]> {
  return ((await unwrap(
    supabase
      .from("task_comments")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true }),
  )) ?? []) as TaskComment[];
}

export async function addComment(taskId: string, authorId: string, body: string) {
  await unwrap(supabase.from("task_comments").insert({ task_id: taskId, author_id: authorId, body }));
}

// ---------- Commands (edge function) ----------
async function invokeTaskCommand(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("task-command", { body });
  if (error) throw new AppError(await errorMessage(error));
  if (data && typeof data === "object" && "error" in data && data.error) {
    throw new AppError(String((data as { error: unknown }).error));
  }
  return data as { task?: Task } & Record<string, unknown>;
}

export interface CreateTaskPayload {
  category_id: string;
  product_url: string;
  ld_article: string;
  description: string;
  requested_photos: number;
  source_url: string;
  priority: string;
}

export async function createTask(payload: CreateTaskPayload): Promise<Task> {
  const data = await invokeTaskCommand({ type: "create", payload });
  if (!data?.task) throw new AppError("Сервер не вернул созданную заявку");
  return data.task;
}

export async function runTaskAction(
  taskId: string,
  action: TaskAction,
  payload: Record<string, unknown> = {},
) {
  return invokeTaskCommand({ type: "action", task_id: taskId, action, payload });
}

// ---------- Assets ----------
export async function assetCommand(
  taskId: string,
  command: "create_slot" | "add_version",
  payload: Record<string, unknown>,
): Promise<{ slot_id?: string; version_number?: number } & Record<string, unknown>> {
  const data = await unwrap(
    supabase.rpc("asset_command", { p_task_id: taskId, p_command: command, p_payload: payload }),
  );
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? {}) as { slot_id?: string; version_number?: number };
}

export async function signedUrl(path: string, download?: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(ASSET_BUCKET)
    .createSignedUrl(path, 120, download ? { download } : undefined);
  if (error || !data?.signedUrl)
    throw new AppError(error ? await errorMessage(error) : "Нет доступа к файлу");
  return data.signedUrl;
}

// ---------- Admin ----------
export async function manageEmployee(userId: string, role: string, active: boolean) {
  await unwrap(
    supabase.rpc("manage_employee", { p_user_id: userId, p_role: role, p_active: active }),
  );
}

export async function saveCategory(cat: Partial<Category> & { id?: string }) {
  const { id, ...rest } = cat;
  if (id) await unwrap(supabase.from("categories").update(rest).eq("id", id));
  else await unwrap(supabase.from("categories").insert(rest));
}

// ---------- Analytics ----------
export async function fetchRejectionsBetween(from: string, to: string): Promise<ReviewRejection[]> {
  return ((await unwrap(
    supabase
      .from("review_rejections")
      .select("*")
      .gte("created_at", from)
      .lt("created_at", to)
      .limit(5000),
  )) ?? []) as ReviewRejection[];
}