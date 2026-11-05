import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertHelpReleaseAccess, shouldReleaseArticle } from "./help-release";
import { loadHelpAccessInput } from "./help-access.server";

export const releaseOfficialHelp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertHelpReleaseAccess(await loadHelpAccessInput(context.supabase, context.userId));
    const { default: catalogue } = await import("./official-catalogue.json");
    const { data: existing, error: readError } = await context.supabase
      .from("help_articles")
      .select("module_key, slug, version");
    if (readError) throw new Error("Não foi possível conferir as versões da Ajuda.");
    const versions = new Map((existing ?? []).map((a) => [`${a.module_key}/${a.slug}`, a]));
    const updates = catalogue.filter((a) =>
      shouldReleaseArticle(versions.get(`${a.module_key}/${a.slug}`), a),
    );
    let applied = 0;
    for (let i = 0; i < updates.length; i += 20) {
      const batch = updates.slice(i, i + 20).map((a) => ({ ...a, updated_by: context.userId }));
      const { data, error } = await context.supabase
        .from("help_articles")
        .upsert(batch, { onConflict: "module_key,slug" })
        .select("module_key,slug,version");
      if (error || data?.length !== batch.length)
        throw new Error(
          `Atualização interrompida após ${applied} artigos. Tente novamente; as versões aplicadas serão preservadas.`,
        );
      applied += data.length;
    }
    return { applied, preserved: catalogue.length - updates.length, total: catalogue.length };
  });
