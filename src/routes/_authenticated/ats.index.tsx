import { createFileRoute, redirect } from "@tanstack/react-router";

// Redirect legado: o módulo ATS agora vive sem prefixo /ats (servido pelo host
// ats.wktechnology.com.br). Mantemos o redirect para preservar bookmarks.
export const Route = createFileRoute("/_authenticated/ats/")({
  beforeLoad: () => {
    throw redirect({ to: "/jobs" });
  },
});
