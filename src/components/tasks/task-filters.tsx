import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/lib/labels";
import { PRIORITIES, TASK_STATUSES, type Category, type Profile } from "@/lib/types";
import type { TaskFilters } from "@/lib/filters";
import { personName } from "@/lib/format";

const ALL = "__all";

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value?: string | undefined;
  onChange: (v: string | undefined) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? undefined : v)}>
      <SelectTrigger className="h-8 w-full text-xs sm:w-40">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TaskFiltersBar({
  filters,
  onChange,
  categories,
  profiles,
  showStatus,
}: {
  filters: TaskFilters;
  onChange: (patch: Partial<TaskFilters>) => void;
  categories: Category[];
  profiles: Profile[];
  showStatus: boolean;
}) {
  const initiators = profiles.filter((p) => ["sales_manager", "sales_head", "production_head"].includes(p.role));
  const executors = profiles.filter((p) => ["creator", "stylist", "designer"].includes(p.role));
  const hasAny =
    filters.number || filters.ld || filters.category || filters.status || filters.initiator ||
    filters.executor || filters.priority || filters.deadline;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-28">
        <Search className="pointer-events-none absolute left-2 top-2 size-4 text-muted-foreground" />
        <Input
          className="h-8 pl-7 text-xs"
          placeholder="№"
          inputMode="numeric"
          value={filters.number ?? ""}
          onChange={(e) => onChange({ number: e.target.value || undefined })}
        />
      </div>
      <Input
        className="h-8 w-full text-xs sm:w-36"
        placeholder="LD артикул"
        value={filters.ld ?? ""}
        onChange={(e) => onChange({ ld: e.target.value || undefined })}
      />
      <FilterSelect
        placeholder="Все категории"
        value={filters.category}
        onChange={(v) => onChange({ category: v })}
        options={categories.map((c) => ({ value: c.id, label: c.name }))}
      />
      {showStatus && (
        <FilterSelect
          placeholder="Все статусы"
          value={filters.status}
          onChange={(v) => onChange({ status: v as TaskFilters["status"] })}
          options={TASK_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
        />
      )}
      <FilterSelect
        placeholder="Любой инициатор"
        value={filters.initiator}
        onChange={(v) => onChange({ initiator: v })}
        options={initiators.map((p) => ({ value: p.id, label: personName(p) }))}
      />
      <FilterSelect
        placeholder="Любой исполнитель"
        value={filters.executor}
        onChange={(v) => onChange({ executor: v })}
        options={executors.map((p) => ({ value: p.id, label: personName(p) }))}
      />
      <FilterSelect
        placeholder="Любой приоритет"
        value={filters.priority}
        onChange={(v) => onChange({ priority: v as TaskFilters["priority"] })}
        options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
      />
      <FilterSelect
        placeholder="Любой дедлайн"
        value={filters.deadline}
        onChange={(v) => onChange({ deadline: v as TaskFilters["deadline"] })}
        options={[
          { value: "overdue", label: "Просрочено" },
          { value: "today", label: "До конца дня" },
          { value: "week", label: "В течение 7 дней" },
          { value: "none", label: "Без дедлайна" },
        ]}
      />
      <div className="flex items-center gap-2 px-1">
        <Switch id="closed" checked={!!filters.showClosed} onCheckedChange={(v) => onChange({ showClosed: v || undefined })} />
        <Label htmlFor="closed" className="text-xs text-muted-foreground">Закрытые</Label>
      </div>
      {hasAny && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={() =>
            onChange({
              number: undefined, ld: undefined, category: undefined, status: undefined,
              initiator: undefined, executor: undefined, priority: undefined, deadline: undefined,
            })
          }
        >
          <X /> Сбросить
        </Button>
      )}
    </div>
  );
}