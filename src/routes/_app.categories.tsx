import { createFileRoute } from "@tanstack/react-router";
import { EmptyState, PageHeader } from "@/components/common";

export const Route = createFileRoute("/_app/categories")({
  head: () => ({
    meta: [
      { title: "Категории и нормативы — Контент-продакшн CRM" },
      { name: "description", content: "Категории и нормативы контент-продакшна." },
      { property: "og:title", content: "Категории и нормативы — Контент-продакшн CRM" },
      { property: "og:description", content: "Категории и нормативы контент-продакшна." },
    ],
  }),
  component: () => (
    <div className="space-y-4">
      <PageHeader title="Категории и нормативы" />
      <EmptyState title="Раздел в разработке" description="Этот раздел будет добавлен следующим шагом." />
    </div>
  ),
});