import { createFileRoute } from "@tanstack/react-router";
import { EmptyState, PageHeader } from "@/components/common";

export const Route = createFileRoute("/_app/analytics")({
  head: () => ({
    meta: [
      { title: "Аналитика — Контент-продакшн CRM" },
      { name: "description", content: "Аналитика контент-продакшна." },
      { property: "og:title", content: "Аналитика — Контент-продакшн CRM" },
      { property: "og:description", content: "Аналитика контент-продакшна." },
    ],
  }),
  component: () => (
    <div className="space-y-4">
      <PageHeader title="Аналитика" />
      <EmptyState title="Раздел в разработке" description="Этот раздел будет добавлен следующим шагом." />
    </div>
  ),
});