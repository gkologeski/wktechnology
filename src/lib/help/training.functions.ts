// Server functions das trilhas de treinamento (Ajuda Fase 3).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { filterReadableArticles, loadHelpAccessInput } from "@/lib/help/help-access.server";
import { assertTrainingAccess, canUseTraining, scoreQuiz } from "@/lib/help/training-access";
import { findTrack, TRAINING_TRACKS } from "@/lib/help/training-catalogue";

export const getTrainingOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = await loadHelpAccessInput(context.supabase, context.userId);
    const tracks = TRAINING_TRACKS.filter((t) => canUseTraining(t.module, access));
    if (tracks.length === 0) return { tracks: [] };
    const modules = tracks.map((t) => t.module);
    const [arts, prog, quiz] = await Promise.all([
      context.supabase
        .from("help_articles")
        .select("module_key, slug, min_permission, is_published, audience")
        .in("module_key", modules)
        .eq("is_published", true),
      context.supabase.from("help_progress").select("module_key, slug").eq("user_id", context.userId),
      context.supabase
        .from("help_quiz_attempts")
        .select("module_key, passed")
        .eq("user_id", context.userId)
        .eq("passed", true),
    ]);
    if (arts.error || prog.error || quiz.error)
      throw new Error("Não foi possível carregar as trilhas.");
    const readable = filterReadableArticles(arts.data ?? [], access);
    const done = new Set((prog.data ?? []).map((p) => `${p.module_key}/${p.slug}`));
    const passed = new Set((quiz.data ?? []).map((q) => q.module_key));
    return {
      tracks: tracks.map((t) => {
        const slugs = t.slugs.filter((s) =>
          readable.some((a) => a.module_key === t.module && a.slug === s),
        );
        const read = slugs.filter((s) => done.has(`${t.module}/${s}`)).length;
        const quizPassed = passed.has(t.module);
        return {
          id: t.id,
          module: t.module,
          role: t.role,
          title: t.title,
          description: t.description,
          total: slugs.length,
          read,
          quizPassed,
          badge: quizPassed && slugs.length > 0 && read === slugs.length,
        };
      }),
    };
  });

export const getTrainingTrack = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ track: z.string().max(40) }).parse(i))
  .handler(async ({ data, context }) => {
    const track = findTrack(data.track);
    if (!track) return { allowed: false as const };
    const access = await loadHelpAccessInput(context.supabase, context.userId);
    if (!canUseTraining(track.module, access)) return { allowed: false as const };
    const [arts, prog, quiz] = await Promise.all([
      context.supabase
        .from("help_articles")
        .select("module_key, slug, title, summary, min_permission, is_published, audience")
        .eq("module_key", track.module)
        .in("slug", track.slugs)
        .eq("is_published", true),
      context.supabase
        .from("help_progress")
        .select("slug")
        .eq("user_id", context.userId)
        .eq("module_key", track.module),
      context.supabase
        .from("help_quiz_attempts")
        .select("score, total, passed, created_at")
        .eq("user_id", context.userId)
        .eq("module_key", track.module)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);
    if (arts.error || prog.error || quiz.error) throw new Error("Não foi possível carregar a trilha.");
    const readable = filterReadableArticles(arts.data ?? [], access);
    const done = new Set((prog.data ?? []).map((p) => p.slug));
    const { publicQuiz } = await import("@/lib/help/training-quiz.server");
    const articles = track.slugs
      .map((s) => readable.find((a) => a.slug === s))
      .filter((a): a is NonNullable<typeof a> => !!a)
      .map((a) => ({ slug: a.slug, title: a.title, summary: a.summary, read: done.has(a.slug) }));
    const attempts = quiz.data ?? [];
    const quizPassed = attempts.some((a) => a.passed);
    return {
      allowed: true as const,
      track: { id: track.id, module: track.module, role: track.role, title: track.title, description: track.description },
      articles,
      quiz: publicQuiz(track.module),
      attempts,
      quizPassed,
      badge: quizPassed && articles.length > 0 && articles.every((a) => a.read),
    };
  });

export const setTrainingArticleRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ module: z.string().max(40), slug: z.string().max(120), read: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const access = await loadHelpAccessInput(context.supabase, context.userId);
    assertTrainingAccess(data.module, access);
    if (!data.read) {
      const { error } = await context.supabase
        .from("help_progress")
        .delete()
        .eq("user_id", context.userId)
        .eq("module_key", data.module)
        .eq("slug", data.slug);
      if (error) throw new Error("Não foi possível atualizar o progresso.");
      return { ok: true };
    }
    const { data: art } = await context.supabase
      .from("help_articles")
      .select("module_key, slug, min_permission, is_published, audience")
      .eq("module_key", data.module)
      .eq("slug", data.slug)
      .maybeSingle();
    if (!art || filterReadableArticles([art], access).length === 0)
      throw new Error("Artigo indisponível.");
    const { error } = await context.supabase
      .from("help_progress")
      .upsert(
        { user_id: context.userId, module_key: data.module, slug: data.slug },
        { onConflict: "user_id,module_key,slug", ignoreDuplicates: true },
      );
    if (error) throw new Error("Não foi possível registrar a leitura.");
    return { ok: true };
  });

export const submitTrainingQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({ track: z.string().max(40), answers: z.array(z.number().int().min(0).max(9)).max(20) })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const track = findTrack(data.track);
    if (!track) throw new Error("Trilha inexistente.");
    const access = await loadHelpAccessInput(context.supabase, context.userId);
    assertTrainingAccess(track.module, access);
    const { QUIZZES } = await import("@/lib/help/training-quiz.server");
    const questions = QUIZZES[track.module] ?? [];
    if (questions.length === 0) throw new Error("Este módulo não tem quiz.");
    const result = scoreQuiz(
      data.answers,
      questions.map((q) => q.answer),
    );
    // Nota calculada aqui; a tabela não aceita gravação direta do usuário.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("help_quiz_attempts").insert({
      user_id: context.userId,
      module_key: track.module,
      ...result,
    });
    if (error) throw new Error("Não foi possível registrar o resultado.");
    return {
      ...result,
      correct: data.answers.map((a, i) => a === questions[i].answer),
    };
  });
