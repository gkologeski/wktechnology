// Preview de perfil LinkedIn via Unipile — NÃO persiste.
// Retorna um DTO plano que o dialog "+ Novo candidato" usa para
// pré-preencher o formulário editável. O usuário revisa e salva pelo
// fluxo manual atual (saveAtsCandidate).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PreviewInput = z.object({
  url: z.string().url().max(500),
});

const LINKEDIN_IN_RE = /linkedin\.com\/in\/([^/?#]+)/i;

function extractPublicIdentifier(url: string): string | null {
  const m = url.match(LINKEDIN_IN_RE);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]).replace(/\/+$/, "").trim() || null;
  } catch {
    return m[1] || null;
  }
}

function normalizeLinkedinUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname.replace(/\/+$/, "").toLowerCase()}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

export type LinkedinExperienceDTO = {
  title: string;
  company: string;
  start: string;
  end: string;
  description: string;
};
export type LinkedinEducationDTO = {
  school: string;
  degree: string;
  start: string;
  end: string;
};

export type LinkedinPreviewResult =
  | {
      ok: true;
      data: {
        full_name: string;
        headline: string | null;
        current_position: string | null;
        current_company: string | null;
        location: string | null;
        email: string | null;
        phone: string | null;
        linkedin_url: string;
        photo_url: string | null;
        skills: string[];
        experiences: LinkedinExperienceDTO[];
        education: LinkedinEducationDTO[];
        notes_seed: string;
      };
    }
  | { ok: false; code: string; message: string };

