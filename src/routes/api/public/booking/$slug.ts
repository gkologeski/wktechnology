import { createFileRoute } from "@tanstack/react-router";
import { getBookingPageBySlug, computeAvailableSlots } from "@/lib/booking/engine.server";

export const Route = createFileRoute("/api/public/booking/$slug")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }),
      GET: async ({ request, params }) => {
        const page = await getBookingPageBySlug(params.slug);
        if (!page) {
          return Response.json({ error: "not_found" }, { status: 404, headers: cors() });
        }
        const url = new URL(request.url);
        const from = url.searchParams.get("from") ?? new Date().toISOString();
        const to = url.searchParams.get("to") ?? new Date(Date.now() + 14 * 86400_000).toISOString();
        const slots = await computeAvailableSlots(page, from, to);
        return Response.json({
          page: {
            slug: page.slug,
            title: page.title,
            description: page.description,
            duration_minutes: page.duration_minutes,
            timezone: page.timezone,
            color: page.color,
            location: page.location,
          },
          slots,
        }, { headers: cors() });
      },
    },
  },
});

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}
