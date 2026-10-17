// Single-host: sempre aterrissa na ERP Home unificada; o usuário escolhe
// o módulo pelo grid ou pelo ModuleSwitcher.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "TechERP | WK Technology" }, { name: "description", content: "Acesso ao TechERP da WK Technology." }, { property: "og:title", content: "TechERP | WK Technology" }, { property: "og:description", content: "Acesso ao TechERP da WK Technology." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  beforeLoad: () => {
    throw redirect({ to: "/home" });
  },
});
