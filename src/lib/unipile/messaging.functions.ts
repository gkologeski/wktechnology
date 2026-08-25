// Server functions para envio de DM / convite LinkedIn via Unipile.
// Import dinâmico de "*.server" nos handlers.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- helpers ----------

function extractPublicIdentifier(linkedinUrl: string | null | undefined): string | null {
  if (!linkedinUrl) return null;
  const m = linkedinUrl.match(/linkedin\.com\/in\/([^/?#]+)/i);
  return m ? decodeURIComponent(m[1]).replace(/\/$/, "") : null;
}

function firstNameOf(full?: string | null): string {
  if (!full) return "";
  return String(full).trim().split(/\s+/)[0] ?? "";
}

async function renderLinkedinTokens(
  text: string,
  opts: { candidateId?: string | null; profileRaw?: any },
): Promise<string> {
  if (!text || text.indexOf("{{") === -1) return text;
  let candidate: any = null;
  if (opts.candidateId) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("ats_candidates")
      .select("full_name, current_company, headline, email")
      .eq("id", opts.candidateId)
      .maybeSingle();
    candidate = data ?? null;
  }
  // Shape do perfil difere entre v1 e v2 — normalizado no client.
  const { extractProfileFields } = await import("@/lib/unipile/client.server");
  const p = extractProfileFields(opts.profileRaw ?? {});
  const fullName = candidate?.full_name ?? p.fullName ?? "";
  const values: Record<string, string> = {
    first_name: firstNameOf(fullName) || p.firstName || "",
    full_name: fullName || "",
    company: candidate?.current_company ?? p.company ?? "",
    headline: candidate?.headline ?? p.headline ?? "",
    email: candidate?.email ?? "",
  };
  return text.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_m, key) => {
    const v = values[key as string];
    return v == null ? "" : String(v);
  });
}

function idemKey(parts: Array<string | undefined | null>): string {
  return createHash("sha256").update(parts.filter(Boolean).join("|")).digest("hex").slice(0, 40);
}

async function resolveProviderId(
  ctx: any,
  publicIdentifier: string,
): Promise<{ providerId: string | null; raw: any }> {
  const { fetchProfile, extractProfileProviderId } = await import("@/lib/unipile/client.server");
  const profile = (await fetchProfile(ctx, publicIdentifier)) as any;
  return { providerId: extractProfileProviderId(profile), raw: profile };
}

// ---------- send message ----------

const sendMessageInput = z.object({
  candidateId: z.string().uuid().optional(),
  linkedinUrl: z.string().url().optional(),
  publicIdentifier: z.string().min(1).max(200).optional(),
  providerId: z.string().min(1).max(200).optional(),
  text: z.string().min(1).max(8000),
});

