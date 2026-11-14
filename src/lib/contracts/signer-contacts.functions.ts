import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  assertAnyPermission,
  assertPermission,
  getActiveWorkspaceId,
} from "@/lib/access-control/enforce.server";
import { assertNotReadOnlyView } from "@/lib/view-as-guard.server";
import { emailSchema } from "@/lib/email-schema";
const keys = (action: string) =>
  ["own", "team", "workspace"].map((s) => `techsales.contacts.${action}.${s}`);
export const searchSignerContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ query: z.string().trim().min(2).max(100) }))
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(
      context.supabase,
      context.userId,
      w,
      "techcontracts.signature_evidence.manage.workspace",
    );
    await assertAnyPermission(context.supabase, context.userId, w, keys("view"));
    const tokens = data.query
      .replace(/[^\p{L}\p{N}@. _+-]/gu, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!tokens.length) return [];
    let q = context.supabase
      .from("contacts")
      .select("id,first_name,last_name,email")
      .eq("workspace_id", w)
      .is("deleted_at", null);
    for (const token of tokens)
      q = q.or(["first_name", "last_name", "email"].map((c) => `${c}.ilike.%${token}%`).join(","));
    const { data: rows, error } = await q.order("first_name").limit(20);
    if (error) throw new Error("Não foi possível pesquisar os contatos.");
    return (rows ?? []).map((r) => ({
      id: r.id,
      name: [r.first_name, r.last_name].filter(Boolean).join(" "),
      email: r.email ?? "",
    }));
  });
export const createSignerContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ name: z.string().trim().min(2).max(255), email: emailSchema(255) }))
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertNotReadOnlyView(context.supabase);
    await assertPermission(
      context.supabase,
      context.userId,
      w,
      "techcontracts.signature_evidence.manage.workspace",
    );
    await assertAnyPermission(context.supabase, context.userId, w, keys("create"));
    await assertAnyPermission(context.supabase, context.userId, w, keys("view"));
    // User client retains all contact RLS, duplicate and field guards. No service-role writer.
    const [first, ...rest] = data.name.split(/\s+/);
    const { data: row, error } = await context.supabase
      .from("contacts")
      .insert({
        workspace_id: w,
        owner_id: context.userId,
        first_name: first,
        last_name: rest.join(" ") || null,
        email: data.email,
      })
      .select("id,first_name,last_name,email")
      .single();
    if (error || !row)
      throw new Error(
        error?.code === "23505"
          ? "Contato já existente. Pesquise e selecione o cadastro."
          : "Não foi possível criar o contato. Confira seus acessos e os dados.",
      );
    return {
      id: row.id,
      name: [row.first_name, row.last_name].filter(Boolean).join(" "),
      email: row.email ?? "",
    };
  });
