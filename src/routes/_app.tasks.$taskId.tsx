import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTask } from "@/hooks/use-data";
import { DeadlineLabel, EmptyState, ErrorState, LoadingState, PageHeader, PersonChip, PriorityBadge, StatusBadge } from "@/components/common";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/_app/tasks/$taskId")({
  head: () => ({
    meta: [
      { title: "Заявка — Контент-продакшн CRM" },
      { name: "description", content: "Карточка заявки на AI-контент." },
      { property: "og:title", content: "Заявка — Контент-продакшн CRM" },
      { property: "og:description", content: "Карточка заявки на AI-контент." },
    ],
  }),
  component: TaskPage,
});

function TaskPage() {
  const { taskId } = Route.useParams();
  const { task, isPending, error, refetch } = useTask(taskId);
  if (isPending) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!task) return <EmptyState title="Заявка не найдена или нет доступа" />;
  const rows: [string, React.ReactNode][] = [
    ["Категория", task.category?.name ?? "—"],
    ["LD артикул", task.ld_article || "—"],
    ["Приоритет", <PriorityBadge priority={task.priority} />],
    ["Кол-во фото", task.requested_photos],
    ["Ссылка на товар", task.product_url ? <a className="text-primary underline" href={task.product_url} target="_blank" rel="noreferrer">{task.product_url}</a> : "—"],
    ["Источник", task.source_url ? <a className="text-primary underline" href={task.source_url} target="_blank" rel="noreferrer">{task.source_url}</a> : "—"],
    ["Инициатор", <PersonChip person={task.initiator} />],
    ["Креатор", <PersonChip person={task.creator} />],
    ["Стилист", <PersonChip person={task.stylist} />],
    ["Дизайнер", <PersonChip person={task.designer} />],
    ["Создана", fmtDateTime(task.created_at)],
    ["Дедлайн", <DeadlineLabel task={task} />],
  ];
  return (
    <div className="space-y-4">
      <Link to="/tasks" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> К заявкам</Link>
      <PageHeader title={`Заявка №${task.number}`} actions={<StatusBadge status={task.status} />} />
      <dl className="grid gap-x-6 gap-y-3 rounded-lg border bg-card p-5 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="min-w-0"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="truncate text-sm">{v}</dd></div>
        ))}
        {task.description && <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Описание</dt><dd className="whitespace-pre-wrap text-sm">{task.description}</dd></div>}
      </dl>
    </div>
  );
}