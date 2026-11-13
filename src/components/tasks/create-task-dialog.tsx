import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createTask, qk } from "@/lib/api";
import { PRIORITY_LABELS, ROUTE_LABELS } from "@/lib/labels";
import { PRIORITIES, type Priority } from "@/lib/types";
import { useCategories } from "@/hooks/use-data";
import { FileDropzone, UploadQueueList, useUploadQueue } from "./upload";
import { formatBytes } from "@/lib/format";

const empty = {
  category_id: "",
  product_url: "",
  ld_article: "",
  description: "",
  requested_photos: "4",
  source_url: "",
  priority: "Medium" as Priority,
};

export function CreateTaskDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const categories = useCategories();
  const active = categories.list.filter((c) => c.active);
  const [form, setForm] = useState(empty);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const queue = useUploadQueue(null);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const selected = categories.map.get(form.category_id);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const photos = Number(form.requested_photos);
    if (!form.category_id) return setError("Выберите категорию");
    if (!form.ld_article.trim()) return setError("Укажите LD артикул");
    if (!Number.isInteger(photos) || photos < 1 || photos > 100)
      return setError("Количество фото — целое число от 1 до 100");
    setBusy(true);
    try {
      const task = await createTask({
        category_id: form.category_id,
        product_url: form.product_url.trim(),
        ld_article: form.ld_article.trim(),
        description: form.description.trim(),
        requested_photos: photos,
        source_url: form.source_url.trim(),
        priority: form.priority,
      });
      qc.invalidateQueries({ queryKey: qk.tasks });
      if (files.length) {
        const res = await queue.enqueue("manager_reference", files, { taskIdOverride: task.id });
        if (res.failed) toast.warning(`Заявка создана, но ${res.failed} файл(ов) не загрузились — повторите во вкладке «Материалы»`);
      }
      toast.success(`Заявка №${task.number} создана`);
      setForm(empty);
      setFiles([]);
      onOpenChange(false);
      navigate({ to: "/tasks/$taskId", params: { taskId: task.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать заявку");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b p-5">
          <SheetTitle>Новая заявка</SheetTitle>
          <SheetDescription>
            Номер, дата и дедлайн назначаются автоматически по нормативу категории.
          </SheetDescription>
        </SheetHeader>
        <form id="create-task" onSubmit={onSubmit} className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="space-y-1.5">
            <Label>Категория *</Label>
            <Select value={form.category_id} onValueChange={(v) => set("category_id", v)}>
              <SelectTrigger>
                <SelectValue placeholder={categories.isPending ? "Загрузка…" : "Выберите категорию"} />
              </SelectTrigger>
              <SelectContent>
                {active.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} · {ROUTE_LABELS[c.route]} · {c.deadline_days} дн.
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {categories.error && <p className="text-xs text-tone-danger">{(categories.error as Error).message}</p>}
            {!categories.isPending && !active.length && (
              <p className="text-xs text-muted-foreground">Нет активных категорий — обратитесь к руководителю.</p>
            )}
            {selected?.instructions && (
              <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground whitespace-pre-wrap">
                {selected.instructions}
              </p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ld">LD артикул *</Label>
              <Input id="ld" value={form.ld_article} onChange={(e) => set("ld_article", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="photos">Количество фото *</Label>
              <Input id="photos" type="number" min={1} max={100} value={form.requested_photos} onChange={(e) => set("requested_photos", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="purl">Ссылка на товар</Label>
            <Input id="purl" type="url" placeholder="https://" value={form.product_url} onChange={(e) => set("product_url", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="surl">Источник / референс</Label>
            <Input id="surl" type="url" placeholder="https://" value={form.source_url} onChange={(e) => set("source_url", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Приоритет</Label>
            <Select value={form.priority} onValueChange={(v) => set("priority", v as Priority)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="desc">Описание задачи</Label>
            <Textarea id="desc" rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Референсы менеджера</Label>
            <FileDropzone compact onFiles={(f) => setFiles((prev) => [...prev, ...f])} disabled={busy} hint="Будут загружены после создания заявки" />
            {files.length > 0 && !busy && (
              <ul className="space-y-1">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 rounded border px-2 py-1 text-xs">
                    <span className="truncate">{f.name}</span>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      {formatBytes(f.size)}
                      <button type="button" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}>
                        <X className="size-3.5" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <UploadQueueList items={queue.items} />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </form>
        <SheetFooter className="border-t p-4">
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={busy}>
            Отмена
          </Button>
          <Button type="submit" form="create-task" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} Создать заявку
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}