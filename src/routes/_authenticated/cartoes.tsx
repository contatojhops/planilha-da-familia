import { createFileRoute } from "@tanstack/react-router";
import { EmptyState, PageHeader } from "@/components/finance-ui";

export const Route = createFileRoute("/_authenticated/cartoes")({
  head: () => ({
    meta: [
      { title: "Cartões da família — Casa Clara" },
      { name: "description", content: "Cartões do núcleo familiar no Casa Clara, com dados compartilhados entre os membros da família." },
      { property: "og:title", content: "Cartões da família — Casa Clara" },
      { property: "og:description", content: "Cartões do núcleo familiar no Casa Clara." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="space-y-5">
      <PageHeader title="Cartões" description="Módulo em construção" />
      <EmptyState title="Em breve" description="Este módulo será liberado na próxima etapa." />
    </div>
  );
}