export const sendLinkedinMessageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => sendMessageInput.parse(v))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadAccountCtx, sendLinkedinMessage, UnipileError } =
      await import("@/lib/unipile/client.server");

    const ctx = await loadAccountCtx(userId);

    let providerId = data.providerId ?? null;
    let profileRaw: any = null;
    if (!providerId) {
      const publicId = data.publicIdentifier ?? extractPublicIdentifier(data.linkedinUrl ?? null);
      if (!publicId) {
        return {
          ok: false as const,
          error: "Sem identificador do destinatário (linkedinUrl ou providerId).",
        };
      }
      try {
        const resolved = await resolveProviderId(ctx, publicId);
        providerId = resolved.providerId;
        profileRaw = resolved.raw;
      } catch (err) {
        if (err instanceof UnipileError) {
          return { ok: false as const, error: err.message, code: err.code };
        }
        throw err;
      }
      if (!providerId) {
        return { ok: false as const, error: "Não foi possível resolver o provider_id do perfil." };
      }
    }

    const renderedText = await renderLinkedinTokens(data.text, {
      candidateId: data.candidateId ?? null,
      profileRaw,
    });

    const key = idemKey([ctx.accountId, "message", providerId, renderedText]);

    // idempotência: se já foi enviada, retornar sucesso do log anterior
    const { data: existing } = await supabaseAdmin
      .from("unipile_message_log")
      .select("id, status, provider_message_id")
      .eq("account_id", ctx.accountId)
      .eq("idempotency_key", key)
      .maybeSingle();
    if (existing && existing.status === "sent") {
      return {
        ok: true as const,
        deduped: true,
        providerMessageId: existing.provider_message_id,
      };
    }

    const { data: logRow } = await supabaseAdmin
      .from("unipile_message_log")
      .upsert(
        {
          account_id: ctx.accountId,
          owner_id: userId,
          kind: "message",
          target_identifier: providerId,
          candidate_id: data.candidateId ?? null,
          body: renderedText,
          status: "queued",
          idempotency_key: key,
        },
        { onConflict: "account_id,idempotency_key" },
      )
      .select("id")
      .single();

    try {
      const res = await sendLinkedinMessage(ctx, {
        attendeeProviderId: providerId,
        text: renderedText,
      });
      // v2 responde com payload reduzido (só o id do recurso criado).
      const { normalizeSendMessageResult } = await import("@/lib/unipile/client.server");
      const { messageId, chatId } = normalizeSendMessageResult(res);
      await supabaseAdmin
        .from("unipile_message_log")
        .update({
          status: "sent",
          provider_message_id: messageId,
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", logRow!.id);
      return { ok: true as const, providerMessageId: messageId, chatId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = err instanceof UnipileError ? err.code : "provider_error";
      await supabaseAdmin
        .from("unipile_message_log")
        .update({
          status: "failed",
          error: message.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq("id", logRow!.id);
      return { ok: false as const, error: message, code };
    }
  });

// ---------- send invite ----------

const sendInviteInput = z.object({
  candidateId: z.string().uuid().optional(),
  linkedinUrl: z.string().url().optional(),
  publicIdentifier: z.string().min(1).max(200).optional(),
  providerId: z.string().min(1).max(200).optional(),
  message: z.string().max(300).optional(),
});

export const sendLinkedinInviteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => sendInviteInput.parse(v))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadAccountCtx, sendLinkedinInvite, UnipileError } =
      await import("@/lib/unipile/client.server");

    const ctx = await loadAccountCtx(userId);

    let providerId = data.providerId ?? null;
    let profileRaw: any = null;
    if (!providerId) {
      const publicId = data.publicIdentifier ?? extractPublicIdentifier(data.linkedinUrl ?? null);
      if (!publicId) {
        return { ok: false as const, error: "Sem identificador do destinatário." };
      }
      try {
        const resolved = await resolveProviderId(ctx, publicId);
        providerId = resolved.providerId;
        profileRaw = resolved.raw;
      } catch (err) {
        if (err instanceof UnipileError) {
          return { ok: false as const, error: err.message, code: err.code };
        }
        throw err;
      }
      if (!providerId) {
        return { ok: false as const, error: "Não foi possível resolver o provider_id." };
      }
    }

    const renderedMessage = data.message
      ? await renderLinkedinTokens(data.message, {
          candidateId: data.candidateId ?? null,
          profileRaw,
        })
      : undefined;

    const key = idemKey([ctx.accountId, "invite", providerId, renderedMessage ?? ""]);

    const { data: existing } = await supabaseAdmin
      .from("unipile_message_log")
      .select("id, status")
      .eq("account_id", ctx.accountId)
      .eq("idempotency_key", key)
      .maybeSingle();
    if (existing && existing.status === "sent") {
      return { ok: true as const, deduped: true };
    }

    const { data: logRow } = await supabaseAdmin
      .from("unipile_message_log")
      .upsert(
        {
          account_id: ctx.accountId,
          owner_id: userId,
          kind: "invite",
          target_identifier: providerId,
          candidate_id: data.candidateId ?? null,
          body: renderedMessage ?? null,
          status: "queued",
          idempotency_key: key,
        },
        { onConflict: "account_id,idempotency_key" },
      )
      .select("id")
      .single();

    try {
      const res = await sendLinkedinInvite(ctx, { providerId, message: renderedMessage });
      // v1: invitation_id/invite_id; v2 (relation-requests): apenas `id`.
      const { normalizeInviteResult } = await import("@/lib/unipile/client.server");
      const { invitationId } = normalizeInviteResult(res);
      await supabaseAdmin
        .from("unipile_message_log")
        .update({
          status: "sent",
          ...(invitationId ? { provider_invite_id: invitationId } : {}),
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", logRow!.id);
      return { ok: true as const, invitationId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = err instanceof UnipileError ? err.code : "provider_error";
      await supabaseAdmin
        .from("unipile_message_log")
        .update({
          status: "failed",
          error: message.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq("id", logRow!.id);
      return { ok: false as const, error: message, code };
    }
  });

// ---------- histórico ----------

export const listCandidateOutreachFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ candidateId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows } = await supabase
      .from("unipile_message_log")
      .select("id, kind, status, body, target_identifier, error, sent_at, created_at")
      .eq("candidate_id", data.candidateId)
      .order("created_at", { ascending: false })
      .limit(50);
    return { items: rows ?? [] };
  });
