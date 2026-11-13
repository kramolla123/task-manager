import { createFileRoute } from "@tanstack/react-router";
import { EmptyState, PageHeader } from "@/components/common";

export const Route = createFileRoute("/_app/employees")({
  head: () => ({
    meta: [
      { title: "Сотрудники — Контент-продакшн CRM" },
      { name: "description", content: "Сотрудники контент-продакшна." },
      { property: "og:title", content: "Сотрудники — Контент-продакшн CRM" },
      { property: "og:description", content: "Сотрудники контент-продакшна." },
    ],
  }),
  component: () => (
    <div className="space-y-4">
      <PageHeader title="Сотрудники" />
      <EmptyState title="Раздел в разработке" description="Этот раздел будет добавлен следующим шагом." />
    </div>
  ),
});