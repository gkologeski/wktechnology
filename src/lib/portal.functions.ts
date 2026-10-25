import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSalesPermission } from "@/lib/access-control/sales-permission.middleware";
import { assertSalesRecord } from "@/lib/access-control/sales-core.server";
import { workRpc } from "@/lib/access-control/work-core.server";

// Token ports execute with a NOLOGIN/NOBYPASSRLS role: actual caller rows only.
export const listPortalContacts = createServerFn({ method: "GET" })
  .middleware([requireSalesPermission("system.portal", "manage")])
  .handler(async ({ context }) =>
    workRpc<
      Array<{
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
        portal_enabled: boolean;
        portal_token: string | null;
      }>
    >(context.supabase, "sales_portal_contacts", {}),
  );

export const togglePortalAccess = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.portal", "manage")])
  .inputValidator((input) =>
    z.object({ contactId: z.string().uuid(), enabled: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSalesRecord(context.supabase, "contacts", data.contactId, "update");
    if (data.enabled)
      await workRpc<string>(context.supabase, "sales_public_token", {
        p_table: "contacts",
        p_id: data.contactId,
        p_rotate: false,
        p_purpose: "share",
      });
    const { data: saved, error } = await context.supabase
      .from("contacts")
      .update({ portal_enabled: data.enabled })
      .eq("id", data.contactId)
      .select("id")
      .single();
    if (error || !saved) throw new Error(error?.message ?? "Contato indisponível.");
    return { ok: true };
  });

export const regeneratePortalToken = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.portal", "manage")])
  .inputValidator((input) => z.object({ contactId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => ({
    token: await workRpc<string>(context.supabase, "sales_public_token", {
      p_table: "contacts",
      p_id: data.contactId,
      p_rotate: true,
      p_purpose: "share",
    }),
  }));

// ============= PÚBLICO (token, sem auth) =============

const tokenSchema = z.string().min(16).max(128);

async function loadContactByToken(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("contacts")
    .select("id, workspace_id, first_name, last_name, email, owner_id, portal_enabled")
    .eq("portal_token", token)
    .maybeSingle();
  if (error) throw error;
  if (!data || !data.portal_enabled) throw new Error("Portal indisponível.");
  return data;
}

export const getPortalSession = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ token: tokenSchema }).parse(input))
  .handler(async ({ data }) => {
    const contact = await loadContactByToken(data.token);
    return {
      contact: {
        id: contact.id,
        first_name: contact.first_name,
        last_name: contact.last_name,
        email: contact.email,
      },
    };
  });

export const listPortalTickets = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ token: tokenSchema }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const contact = await loadContactByToken(data.token);
    const { data: tickets, error } = await supabaseAdmin
      .from("tickets")
      .select("id, subject, description, status, priority, created_at, resolved_at, due_at")
      .eq("contact_id", contact.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return tickets ?? [];
  });

export const createPortalTicket = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        token: tokenSchema,
        subject: z.string().min(2).max(200),
        description: z.string().max(5000).optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const contact = await loadContactByToken(data.token);
    if (!contact.workspace_id) throw new Error("Contato sem workspace de origem.");
    const { data: ticket, error } = await supabaseAdmin
      .from("tickets")
      .insert({
        workspace_id: contact.workspace_id,
        owner_id: contact.owner_id,
        contact_id: contact.id,
        subject: data.subject,
        description: data.description ?? null,
        priority: data.priority,
        status: "new",
        source: "portal",
      } as never)
      .select("id")
      .single();
    if (error) throw error;
    return { id: ticket.id };
  });
