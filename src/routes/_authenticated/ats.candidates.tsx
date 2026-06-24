import { createFileRoute, redirect } from "@tanstack/react-router";

// Redirect legado /ats/candidates -> /candidates.
export const Route = createFileRoute("/_authenticated/ats/candidates")({
  beforeLoad: () => {
    throw redirect({ to: "/candidates" });
  },
});
