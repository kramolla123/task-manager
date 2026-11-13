import { assetCommand, AppError } from "./api";
import { ASSET_BUCKET, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabase } from "./supabase";
import type { AssetKind } from "./types";

/** Storage keys must be ASCII-safe; the original name is kept in asset_versions.filename. */
export function safeStorageName(name: string) {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot + 1) : "";
  const clean = base
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
  const cleanExt = ext.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
  return `${clean || "file"}${cleanExt ? `.${cleanExt}` : ""}`;
}

/** Upload with real progress via the Storage REST endpoint (same as supabase-js upload). */
function xhrUpload(path: string, file: File, token: string, onProgress?: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const encoded = path.split("/").map(encodeURIComponent).join("/");
    xhr.open("POST", `${SUPABASE_URL}/storage/v1/object/${ASSET_BUCKET}/${encoded}`);
    xhr.setRequestHeader("authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", SUPABASE_PUBLISHABLE_KEY);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let msg = `Ошибка загрузки (${xhr.status})`;
      try {
        const body = JSON.parse(xhr.responseText);
        msg = body.message || body.error || msg;
      } catch {
        /* ignore */
      }
      if (xhr.status === 403 || /row-level security/i.test(msg))
        msg = "Нет прав на загрузку файла в эту заявку";
      reject(new AppError(msg));
    };
    xhr.onerror = () => reject(new TypeError("network"));
    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", file);
    xhr.send(form);
  });
}

async function uploadToStorage(path: string, file: File, onProgress?: (p: number) => void) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new AppError("Сессия истекла, войдите снова");
  try {
    await xhrUpload(path, file, token, onProgress);
  } catch (e) {
    if (!(e instanceof TypeError)) throw e;
    // Network-level failure of the XHR path: fall back to supabase-js upload.
    const { error } = await supabase.storage
      .from(ASSET_BUCKET)
      .upload(path, file, { upsert: false, ...(file.type ? { contentType: file.type } : {}) });
    if (error) throw new AppError(error.message);
    onProgress?.(100);
  }
}

export type UploadStage = "slot" | "upload" | "register" | "done";

/**
 * 1) create_slot (unless replacing) → 2) upload to private bucket → 3) add_version.
 * Replacing passes an existing slotId; older versions are preserved by the server.
 */
export async function uploadAsset(opts: {
  taskId: string;
  kind: AssetKind;
  file: File;
  slotId?: string;
  onProgress?: (percent: number, stage: UploadStage) => void;
}) {
  const { taskId, kind, file, onProgress } = opts;
  let slotId = opts.slotId;
  if (!slotId) {
    onProgress?.(0, "slot");
    const res = await assetCommand(taskId, "create_slot", { kind });
    if (!res.slot_id) throw new AppError("Сервер не вернул идентификатор слота");
    slotId = res.slot_id;
  }
  const path = `${taskId}/${slotId}/${crypto.randomUUID()}-${safeStorageName(file.name)}`;
  await uploadToStorage(path, file, (p) => onProgress?.(p, "upload"));
  onProgress?.(100, "register");
  await assetCommand(taskId, "add_version", {
    slot_id: slotId,
    storage_path: path,
    filename: file.name,
    mime_type: file.type || "application/octet-stream",
  });
  onProgress?.(100, "done");
  return slotId;
}