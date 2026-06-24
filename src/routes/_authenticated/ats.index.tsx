import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/ats/")({
  beforeLoad: () => {
    throw redirect({ to: "/ats/jobs" });
  },
});
