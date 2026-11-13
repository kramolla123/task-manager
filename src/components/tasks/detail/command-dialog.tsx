import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

export type FieldValue = string | boolean;
export type Values = Record<string, FieldValue>;

export interface Field {
  name: string;
  label: string;
  type: "text" | "textarea" | "number" | "url" | "select" | "switch" | "datetime";
  required?: boolean;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  hint?: string;
  defaultValue?: FieldValue;
  showIf?: (v: Values) => boolean;
}

export const NONE = "__none";

export function CommandDialog({
  open,
  onOpenChange,
  title,
  description,
  fields = [],
  submitLabel = "Подтвердить",
  destructive,
  onSubmit,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: React.ReactNode;
  fields?: Field[];
  submitLabel?: string;
  destructive?: boolean;
  onSubmit: (values: Values) => Promise<unknown>;
  children?: React.ReactNode;
}) {
  const init = () =>
    Object.fromEntries(
      fields.map((f) => [f.name, f.defaultValue ?? (f.type === "switch" ? false : f.type === "select" ? NONE : "")]),
    ) as Values;
  const [values, setValues] = useState<Values>(init);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setValues(init());
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const visible = fields.filter((f) => !f.showIf || f.showIf(values));

  async function submit(e: FormEvent) {
    e.preventDefault();
    for (const f of visible) {
      const v = values[f.name];
      if (f.required && (v === "" || v === NONE)) return setError(`Заполните поле «${f.label}»`);
      if (f.type === "number" && v !== "") {
        const n = Number(v);
        if (Number.isNaN(n)) return setError(`«${f.label}» — должно быть число`);
        if (f.min !== undefined && n < f.min) return setError(`«${f.label}» — не меньше ${f.min}`);
        if (f.max !== undefined && n > f.max) return setError(`«${f.label}» — не больше ${f.max}`);
      }
      if (f.type === "url" && typeof v === "string" && v && !/^https?:\/\//i.test(v))
        return setError(`«${f.label}» — ссылка должна начинаться с http(s)://`);
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(values);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  const set = (k: string, v: FieldValue) => setValues((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription asChild><div>{description}</div></DialogDescription>}
          </DialogHeader>
          {children}
          {visible.map((f) => (
            <div key={f.name} className="space-y-1.5">
              {f.type === "switch" ? (
                <div className="flex items-center gap-3">
                  <Switch id={f.name} checked={!!values[f.name]} onCheckedChange={(v) => set(f.name, v)} />
                  <Label htmlFor={f.name}>{f.label}</Label>
                </div>
              ) : (
                <>
                  <Label htmlFor={f.name}>
                    {f.label}
                    {f.required && " *"}
                  </Label>
                  {f.type === "textarea" ? (
                    <Textarea id={f.name} rows={3} placeholder={f.placeholder} value={String(values[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value)} />
                  ) : f.type === "select" ? (
                    <Select value={String(values[f.name] ?? NONE)} onValueChange={(v) => set(f.name, v)}>
                      <SelectTrigger id={f.name}><SelectValue placeholder={f.placeholder ?? "Не выбрано"} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>{f.placeholder ?? "Не выбрано"}</SelectItem>
                        {f.options?.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={f.name}
                      type={f.type === "datetime" ? "datetime-local" : f.type}
                      min={f.min}
                      max={f.max}
                      step={f.step}
                      placeholder={f.placeholder}
                      value={String(values[f.name] ?? "")}
                      onChange={(e) => set(f.name, e.target.value)}
                    />
                  )}
                </>
              )}
              {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
            </div>
          ))}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Отмена
            </Button>
            <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export const val = {
  str: (v: FieldValue | undefined) => (typeof v === "string" && v !== NONE ? v.trim() : ""),
  opt: (v: FieldValue | undefined) => {
    const s = typeof v === "string" && v !== NONE ? v.trim() : "";
    return s || undefined;
  },
  num: (v: FieldValue | undefined) => (v === "" || v === undefined ? undefined : Number(v)),
  iso: (v: FieldValue | undefined) => (typeof v === "string" && v ? new Date(v).toISOString() : undefined),
};