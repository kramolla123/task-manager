import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Columns3, Plus, Rows3, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/common";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { TaskTable } from "@/components/tasks/task-table";
import { TaskFiltersBar } from "@/components/tasks/task-filters";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";
import { useRealtimeInvalidate, useTasks } from "@/hooks/use-data";
import { useMe } from "@/hooks/use-auth";
import { applyFilters, type TaskFilters } from "@/lib/filters";
import { canCreateTask, needsMyAction } from "@/lib/permissions";
import { isOverdue } from "@/lib/format";
import { qk } from "@/lib/api";
import { TASK_STATUSES, type TaskStatus } from "@/lib/types";

interface TasksSearch extends Partial<TaskFilters> {
  view?: "kanban" | "table" | undefined;
}

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

export const Route = createFileRoute("/_app/tasks/")({
  head: () => ({
    meta: [
      { title: "Заявки — Контент-продакшн CRM" },
      { name: "description", content: "Канбан и таблица заявок на AI-контент с фильтрами и дедлайнами." },
      { property: "og:title", content: "Заявки — Контент-продакшн CRM" },
      { property: "og:description", content: "Канбан и таблица заявок на AI-контент." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): TasksSearch => ({
    view: s["view"] === "table" ? "table" : undefined,
    scope: s["scope"] === "all" ? "all" : s["scope"] === "mine" ? "mine" : "all",
    number: str(s["number"]),
    ld: str(s["ld"]),
    category: str(s["category"]),
    status: (TASK_STATUSES as readonly string[]).includes(String(s["status"])) ? (s["status"] as TaskStatus) : undefined,
    initiator: str(s["initiator"]),
    executor: str(s["executor"]),
    priority: ["Low", "Medium", "High"].includes(String(s["priority"])) ? (s["priority"] as TaskFilters["priority"]) : undefined,
    deadline: ["overdue", "today", "week", "none"].includes(String(s["deadline"])) ? (s["deadline"] as TaskFilters["deadline"]) : undefined,
    showClosed: s["showClosed"] === true || s["showClosed"] === "true" ? true : undefined,
  }),
  component: TasksPage,
});

function TasksPage() {
  const me = useMe();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/tasks/" });
  const [createOpen, setCreateOpen] = useState(false);
  const { tasks, isPending, error, refetch, profiles, categories } = useTasks();
  useRealtimeInvalidate("tasks-board", "tasks", [qk.tasks]);

  // Default scope: executors see their own work, heads & managers see everything.
  const defaultScope = ["creator", "stylist", "designer"].includes(me.role) ? "mine" : "all";
  const filters: TaskFilters = { ...search, scope: search.scope ?? defaultScope };
  const view = search.view ?? "kanban";

  const update = (patch: Partial<TasksSearch>) =>
    navigate({ search: (prev: TasksSearch) => ({ ...prev, ...patch }), replace: true });

  const filtered = useMemo(() => applyFilters(tasks, filters, me.id), [tasks, JSON.stringify(filters), me.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const myTurn = filtered.filter((t) => needsMyAction(t, me)).length;
  const overdue = filtered.filter((t) => isOverdue(t)).length;

  const statuses = useMemo(() => {
    if (filters["status"]) return [filters["status"]];
    return TASK_STATUSES.filter((s) => (filters["showClosed"] ? true : s !== "completed" && s !== "cancelled"));
  }, [filters["status"], filters["showClosed"]]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Заявки"
        description={
          isPending ? "Загрузка…" : (
            <span className="inline-flex flex-wrap items-center gap-3">
              <span>{filtered.length} из {tasks.length}</span>
              {myTurn > 0 && (
                <span className="inline-flex items-center gap-1 text-primary"><Zap className="size-3.5" /> ваш ход: {myTurn}</span>
              )}
              {overdue > 0 && (
                <button className="inline-flex items-center gap-1 text-tone-danger hover:underline" onClick={() => update({ deadline: "overdue" })}>
                  <AlertTriangle className="size-3.5" /> просрочено: {overdue}
                </button>
              )}
            </span>
          )
        }
        actions={
          <>
            <ToggleGroup type="single" size="sm" variant="outline" value={filters["scope"]} onValueChange={(v) => v && update({ scope: v as "mine" | "all" })}>
              <ToggleGroupItem value="mine" className="px-3 text-xs">Мои</ToggleGroupItem>
              <ToggleGroupItem value="all" className="px-3 text-xs">Все</ToggleGroupItem>
            </ToggleGroup>
            <ToggleGroup type="single" size="sm" variant="outline" value={view} onValueChange={(v) => v && update({ view: v === "table" ? "table" : undefined })}>
              <ToggleGroupItem value="kanban" aria-label="Канбан" title="Канбан"><Columns3 /></ToggleGroupItem>
              <ToggleGroupItem value="table" aria-label="Таблица" title="Таблица"><Rows3 /></ToggleGroupItem>
            </ToggleGroup>
            {canCreateTask(me.role) && (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus /> Новая заявка
              </Button>
            )}
          </>
        }
      />
      <TaskFiltersBar
        filters={filters}
        onChange={update}
        categories={categories.list}
        profiles={profiles.list}
        showStatus
      />
      {isPending ? (
        <LoadingState label="Загружаем заявки…" />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : tasks.length === 0 ? (
        <EmptyState
          title="Заявок пока нет"
          description={canCreateTask(me.role) ? "Создайте первую заявку — она появится в колонке «К выполнению»." : "Как только менеджеры создадут заявки, они появятся здесь."}
          action={canCreateTask(me.role) && <Button size="sm" onClick={() => setCreateOpen(true)}><Plus /> Новая заявка</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="Ничего не найдено" description="Измените фильтры или переключитесь на «Все»." />
      ) : view === "kanban" ? (
        <KanbanBoard tasks={filtered} statuses={statuses} me={me} />
      ) : (
        <TaskTable tasks={filtered} me={me} />
      )}
      <CreateTaskDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}