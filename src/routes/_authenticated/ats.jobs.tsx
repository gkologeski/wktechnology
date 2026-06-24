import { createFileRoute, redirect } from "@tanstack/react-router";

// Redirect legado /ats/jobs -> /jobs (ATS agora servido sem prefixo).
export const Route = createFileRoute("/_authenticated/ats/jobs")({
  beforeLoad: () => {
    throw redirect({ to: "/jobs" });
  },
});
