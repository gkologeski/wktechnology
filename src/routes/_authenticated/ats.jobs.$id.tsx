import { createFileRoute, redirect } from "@tanstack/react-router";

// Redirect legado /ats/jobs/:id -> /jobs/:id.
export const Route = createFileRoute("/_authenticated/ats/jobs/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/jobs/$id", params: { id: params.id } });
  },
});
