import { createFileRoute } from "@tanstack/react-router";
import { MyBugReportsPage } from "@/components/bug-reports/pages/my-bug-reports-page";

export const Route = createFileRoute("/_authenticated/settings/my-tickets")({
  head: () => ({ meta: [{ title: "Meus chamados" }] }),
  component: MyBugReportsPage,
});