export const previewLinkedinProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PreviewInput.parse(input))
  .handler(async ({ context, data }): Promise<LinkedinPreviewResult> => {
    const { userId } = context;

    const publicId = extractPublicIdentifier(data.url);
    if (!publicId) {
      return {
        ok: false,
        code: "invalid_url",
        message: "URL do LinkedIn inválida. Use o formato linkedin.com/in/usuario",
      };
    }

    const normalizedUrl = normalizeLinkedinUrl(data.url);

    const { loadAccountCtx, fetchProfile, UnipileError } =
      await import("@/lib/unipile/client.server");

    let ctx: Awaited<ReturnType<typeof loadAccountCtx>>;
    try {
      ctx = await loadAccountCtx(userId);
    } catch {
      return {
        ok: false,
        code: "unipile_not_connected",
        message:
          "LinkedIn não conectado. Conecte sua conta em Integrações → LinkedIn para importar perfis.",
      };
    }

    let profile: Record<string, unknown> | null;
    try {
      profile = (await fetchProfile(ctx, publicId)) as Record<string, unknown> | null;
    } catch (e) {
      if (e instanceof UnipileError) {
        const friendly =
          e.code === "daily_budget_reached"
            ? "Limite diário do LinkedIn atingido. Tente novamente mais tarde."
            : e.code === "rate_limited"
              ? "Muitas requisições ao LinkedIn. Aguarde alguns segundos e tente de novo."
              : e.code === "account_disconnected"
                ? "Sua conta LinkedIn foi desconectada. Reconecte em Integrações → LinkedIn."
                : e.status === 404
                  ? "Perfil não encontrado ou privado no LinkedIn."
                  : e.message || "Falha ao buscar perfil no LinkedIn.";
        return { ok: false, code: e.code, message: friendly };
      }
      return {
        ok: false,
        code: "unknown_error",
        message: e instanceof Error ? e.message : "Falha ao buscar perfil no LinkedIn.",
      };
    }

    if (!profile) {
      return {
        ok: false,
        code: "not_found",
        message: "Perfil não encontrado ou privado no LinkedIn.",
      };
    }

    // Reaproveita a lógica de extração usada em unipile-hunting.functions.ts.
    const p = profile as Record<string, any>;

    const pickString = (v: unknown): string | null => {
      if (typeof v === "string" && v.trim()) return v.trim();
      if (v && typeof v === "object") {
        const o = v as Record<string, unknown>;
        const s =
          (o.address as string) ??
          (o.email as string) ??
          (o.value as string) ??
          (o.number as string) ??
          (o.phone as string) ??
          null;
        if (typeof s === "string" && s.trim()) return s.trim();
      }
      return null;
    };

    const ci = (p.contact_info ?? p.contactInfo ?? {}) as Record<string, any>;
    const emailCandidates: unknown[] = [
      p.email,
      p.primary_email,
      ci.email,
      ...(Array.isArray(ci.emails) ? ci.emails : []),
      ...(Array.isArray(p.emails) ? p.emails : []),
    ];
    const rawEmail = emailCandidates.map(pickString).find((v) => !!v) ?? null;
    const email = rawEmail && /.+@.+\..+/.test(rawEmail) ? rawEmail.toLowerCase() : null;

    const phoneCandidates: unknown[] = [
      p.phone,
      p.primary_phone,
      ci.phone,
      ...(Array.isArray(ci.phones) ? ci.phones : []),
      ...(Array.isArray(ci.phone_numbers) ? ci.phone_numbers : []),
      ...(Array.isArray(p.phone_numbers) ? p.phone_numbers : []),
    ];
    const phone = phoneCandidates.map(pickString).find((v) => !!v) ?? null;

    const exps: any[] = Array.isArray(p.work_experience)
      ? p.work_experience
      : Array.isArray(p.experiences)
        ? p.experiences
        : Array.isArray(p.experience)
          ? p.experience
          : [];

    const currentCompany =
      (exps[0]?.company as string) ?? (exps[0]?.company_name as string) ?? null;
    const currentPosition =
      (exps[0]?.position as string) ??
      (exps[0]?.role as string) ??
      (exps[0]?.title as string) ??
      null;

    const skillsRaw = Array.isArray(p.skills) ? p.skills : [];
    const skills = skillsRaw
      .map((s: any) => (typeof s === "string" ? s : (s?.name as string)))
      .filter((v: string | undefined): v is string => !!v && v.trim().length > 0)
      .slice(0, 100);

    const edu: any[] = Array.isArray(p.education) ? p.education : [];

    const fullName =
      (p.full_name as string) ??
      ([p.first_name, p.last_name].filter(Boolean).join(" ").trim() || null) ??
      (p.name as string) ??
      "";

    const headline = (p.headline as string) ?? null;
    const location = (p.location as string) ?? (p.location_name as string) ?? null;
    const photoUrl = (p.profile_picture_url as string) ?? (p.picture_url as string) ?? null;

    // Structured experiences/education DTOs for the form.
    const experiencesDTO: LinkedinExperienceDTO[] = exps.slice(0, 20).map((e: any) => ({
      title: String(e.position ?? e.role ?? e.title ?? "")
        .trim()
        .slice(0, 200),
      company: String(e.company ?? e.company_name ?? "")
        .trim()
        .slice(0, 200),
      start: String(e.start ?? e.date_start ?? e.start_date ?? "")
        .trim()
        .slice(0, 40),
      end: String(e.end ?? e.date_end ?? e.end_date ?? "")
        .trim()
        .slice(0, 40),
      description: String(e.description ?? e.summary ?? "")
        .trim()
        .slice(0, 1000),
    }));
    const educationDTO: LinkedinEducationDTO[] = edu.slice(0, 20).map((e: any) => ({
      school: String(e.school ?? e.institution ?? e.school_name ?? "")
        .trim()
        .slice(0, 200),
      degree: String(e.degree ?? e.field_of_study ?? e.field ?? "")
        .trim()
        .slice(0, 200),
      start: String(e.start ?? e.date_start ?? e.start_date ?? "")
        .trim()
        .slice(0, 40),
      end: String(e.end ?? e.date_end ?? e.end_date ?? "")
        .trim()
        .slice(0, 40),
    }));

    // Notes seed: fallback resumo formatado (mantido para compatibilidade).
    const lines: string[] = [];
    if (exps.length) {
      lines.push("Experiência:");
      for (const e of exps.slice(0, 5)) {
        const title = (e.position ?? e.role ?? e.title ?? "") as string;
        const company = (e.company ?? e.company_name ?? "") as string;
        const start = (e.start ?? e.date_start ?? e.start_date ?? "") as string;
        const end = (e.end ?? e.date_end ?? e.end_date ?? "atual") as string;
        const bits = [title, company].filter(Boolean).join(" @ ");
        const period = [start, end].filter(Boolean).join(" — ");
        lines.push(`• ${bits}${period ? ` (${period})` : ""}`);
      }
    }
    if (edu.length) {
      if (lines.length) lines.push("");
      lines.push("Formação:");
      for (const e of edu.slice(0, 5)) {
        const school = (e.school ?? e.institution ?? e.school_name ?? "") as string;
        const degree = (e.degree ?? e.field_of_study ?? "") as string;
        lines.push(`• ${[school, degree].filter(Boolean).join(" — ")}`);
      }
    }
    const notesSeed = lines.join("\n");

    return {
      ok: true,
      data: {
        full_name: fullName.trim() || "",
        headline,
        current_position: currentPosition,
        current_company: currentCompany,
        location,
        email,
        phone,
        linkedin_url: normalizedUrl,
        photo_url: photoUrl,
        skills,
        experiences: experiencesDTO,
        education: educationDTO,
        notes_seed: notesSeed,
      },
    };
  });
