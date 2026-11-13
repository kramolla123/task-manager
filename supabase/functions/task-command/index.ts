import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const token = req.headers.get("authorization");
  if (!token?.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !key) return json({ error: "Server configuration missing" }, 503);
  const client = createClient(url, key, {
    global: { headers: { Authorization: token } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: authError } = await client.auth.getUser(token.slice(7));
  if (authError || !userData.user) return json({ error: "Invalid session" }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  if (!body || !["create", "action"].includes(String(body.type))) return json({ error: "Invalid command" }, 400);
  const action = body.type === "create" ? "create" : String(body.action ?? "");
  if (body.type === "action" && !/^[a-z_]{2,32}$/.test(action)) return json({ error: "Invalid action" }, 400);
  const taskId = body.type === "create" ? null : body.task_id;
  if (taskId !== null && (typeof taskId !== "string" || !/^[0-9a-f-]{36}$/i.test(taskId))) return json({ error: "Invalid task ID" }, 400);
  const payload = body.payload && typeof body.payload === "object" && !Array.isArray(body.payload) ? body.payload : {};

  const { data, error } = await client.rpc("task_transition", {
    p_type: body.type,
    p_task_id: taskId,
    p_action: action,
    p_payload: payload,
  });
  if (error) {
    console.error("task_transition failed", { code: error.code, action });
    const conflict = error.code === "23505";
    return json({ error: conflict ? "Активная задача с таким артикулом и категорией уже существует" : error.message, code: error.code }, conflict ? 409 : 400);
  }
  return json(data);
});
