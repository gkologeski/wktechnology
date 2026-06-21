import { createFileRoute } from "@tanstack/react-router";
import { LandingPageEditor } from "@/components/landing-pages/editor";

export const Route = createFileRoute("/_authenticated/landing-pages/$id")({
  component: EditorRoute,
});

function EditorRoute() {
  const { id } = Route.useParams();
  return <LandingPageEditor id={id} />;
}
