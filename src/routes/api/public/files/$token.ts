import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/files/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = params.token;
        if (!token || token.length < 16) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row } = await supabaseAdmin
          .from("user_files")
          .select("storage_path, name, is_public, mime_type")
          .eq("public_token", token)
          .maybeSingle();
        if (!row || !row.is_public) return new Response("Not found", { status: 404 });
        const { data: signed, error } = await supabaseAdmin.storage
          .from("user-files")
          .createSignedUrl(row.storage_path, 60);
        if (error || !signed) return new Response("Not found", { status: 404 });
        return Response.redirect(signed.signedUrl, 302);
      },
    },
  },
});
