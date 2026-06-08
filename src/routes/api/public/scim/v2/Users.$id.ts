// SCIM 2.0 — /Users/{id} endpoint.
import { createFileRoute } from "@tanstack/react-router";
import { authenticateScimRequest, scimError, scimJson } from "@/lib/scim-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/scim/v2/Users/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const auth = await authenticateScimRequest(request);
        if (!auth) return scimError(401, "Unauthorized");
        const { data } = await supabaseAdmin
          .from("team_members")
          .select("member_user_id, created_at, profiles:profiles!team_members_member_user_id_fkey(id, full_name, email)")
          .eq("workspace_owner_id", auth.workspaceId)
          .eq("member_user_id", params.id)
          .maybeSingle();
        if (!data) return scimError(404, "Not found");
        const row: any = data;
        return scimJson({
          schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
          id: row.member_user_id,
          userName: row.profiles?.email,
          name: { formatted: row.profiles?.full_name ?? row.profiles?.email },
          emails: [{ value: row.profiles?.email, primary: true }],
          active: true,
        });
      },
      DELETE: async ({ request, params }) => {
        const auth = await authenticateScimRequest(request);
        if (!auth) return scimError(401, "Unauthorized");
        await supabaseAdmin.from("team_members").delete()
          .eq("workspace_owner_id", auth.workspaceId)
          .eq("member_user_id", params.id);
        await supabaseAdmin.from("workspace_members").delete()
          .eq("workspace_id", auth.workspaceId)
          .eq("user_id", params.id);
        return new Response(null, { status: 204 });
      },
      PATCH: async ({ request, params }) => {
        const auth = await authenticateScimRequest(request);
        if (!auth) return scimError(401, "Unauthorized");
        let body: any;
        try { body = await request.json(); } catch { return scimError(400, "Invalid JSON"); }
        const ops: any[] = body.Operations ?? [];
        const setActive = ops.find((o) => o.path === "active");
        if (setActive && setActive.value === false) {
          await supabaseAdmin.from("team_members").delete()
            .eq("workspace_owner_id", auth.workspaceId)
            .eq("member_user_id", params.id);
        }
        return scimJson({ id: params.id, active: setActive?.value !== false });
      },
    },
  },
});
