// Server functions para documentos de pessoas.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PEOPLE_DOC_STATUSES = ["valid", "expiring", "expired", "missing"] as const;
export type PeopleDocStatus = (typeof PEOPLE_DOC_STATUSES)[number];

export type PeopleDocumentRow = {
  id: string;
  person_id: string;
  doc_type: string;
  doc_number: string | null;
  issued_at: string | null;
  expires_at: string | null;
  file_url: string | null;
  file_name: string | null;
  status: PeopleDocStatus;
  is_sensitive: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const upsertSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  person_id: z.string().uuid(),
  doc_type: z.string().min(1).max(60),
  doc_number: z.string().max(60).nullable().optional(),
  issued_at: z.string().nullable().optional(),
  expires_at: z.string().nullable().optional(),
  file_url: z.string().max(500).nullable().optional(),
  file_name: z.string().max(200).nullable().optional(),
  is_sensitive: z.boolean().default(true),
  notes: z.string().max(2000).nullable().optional(),
});

export const listPersonDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ person_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("people_documents")
      .select(
        "id, person_id, doc_type, doc_number, issued_at, expires_at, file_url, file_name, status, is_sensitive, notes, created_at, updated_at",
      )
      .eq("person_id", data.person_id)
      .order("expires_at", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as PeopleDocumentRow[];
  });

export const upsertPersonDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => upsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Deriva status conforme validade.
    let status: PeopleDocStatus = "valid";
    if (data.expires_at) {
      const exp = new Date(data.expires_at);
      const now = new Date();
      const in30 = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
      if (exp < now) status = "expired";
      else if (exp <= in30) status = "expiring";
    }

    const payload = {
      person_id: data.person_id,
      doc_type: data.doc_type,
      doc_number: data.doc_number ?? null,
      issued_at: data.issued_at || null,
      expires_at: data.expires_at || null,
      file_url: data.file_url && data.file_url !== "" ? data.file_url : null,
      file_name: data.file_name ?? null,
      is_sensitive: data.is_sensitive,
      notes: data.notes ?? null,
      status,
    };

    if (data.id) {
      const { error } = await supabase
        .from("people_documents")
        .update(payload as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    // Buscar owner_id da pessoa (RLS admin-only exige o valor certo).
    const { data: person } = await supabase
      .from("people")
      .select("owner_id")
      .eq("id", data.person_id)
      .maybeSingle();
    if (!person) throw new Error("Pessoa não encontrada");
    const ownerId = (person as { owner_id: string }).owner_id;

    const { data: row, error } = await supabase
      .from("people_documents")
      .insert({ ...payload, owner_id: ownerId, created_by: userId } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

export const deletePersonDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("people_documents")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listPersonTimeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ person_id: z.string().uuid(), limit: z.number().int().min(1).max(200).default(50) })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("people_events")
      .select("id, person_id, event_type, title, description, metadata, actor_id, created_at")
      .eq("person_id", data.person_id)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return (rows ?? []) as Array<{
      id: string;
      person_id: string;
      event_type: string;
      title: string;
      description: string | null;
      metadata: Record<string, string | number | boolean | null>;
      actor_id: string | null;
      created_at: string;
    }>;
  });
