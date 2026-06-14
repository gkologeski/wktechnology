// Release 16 — Zapier integration server functions (Lovable side).
// Zapier REST hook: o usuário cria um Zap com trigger "New X" e o Zapier
// chama nosso endpoint /api/public/zapier/subscribe para registrar o webhook.
// Aqui no app gerenciamos a lista de subscriptions ativas.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

export const ZAPIER_TRIGGERS = [
  "lead.created",
  "lead.assigned",
  "deal.created",
  "deal.won",
  "deal.lost",
  "ticket.created",
  "contact.created",
  "company.created",
] as const;

export const ZAPIER_ACTIONS = [
  {
    key: "create_contact",
    label: "Criar contato",
    method: "POST",
    path: "/api/public/v1/contacts",
  },
  { key: "create_lead", label: "Criar lead", method: "POST", path: "/api/public/v1/leads" },
  { key: "create_deal", label: "Criar negócio", method: "POST", path: "/api/public/v1/deals" },
] as const;

export const listZapierSubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const { data, error } = await context.supabase
      .from("zapier_subscriptions")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { subscriptions: data ?? [] };
  });

export const deleteZapierSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const { error } = await context.supabase
      .from("zapier_subscriptions")
      .delete()
      .eq("id", data.id)
      .eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
