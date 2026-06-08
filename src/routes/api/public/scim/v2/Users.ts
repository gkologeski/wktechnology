// SCIM 2.0 — /Users endpoint. Auth via Bearer scim_<token>.
import { createFileRoute } from "@tanstack/react-router";
import { authenticateScimRequest, scimError, scimJson } from "@/lib/scim-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function toScimUser(row: any) {
  return {
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
    id: row.id,
    userName: row.email,
    name: { formatted: row.full_name ?? row.email },
    emails: [{ value: row.email, primary: true }],
    active: row.active !== false,
    meta: { resourceType: "User", created: row.created_at, lastModified: row.updated_at ?? row.created_at },
  };
}

export const Route = createFileRoute("/api/public/scim/v2/Users")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateScimRequest(request);
        if (!auth) return scimError(401, "Unauthorized");
        const url = new URL(request.url);
        const startIndex = Math.max(1, parseInt(url.searchParams.get("startIndex") || "1", 10));
        const count = Math.min(200, parseInt(url.searchParams.get("count") || "50", 10));
        const filter = url.searchParams.get("filter");
        let q = supabaseAdmin
          .from("team_members")
          .select("member_user_id, profiles:profiles!team_members_member_user_id_fkey(id, full_name, email), created_at", { count: "exact" })
          .eq("workspace_owner_id", auth.workspaceId)
          .range(startIndex - 1, startIndex - 1 + count - 1);
        if (filter) {
          const m = filter.match(/userName\s+eq\s+"([^"]+)"/i);
          if (m) q = q.eq("profiles.email", m[1]);
        }
        const { data, count: total } = await q;
        const resources = (data ?? []).map((r: any) => toScimUser({
          id: r.member_user_id,
          email: r.profiles?.email,
          full_name: r.profiles?.full_name,
          created_at: r.created_at,
        }));
        return scimJson({
          schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
          totalResults: total ?? resources.length,
          startIndex,
          itemsPerPage: resources.length,
          Resources: resources,
        });
      },
      POST: async ({ request }) => {
        const auth = await authenticateScimRequest(request);
        if (!auth) return scimError(401, "Unauthorized");
        let body: any;
        try { body = await request.json(); } catch { return scimError(400, "Invalid JSON"); }
        const email = body.userName || body.emails?.[0]?.value;
        if (!email) return scimError(400, "userName required");
        const fullName = body.name?.formatted || body.displayName || email;
        // Cria um convite ao workspace; usuário real é criado no aceite.
        const { data, error } = await (supabaseAdmin.from("workspace_invites") as any)
          .insert({ workspace_id: auth.workspaceId, email, role: "member", invited_name: fullName })
          .select("id, email, created_at")
          .maybeSingle();
        if (error) return scimError(409, error.message);
        return scimJson(toScimUser({ id: data.id, email: data.email, full_name: fullName, created_at: data.created_at, active: true }), 201);
      },
    },
  },
});
