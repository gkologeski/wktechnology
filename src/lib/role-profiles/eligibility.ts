// Regras puras (sem banco) de elegibilidade, pré-preenchimento a partir dos
// itens de linha e despacho de avisos de aprovação. Testadas em eligibility.test.ts.
import type { Modality, ProfileHeader } from "./schema";
import { SENIORITIES } from "./schema";

/** Minúsculas e sem acentos. */
export function normalizeText(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export type StaffingKind = "hunting" | "outsourcing";

/** Tipo do serviço pelo NOME DO CATÁLOGO (nunca pelo texto livre do negócio). */
export function staffingKindOf(catalogName: string | null | undefined): StaffingKind | null {
  const n = normalizeText(catalogName);
  if (n.includes("hunting")) return "hunting";
  if (n.includes("outsourcing")) return "outsourcing";
  return null;
}

export type EligibilityLine = {
  service_catalog_id: string | null;
  catalogName: string | null;
};

export function computeEligibility(lines: EligibilityLine[]) {
  const services = new Set<string>();
  const kinds = new Set<StaffingKind>();
  for (const l of lines) {
    if (!l.service_catalog_id) continue;
    const k = staffingKindOf(l.catalogName);
    if (!k) continue;
    kinds.add(k);
    services.add(l.catalogName!);
  }
  return { eligible: kinds.size > 0, services: [...services], kinds: [...kinds] };
}

export function modalityFor(kinds: StaffingKind[]): Modality {
  const h = kinds.includes("hunting");
  const o = kinds.includes("outsourcing");
  return h && o ? "both" : h ? "hunting" : "outsourcing";
}

export function normalizeSeniority(raw: string | null | undefined): ProfileHeader["seniority"] {
  const n = normalizeText(raw).trim();
  if (!n) return null;
  if (n.startsWith("jun") || n === "jr") return "junior";
  if (n.startsWith("ple") || n === "pl") return "pleno";
  if (n.startsWith("sen") || n === "sr") return "senior";
  if (n.startsWith("espec")) return "especialista";
  if (n.startsWith("lider") || n.startsWith("lead") || n.startsWith("tech lead"))
    return "lideranca";
  return (SENIORITIES as readonly string[]).includes(n) ? (n as ProfileHeader["seniority"]) : null;
}

export type PrefillLine = {
  id: string;
  name: string | null;
  quantity: number | null;
  seniority: string | null;
  service_catalog_id: string | null;
  catalogName: string | null;
  contracting_preset_id: string | null;
  job_profile_id: string | null;
  preset: { name: string; seniority: string | null; job_profile_id: string | null } | null;
  jobProfile: { name: string; seniority: string | null } | null;
};

export type PrefillSuggestion = {
  lineItemId: string;
  title: string;
  quantity: number;
  seniority: ProfileHeader["seniority"];
  modality: Modality;
  jobProfileId: string | null;
  presetId: string | null;
  /** Origem de cada campo para exibir ao usuário. */
  origin: { title: string; quantity: string; seniority: string };
  gaps: string[];
};

/**
 * Item de linha → sugestão de perfil. Precedência: valor explícito do item >
 * preset > cargo. Só itens de Hunting/Outsourcing com cargo ou preset entram.
 */
export function suggestionFromLine(l: PrefillLine): PrefillSuggestion | null {
  const kind = l.service_catalog_id ? staffingKindOf(l.catalogName) : null;
  if (!kind) return null;
  const jobProfileId = l.job_profile_id ?? l.preset?.job_profile_id ?? null;
  if (!jobProfileId && !l.contracting_preset_id) return null;
  const gaps: string[] = [];
  const title = l.jobProfile?.name ?? l.preset?.name ?? l.name ?? "";
  const titleOrigin = l.jobProfile?.name
    ? "Cargo"
    : l.preset?.name
      ? "Preset"
      : l.name
        ? "Item de linha"
        : "—";
  if (!title.trim()) gaps.push("Título");
  const qRaw = Number(l.quantity);
  const quantity = Number.isFinite(qRaw) && qRaw >= 1 ? Math.min(999, Math.round(qRaw)) : 1;
  const sen =
    normalizeSeniority(l.seniority) ??
    normalizeSeniority(l.preset?.seniority) ??
    normalizeSeniority(l.jobProfile?.seniority);
  const senOrigin = normalizeSeniority(l.seniority)
    ? "Item de linha"
    : normalizeSeniority(l.preset?.seniority)
      ? "Preset"
      : normalizeSeniority(l.jobProfile?.seniority)
        ? "Cargo"
        : "—";
  if (!sen) gaps.push("Senioridade");
  return {
    lineItemId: l.id,
    title: title.trim().slice(0, 200),
    quantity,
    seniority: sen,
    modality: kind,
    jobProfileId,
    presetId: l.contracting_preset_id,
    origin: {
      title: titleOrigin,
      quantity: Number.isFinite(qRaw) && qRaw >= 1 ? "Item de linha" : "Padrão (1)",
      seniority: senOrigin,
    },
    gaps,
  };
}

/** Diferenças entre o perfil existente e o item de linha de origem (sem sobrescrever). */
export function divergenceFrom(
  profile: { title: string; quantity: number; seniority: string | null },
  s: PrefillSuggestion,
): string[] {
  const out: string[] = [];
  if (profile.title.trim() !== s.title) out.push("Título");
  if (profile.quantity !== s.quantity) out.push("Quantidade");
  if ((profile.seniority ?? null) !== (s.seniority ?? null)) out.push("Senioridade");
  return out;
}

export type ApproverResolution = {
  status: "ok" | "no_owner" | "no_team" | "no_leader" | "ambiguous";
  leader_id?: string | null;
  leader_ids?: string[];
  groups?: { id: string; name: string }[];
};

export function approverProblem(r: ApproverResolution): string | null {
  switch (r.status) {
    case "ok":
      return null;
    case "no_owner":
      return "O negócio não tem responsável. Defina o responsável para identificar a equipe.";
    case "no_team":
      return "O responsável do negócio não pertence a nenhuma equipe. Inclua-o em uma equipe em Configurações › Equipes.";
    case "no_leader":
      return "A equipe do responsável não tem líder definido. Marque o líder em Configurações › Equipes.";
    case "ambiguous":
      return "Há mais de um líder possível (responsável em várias equipes ou equipe com vários líderes). Ajuste em Configurações › Equipes para ficar um único líder.";
  }
}

// ---------------------------------------------------------------------------
// Despacho de avisos (outbox). Puro: dependências injetadas.

export type Delivery = {
  id: string;
  channel: "email" | "notification";
  recipient_id: string;
  status: "pending" | "sending" | "sent" | "failed" | "suppressed";
  attempts: number;
};
export const MAX_DELIVERY_ATTEMPTS = 5;

export type DispatchDeps = {
  claim: (d: Delivery) => Promise<boolean>; // pending|failed|sending travado → sending (atômico)
  sendEmail: (d: Delivery) => Promise<"sent" | "suppressed">;
  sendNotification: (d: Delivery) => Promise<void>;
  finish: (
    d: Delivery,
    r: { status: "sent" | "failed" | "suppressed"; error?: string },
  ) => Promise<void>;
};

/** Processa entregas pendentes/falhas; nunca reenvia uma já enviada. */
export async function dispatchDeliveries(list: Delivery[], deps: DispatchDeps) {
  const out: { id: string; status: string; error?: string }[] = [];
  for (const d of list) {
    if (d.status === "sent" || d.status === "suppressed") {
      out.push({ id: d.id, status: d.status });
      continue;
    }
    if (d.attempts >= MAX_DELIVERY_ATTEMPTS) {
      out.push({ id: d.id, status: "failed", error: "Limite de tentativas atingido" });
      continue;
    }
    if (!(await deps.claim(d))) {
      out.push({ id: d.id, status: "skipped" });
      continue;
    }
    try {
      if (d.channel === "email") {
        const r = await deps.sendEmail(d);
        await deps.finish(d, { status: r });
        out.push({ id: d.id, status: r });
      } else {
        await deps.sendNotification(d);
        await deps.finish(d, { status: "sent" });
        out.push({ id: d.id, status: "sent" });
      }
    } catch (e) {
      const error = (e instanceof Error ? e.message : String(e)).slice(0, 500);
      await deps.finish(d, { status: "failed", error });
      out.push({ id: d.id, status: "failed", error });
    }
  }
  return out;
}
