// SCIM 2.0 — /Groups endpoint (mínimo: lista grupos = user_groups).
import { createFileRoute } from "@tanstack/react-router";
import { authenticateScimRequest, scimError, scimJson } from "@/lib/scim-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/scim/v2/Groups")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateScimRequest(request);
        if (!auth) return scimError(401, "Unauthorized");
        const { data } = await supabaseAdmin
          .from("user_groups")
          .select("id, name, created_at")
          .eq("workspace_id", auth.workspaceId)
          .limit(200);
        const Resources = (data ?? []).map((g: any) => ({
          schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"],
          id: g.id,
          displayName: g.name,
          meta: { resourceType: "Group", created: g.created_at },
        }));
        return scimJson({
          schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
          totalResults: Resources.length,
          startIndex: 1,
          itemsPerPage: Resources.length,
          Resources,
        });
      },
    },
  },
});
