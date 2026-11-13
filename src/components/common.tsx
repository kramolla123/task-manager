import type { ReactNode } from "react";
import { AlertTriangle, Clock, Inbox, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PRIORITY_LABELS, PRIORITY_TONES, STATUS_LABELS, STATUS_TONES } from "@/lib/labels";
import { fmtDateTime, fmtRelative, initials, isOverdue, personName } from "@/lib/format";
import type { Priority, Profile, Task, TaskStatus } from "@/lib/types";

export function StatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  return (
    <Badge variant={STATUS_TONES[status]} className={className}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge variant={PRIORITY_TONES[priority]}>{PRIORITY_LABELS[priority]}</Badge>;
}

export function PriorityDot({ priority }: { priority: Priority }) {
  const cls =
    priority === "High" ? "bg-tone-danger" : priority === "Medium" ? "bg-tone-warn" : "bg-tone-neutral";
  return (
    <span
      title={`Приоритет: ${PRIORITY_LABELS[priority]}`}
      className={cn("inline-block size-2 shrink-0 rounded-full", cls)}
    />
  );
}

export function DeadlineLabel({
  task,
  compact,
}: {
  task: Pick<Task, "status" | "deadline_at">;
  compact?: boolean;
}) {
  if (!task.deadline_at) return <span className="text-muted-foreground">без дедлайна</span>;
  const overdue = isOverdue(task);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 tabular",
        overdue ? "font-medium text-tone-danger" : "text-muted-foreground",
      )}
      title={fmtDateTime(task.deadline_at)}
    >
      {overdue ? <AlertTriangle className="size-3.5" /> : <Clock className="size-3.5" />}
      {compact ? fmtRelative(task.deadline_at) : fmtDateTime(task.deadline_at)}
      {overdue && !compact && " · просрочено"}
    </span>
  );
}

export function Avatar({ person, className }: { person?: Profile | null; className?: string }) {
  return (
    <span
      title={personName(person)}
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-background bg-accent text-[10px] font-semibold text-accent-foreground",
        className,
      )}
    >
      {initials(person)}
    </span>
  );
}

export function PersonChip({ person }: { person?: Profile | null }) {
  if (!person) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Avatar person={person} />
      <span className="truncate">{personName(person)}</span>
    </span>
  );
}

export function LoadingState({ label = "Загрузка…" }: { label?: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center">
      <div className="text-muted-foreground">{icon ?? <Inbox className="size-6" />}</div>
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : String(error ?? "Ошибка");
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border border-tone-danger/30 bg-tone-danger/5 p-6 text-center">
      <AlertTriangle className="size-6 text-tone-danger" />
      <p className="text-sm">{msg}</p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw /> Повторить
        </Button>
      )}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}