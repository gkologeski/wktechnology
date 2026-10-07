import { createFileRoute } from "@tanstack/react-router";
import { FormBuilder } from "@/components/surveys/form/form-builder";

export const Route = createFileRoute("/_authenticated/survey-builder/$id")({
  head: () => ({
    meta: [
      { title: "Construtor de pesquisa — TechERP" },
      {
        name: "description",
        content: "Monte perguntas, condições e pontuação opcional da pesquisa.",
      },
      { property: "og:title", content: "Construtor de pesquisa — TechERP" },
      { property: "og:description", content: "Editor de pesquisas com campos personalizáveis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BuilderRoute,
});

function BuilderRoute() {
  const { id } = Route.useParams();
  return <FormBuilder key={id} id={id} />;
}
