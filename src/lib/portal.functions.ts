import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomBytes } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

// ============= ADMIN (autenticado) =============
// portal_token é column-revoked do papel `authenticated`. Estas funções usam
// supabaseAdmin e filtram por owner_id = userId para garantir que apenas o
// dono do workspace gerencie tokens dos próprios contatos.

async function assertContactOwned(contactId: string, workspaceId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("contacts")
    .select("id")
    .eq("id", contactId)
    .eq("owner_id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Contato não encontrado.");
}

export const listPortalContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data, error } = await supabaseAdmin
      .from("contacts")
      .select("id, first_name, last_name, email, portal_enabled, portal_token")
      .eq("owner_id", workspaceId)
      .order("first_name", { ascending: true })
      .limit(1000);
    if (error) throw error;
    return data ?? [];
  });

export const togglePortalAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        contactId: z.string().uuid(),
        enabled: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertContactOwned(data.contactId, userId);
    const patch: { portal_enabled: boolean; portal_token?: string } = {
      portal_enabled: data.enabled,
    };
    if (data.enabled) {
      const { data: current } = await supabaseAdmin
        .from("contacts")
        .select("portal_token")
        .eq("id", data.contactId)
        .maybeSingle();
      if (!current?.portal_token) {
        patch.portal_token = randomBytes(24).toString("hex");
      }
    }
    const { error } = await supabaseAdmin
      .from("contacts")
      .update(patch)
      .eq("id", data.contactId)
      .eq("owner_id", workspaceId);
    if (error) throw error;
    return { ok: true };
  });

export const regeneratePortalToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ contactId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertContactOwned(data.contactId, userId);
    const token = randomBytes(24).toString("hex");
    const { error } = await supabaseAdmin
      .from("contacts")
      .update({ portal_token: token, portal_enabled: true })
      .eq("id", data.contactId)
      .eq("owner_id", workspaceId);
    if (error) throw error;
    return { token };
  });

// ============= PÚBLICO (token, sem auth) =============

const tokenSchema = z.string().min(16).max(128);

async function loadContactByToken(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("contacts")
    .select("id, first_name, last_name, email, owner_id, portal_enabled")
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
    const { data: ticket, error } = await supabaseAdmin
      .from("tickets")
      .insert({
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
