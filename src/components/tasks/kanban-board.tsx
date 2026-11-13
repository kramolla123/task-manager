import { Link } from "@tanstack/react-router";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_LABELS, STATUS_TONES } from "@/lib/labels";
import { isOverdue } from "@/lib/format";
import { needsMyAction } from "@/lib/permissions";
import type { Profile, Task, TaskStatus } from "@/lib/types";
import { Avatar, DeadlineLabel, PriorityDot } from "@/components/common";

const TONE_BAR: Record<string, string> = {
  neutral: "bg-tone-neutral",
  info: "bg-tone-info",
  progress: "bg-tone-progress",
  warn: "bg-tone-warn",
  success: "bg-tone-success",
  danger: "bg-tone-danger",
  design: "bg-tone-design",
};

export function KanbanBoard({
  tasks,
  statuses,
  me,
}: {
  tasks: Task[];
  statuses: readonly TaskStatus[];
  me: Profile;
}) {
  return (
    <div className="scrollbar-thin -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 md:-mx-8 md:px-8">
      {statuses.map((status) => {
        const col = tasks.filter((t) => t.status === status);
        const overdue = col.filter((t) => isOverdue(t)).length;
        return (
          <section key={status} className="flex w-72 shrink-0 flex-col rounded-lg bg-column">
            <header className="flex items-center gap-2 px-3 pb-2 pt-3">
              <span className={cn("size-2 rounded-full", TONE_BAR[STATUS_TONES[status]])} />
              <h3 className="text-xs font-semibold uppercase tracking-wide">{STATUS_LABELS[status]}</h3>
              <span className="text-xs text-muted-foreground tabular">{col.length}</span>
              {overdue > 0 && (
                <span className="ml-auto rounded bg-tone-danger/10 px-1.5 text-[11px] font-medium text-tone-danger">
                  {overdue} просроч.
                </span>
              )}
            </header>
            <div className="flex max-h-[calc(100vh-15rem)] min-h-24 flex-col gap-2 overflow-y-auto px-2 pb-2">
              {col.length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">Пусто</p>
              )}
              {col.map((t) => (
                <TaskCard key={t.id} task={t} me={me} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TaskCard({ task, me }: { task: Task; me: Profile }) {
  const overdue = isOverdue(task);
  const mine = needsMyAction(task, me);
  const people = [task.creator, task.stylist, task.designer].filter(Boolean) as Profile[];
  return (
    <Link
      to="/tasks/$taskId"
      params={{ taskId: task.id }}
      className={cn(
        "group block rounded-md border bg-card p-3 text-sm shadow-xs transition-all hover:border-primary/50 hover:shadow-sm",
        overdue && "border-l-2 border-l-tone-danger",
        mine && "ring-1 ring-primary/40",
      )}
    >
      <div className="flex items-center gap-2">
        <PriorityDot priority={task.priority} />
        <span className="font-mono text-xs text-muted-foreground">№{task.number}</span>
        {mine && (
          <span className="ml-auto inline-flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
            <Zap className="size-3" /> Ваш ход
          </span>
        )}
      </div>
      <p className="mt-1.5 line-clamp-1 font-medium">{task.ld_article || "Без артикула"}</p>
      <p className="line-clamp-1 text-xs text-muted-foreground">{task.category?.name ?? "—"}</p>
      {task.description && (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
      )}
      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <DeadlineLabel task={task} compact />
        <div className="flex -space-x-1.5">
          {people.map((p) => (
            <Avatar key={p.id} person={p} />
          ))}
        </div>
      </div>
      {(task.current_cycle > 1 || task.design_cycle > 1) && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {task.current_cycle > 1 && `AI цикл ${task.current_cycle}`}
          {task.current_cycle > 1 && task.design_cycle > 1 && " · "}
          {task.design_cycle > 1 && `дизайн цикл ${task.design_cycle}`}
        </p>
      )}
    </Link>
  );
}