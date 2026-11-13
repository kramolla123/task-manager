import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileIcon, Loader2, UploadCloud, XCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { uploadAsset, type UploadStage } from "@/lib/upload";
import { qk } from "@/lib/api";
import { formatBytes } from "@/lib/format";
import type { AssetKind } from "@/lib/types";

export function FileDropzone({
  onFiles,
  disabled,
  accept = "image/*,application/pdf,video/*",
  hint,
  compact,
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  accept?: string;
  hint?: string;
  compact?: boolean;
}) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length) onFiles(files);
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={cn(
        "flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-center text-sm text-muted-foreground transition-colors",
        compact ? "p-3" : "p-6",
        over ? "border-primary bg-accent text-accent-foreground" : "hover:border-primary/60 hover:bg-muted/50",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <UploadCloud className="size-5" />
      <span>
        <b className="font-medium text-foreground">Перетащите файлы</b> или нажмите, чтобы выбрать
      </span>
      {hint && <span className="text-xs">{hint}</span>}
      <input
        ref={input}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
    </button>
  );
}

export interface UploadItem {
  id: string;
  name: string;
  size: number;
  progress: number;
  stage: UploadStage | "queued" | "error";
  error?: string;
  preview?: string;
}

export function useUploadQueue(taskId: string | null) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const qc = useQueryClient();

  useEffect(
    () => () => items.forEach((i) => i.preview && URL.revokeObjectURL(i.preview)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const patch = (id: string, p: Partial<UploadItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i)));

  const enqueue = useCallback(
    async (kind: AssetKind, files: File[], opts?: { slotId?: string; taskIdOverride?: string }) => {
      const tid = opts?.taskIdOverride ?? taskId;
      if (!tid) return { ok: 0, failed: files.length };
      const entries = files.map((f) => ({
        file: f,
        item: {
          id: crypto.randomUUID(),
          name: f.name,
          size: f.size,
          progress: 0,
          stage: "queued" as const,
          ...(f.type.startsWith("image/") ? { preview: URL.createObjectURL(f) } : {}),
        },
      }));
      setItems((prev) => [...entries.map((e) => e.item), ...prev]);
      let ok = 0;
      // Sequential: keeps slot numbering in the order files were picked.
      for (const { file, item } of entries) {
        try {
          await uploadAsset({
            taskId: tid,
            kind,
            file,
            ...(opts?.slotId ? { slotId: opts.slotId } : {}),
            onProgress: (progress, stage) => patch(item.id, { progress, stage }),
          });
          ok++;
        } catch (e) {
          patch(item.id, { stage: "error", error: e instanceof Error ? e.message : "Ошибка" });
        }
      }
      qc.invalidateQueries({ queryKey: qk.task(tid) });
      return { ok, failed: entries.length - ok };
    },
    [taskId, qc],
  );

  const clearDone = () => setItems((prev) => prev.filter((i) => i.stage !== "done"));
  return { items, enqueue, clearDone };
}

const STAGE_LABEL: Record<UploadItem["stage"], string> = {
  queued: "В очереди",
  slot: "Создаём слот…",
  upload: "Загрузка",
  register: "Регистрируем версию…",
  done: "Загружено",
  error: "Ошибка",
};

export function UploadQueueList({ items }: { items: UploadItem[] }) {
  if (!items.length) return null;
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.id} className="flex items-center gap-3 rounded-md border bg-card p-2">
          {i.preview ? (
            <img src={i.preview} alt="" className="size-10 shrink-0 rounded object-cover" />
          ) : (
            <span className="flex size-10 shrink-0 items-center justify-center rounded bg-muted">
              <FileIcon className="size-4 text-muted-foreground" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-medium">{i.name}</span>
              <span className="shrink-0 text-muted-foreground">{formatBytes(i.size)}</span>
            </div>
            {i.stage === "error" ? (
              <p className="mt-1 text-xs text-tone-danger">{i.error}</p>
            ) : (
              <div className="mt-1 flex items-center gap-2">
                <Progress value={i.stage === "queued" || i.stage === "slot" ? 0 : i.progress} className="h-1.5" />
                <span className="w-32 shrink-0 text-right text-[11px] text-muted-foreground tabular">
                  {STAGE_LABEL[i.stage]}
                  {i.stage === "upload" ? ` ${i.progress}%` : ""}
                </span>
              </div>
            )}
          </div>
          {i.stage === "done" ? (
            <CheckCircle2 className="size-4 shrink-0 text-tone-success" />
          ) : i.stage === "error" ? (
            <XCircle className="size-4 shrink-0 text-tone-danger" />
          ) : (
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
          )}
        </li>
      ))}
    </ul>
  );
}