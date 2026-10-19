import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const entitySchema = z.enum(["contact", "lead"]);

/** URLs assinadas das fotos dos registros visíveis ao usuário (RLS). */
export const getPersonPhotoUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        contactIds: z.array(z.string().uuid()).max(500),
        leadIds: z.array(z.string().uuid()).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { PERSON_PHOTO_BUCKET } = await import("./person-photo");
    const paths: Array<{ key: string; path: string }> = [];
    for (const [table, entity, ids] of [
      ["contacts", "contact", data.contactIds],
      ["leads", "lead", data.leadIds],
    ] as const) {
      if (!ids.length) continue;
      const { data: rows, error } = await context.supabase
        .from(table)
        .select("id, photo_url")
        .in("id", ids)
        .not("photo_url", "is", null);
      if (error) throw new Error(error.message);
      for (const r of rows ?? []) {
        if (r.photo_url) paths.push({ key: `${entity}:${r.id}`, path: r.photo_url });
      }
    }
    if (!paths.length) return {} as Record<string, string>;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from(PERSON_PHOTO_BUCKET)
      .createSignedUrls(
        paths.map((p) => p.path),
        3600,
      );
    if (error) throw new Error(error.message);
    const out: Record<string, string> = {};
    signed?.forEach((s, i) => {
      if (s.signedUrl) out[paths[i].key] = s.signedUrl;
    });
    return out;
  });

/** Envia (dataUrl) ou remove (null) a foto manual de um Contato/Lead. */
export const setPersonPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        entity: entitySchema,
        id: z.string().uuid(),
        dataUrl: z.string().max(3_000_000).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { PERSON_PHOTO_BUCKET, PERSON_PHOTO_MAX_BYTES, isAcceptedPhotoType, photoPath } =
      await import("./person-photo");
    const table = data.entity === "contact" ? "contacts" : "leads";
    const { data: row, error } = await context.supabase
      .from(table)
      .select("id, workspace_id, photo_url")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row?.workspace_id) throw new Error("Registro não encontrado.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let path: string | null = null;
    if (data.dataUrl) {
      const m = /^data:([^;]+);base64,(.+)$/.exec(data.dataUrl);
      if (!m || !isAcceptedPhotoType(m[1])) throw new Error("Formato de imagem não suportado.");
      const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
      if (bytes.byteLength > PERSON_PHOTO_MAX_BYTES) throw new Error("A imagem passa de 2 MB.");
      path = photoPath(row.workspace_id, data.entity, data.id, "webp");
      // Valida a permissão de edição antes de gravar o arquivo (RLS: 0 linhas = negado).
      const probe = await context.supabase
        .from(table)
        .update({ photo_updated_at: new Date().toISOString() })
        .eq("id", data.id)
        .select("id");
      if (probe.error) throw new Error(probe.error.message);
      if (!probe.data?.length) throw new Error("Você não tem permissão para editar este registro.");
      const up = await supabaseAdmin.storage
        .from(PERSON_PHOTO_BUCKET)
        .upload(path, bytes, { contentType: m[1], upsert: true });
      if (up.error) throw new Error(up.error.message);
    }

    const { data: updated, error: upErr } = await context.supabase
      .from(table)
      .update({
        photo_url: path,
        photo_source: path ? "manual" : null,
        photo_updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("id");
    if (upErr) throw new Error(upErr.message);
    if (!updated?.length) throw new Error("Você não tem permissão para editar este registro.");
    // Só apaga arquivos do próprio registro (fotos herdadas na conversão são compartilhadas).
    if (
      row.photo_url &&
      row.photo_url !== path &&
      row.photo_url.startsWith(`${row.workspace_id}/${data.entity}/${data.id}.`)
    ) {
      await supabaseAdmin.storage.from(PERSON_PHOTO_BUCKET).remove([row.photo_url]);
    }
    return { ok: true, path };
  });
