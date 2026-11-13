import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Контент-продакшн CRM" },
      { name: "description", content: "Заявки на AI-контент: доска, согласование, аналитика." },
      { property: "og:title", content: "Контент-продакшн CRM" },
      { property: "og:description", content: "Заявки на AI-контент: доска, согласование, аналитика." },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/tasks" });
  },
});