// Server functions para importar contratos a partir de arquivos .pdf ou .docx.
// A extração é feita via Lovable AI Gateway (Gemini 2.5 Flash) e devolve JSON estruturado.
// A criação em `public.contracts` acontece apenas após revisão humana no wizard.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomBytes } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { assertAnyPermission } from "@/lib/access-control/enforce.server";
import {
  ExtractedContractSchema,
  CreateFromImportSchema,
  type ExtractedContract,
} from "@/lib/contracts/import-schemas";
import { buildContractTitle } from "@/lib/contracts/title";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const SYSTEM_PROMPT = `Você é um analista jurídico especialista em contratos brasileiros de prestação de serviços de TI (outsourcing, desenvolvimento, manutenção, consultoria). Sua tarefa é extrair variáveis-chave do contrato fornecido.

REGRAS OBRIGATÓRIAS:
- Responda APENAS JSON válido, sem prosa antes ou depois, sem markdown.
- Se um campo não estiver claramente presente no documento, use null. Nunca invente.
- Datas em formato ISO YYYY-MM-DD.
- Valores numéricos como número puro (13000, não "R$ 13.000,00").
- Percentuais como número (2 significa 2%, não 0,02).
- CNPJ apenas dígitos (14 chars).
- \`role\`: "provider" se nossa empresa é a CONTRATADA/prestadora, "client" se é a CONTRATANTE. Se ambíguo, null.
- \`confidence\` entre 0 e 1 refletindo sua certeza global na extração.
- \`warnings\` lista curta de ambiguidades relevantes (ex.: "valor mensal e total conflitantes").

Schema esperado (todos os campos podem ser null):
{
  "title": string,
  "role": "provider" | "client",
  "document_kind": "main" | "amendment",
  "amendment_number": string,
  "amends_contract_number": string,

  "counterparty_name": string, "counterparty_cnpj": string,
  "contracting_name": string, "contracting_cnpj": string,
  "starts_at": "YYYY-MM-DD", "ends_at": "YYYY-MM-DD",
  "auto_renew": boolean, "notice_days": number,
  "total_value": number, "monthly_value": number, "hours_per_month": number,
  "currency": "BRL" | "USD" | ...,
  "payment_day": 1..31,
  "payment_method": "pix" | "ted" | "boleto" | "transferencia" | "outros",
  "late_fee_percent": number, "late_interest_monthly_percent": number,
  "expense_reimbursement_days": number,
  "readjustment_index": "IGPM" | "IPCA" | "INPC" | "SELIC" | "CDI" | "outros",
  "readjustment_period": "anual" | "mensal" | ...,
  "penalty_percent": number,
  "cure_period_days": number, "trial_period_days": number,
  "unilateral_termination_notice_days": number,
  "service_type": "outsourcing" | "desenvolvimento" | "manutencao" | "consultoria" | "licenciamento" | "outros",
  "service_scope": string,
  "service_location": "remoto" | "presencial" | "hibrido",
  "governing_law": string, "jurisdiction": string,
  "confidentiality_term_months": number,
  "signature_provider": "forsign" | "docusign" | "clicksign" | "manual" | "outros",
  "signature_document_id": string, "signature_operation_id": string,
  "witnesses": [{"name": string, "cpf": string, "role": string}],
  "self_contract_number": string,
  "referenced_contract_numbers": [string],
  "confidence": 0..1,
  "warnings": [string]
}

REGRAS ADICIONAIS DE NÚMERO E VÍNCULO:
- \`self_contract_number\`: o número/identificação do próprio contrato, se impresso no documento (ex.: "Contrato nº 2026/0031").
- \`referenced_contract_numbers\`: números de OUTROS contratos citados no documento, tipicamente quando um contrato de compra referencia o contrato de prestação firmado com o cliente final. Liste apenas números, sem prosa. Se não houver, use [].

REGRAS DE TIPO DE DOCUMENTO:
- \`document_kind\`: "amendment" quando o documento é um TERMO ADITIVO / ADITIVO / ADENDO / instrumento que altera, prorroga ou repactua um contrato já existente (títulos como "Primeiro Termo Aditivo", "2º Aditivo ao Contrato...", "ADT"). Use "main" quando é o contrato original. Se ambíguo, null.
- \`amendment_number\`: o número do aditivo em dígitos ("1" para "Primeiro Termo Aditivo", "2" para "2º Aditivo"). Null quando não houver numeração ou não for aditivo.
- \`amends_contract_number\`: o número/identificação do contrato alterado pelo aditivo, quando citado no documento.
- Um aditivo normalmente cita o contrato original e sua data de assinatura: nesse caso \`document_kind\` é "amendment", ainda que o contrato original não esteja anexado.`;

async function callGeminiExtract(
  userContent: Array<Record<string, unknown>>,
): Promise<ExtractedContract> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY ausente");

  const resp = await fetch(AI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    if (resp.status === 429)
      throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
    if (resp.status === 402) throw new Error("Créditos de IA esgotados no workspace.");
    throw new Error(`Falha na extração (${resp.status}): ${body.slice(0, 200)}`);
  }

  const payload = await resp.json();
  const raw = payload?.choices?.[0]?.message?.content ?? "{}";
  let parsed: unknown;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    throw new Error("A IA não retornou JSON válido.");
  }
  const result = ExtractedContractSchema.safeParse(parsed);
  if (!result.success) {
    // Tolerante: devolve o que parseou e adiciona warning.
    const fallback = ExtractedContractSchema.parse({});
    return {
      ...fallback,
      warnings: [
        "A IA retornou campos fora do formato esperado. Revise manualmente.",
        ...(Array.isArray((parsed as { warnings?: unknown }).warnings)
          ? ((parsed as { warnings?: string[] }).warnings ?? [])
          : []),
      ],
    };
  }
  return result.data;
}

// ============= PARSE PDF (base64) =============

export const parseContractPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        filename: z.string().min(1).max(255),
        // base64 sem prefixo `data:` — o cliente envia apenas o corpo
        base64: z.string().min(20).max(30_000_000), // ~22MB base64 = ~15MB binário
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techcontracts.contracts.create.own",
    ]);

    const dataUrl = `data:application/pdf;base64,${data.base64}`;
    const extracted = await callGeminiExtract([
      {
        type: "text",
        text: "Extraia as variáveis do contrato anexo conforme o schema.",
      },
      {
        type: "file",
        file: { filename: data.filename, file_data: dataUrl },
      },
    ]);
    return extracted;
  });

// ============= PARSE TEXT (docx já convertido no cliente) =============

export const parseContractText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        filename: z.string().min(1).max(255),
        text: z.string().min(20).max(400_000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techcontracts.contracts.create.own",
    ]);

    const extracted = await callGeminiExtract([
      {
        type: "text",
        text: `Extraia as variáveis do contrato a seguir (arquivo: ${data.filename}) conforme o schema.\n\n===\n${data.text}\n===`,
      },
    ]);
    return extracted;
  });

// ============= CREATE FROM IMPORT =============
// Persiste o contrato depois que o usuário revisou os campos extraídos.
function generateNumber() {
  const yearMonth = new Date().toISOString().slice(0, 7).replace("-", "");
  return `C-${yearMonth}-${Math.floor(Math.random() * 9000 + 1000)}`;
}
function token() {
  return randomBytes(24).toString("hex");
}

// Tenta casar contraparte pelo CNPJ. Fallback para o nome exato (case-insensitive).
async function findCompanyIdByCnpjOrName(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  workspaceId: string,
  cnpj: string | null | undefined,
  name: string | null | undefined,
): Promise<string | null> {
  const digits = (cnpj ?? "").replace(/\D/g, "");
  if (digits.length === 14) {
    const { data } = await supabase
      .from("companies")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("cnpj", digits)
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }
  if (name && name.trim().length > 2) {
    const { data } = await supabase
      .from("companies")
      .select("id")
      .eq("workspace_id", workspaceId)
      .ilike("name", name.trim())
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }
  return null;
}

export const createContractFromImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CreateFromImportSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techcontracts.contracts.create.own",
    ]);

    const f = data.fields;
    const extractedRole = f.role ?? null;

    const counterpartyCompanyId = await findCompanyIdByCnpjOrName(
      supabase,
      workspaceId,
      f.counterparty_cnpj,
      f.counterparty_name,
    );

    const metadata: Record<string, unknown> = {};
    if (Array.isArray(f.witnesses) && f.witnesses.length) metadata.witnesses = f.witnesses;
    if (f.counterparty_name) metadata.counterparty_name_extracted = f.counterparty_name;
    if (f.counterparty_cnpj) metadata.counterparty_cnpj_extracted = f.counterparty_cnpj;
    if (f.contracting_name) metadata.contracting_name_extracted = f.contracting_name;
    if (f.contracting_cnpj) metadata.contracting_cnpj_extracted = f.contracting_cnpj;
    if (Array.isArray(f.warnings) && f.warnings.length) metadata.import_warnings = f.warnings;
    if (f.self_contract_number) metadata.self_contract_number = f.self_contract_number;
    const referenced = (f.referenced_contract_numbers ?? []).filter(
      (n) => typeof n === "string" && n.trim().length > 0,
    );
    if (referenced.length) metadata.referenced_contract_numbers = referenced;

    // Contratante = entidade legal do workspace? (contratos elegíveis ao TechPeople)
    const { loadOwnLegalEntities, matchOwnEntity } =
      await import("@/lib/contracts/import-link.server");
    const ownEntities = await loadOwnLegalEntities(supabase, workspaceId);
    const ownEntity = matchOwnEntity(ownEntities, f.contracting_cnpj, f.contracting_name);
    if (ownEntity) metadata.contracting_is_own_entity = true;
    const ownCounterparty = matchOwnEntity(ownEntities, f.counterparty_cnpj, f.counterparty_name);

    // O papel é derivado das nossas empresas: CONTRATADA ⇒ prestação, CONTRATANTE ⇒ compra.
    // O `role` extraído pela IA só é usado quando não há evidência das partes.
    const inferredRole: "provider" | "client" | null =
      Boolean(ownEntity) === Boolean(ownCounterparty)
        ? null
        : ownCounterparty
          ? "provider"
          : "client";
    const role: "provider" | "client" = inferredRole ?? extractedRole ?? "provider";
    metadata.role_source = inferredRole ? "inferred" : "extracted";
    if (extractedRole) metadata.role_extracted = extractedRole;
    if (inferredRole && extractedRole && inferredRole !== extractedRole) {
      const warn =
        inferredRole === "provider"
          ? "Papel extraído indicava Compra, mas nossa empresa consta como CONTRATADA: gravado como Prestação."
          : "Papel extraído indicava Prestação, mas nossa empresa consta como CONTRATANTE: gravado como Compra.";
      metadata.import_warnings = [
        ...((metadata.import_warnings as string[] | undefined) ?? []),
        warn,
      ];
    }
    const ownSideName = (role === "provider" ? ownCounterparty?.name : ownEntity?.name) ?? null;

    // Tipo de documento detectado pela IA (mais os sinais textuais do título/arquivo).
    // O vínculo do aditivo ao contrato principal continua sendo passo próprio da
    // importação, então aqui apenas registramos a evidência e alertamos na revisão.
    const { detectAmendmentSignals } = await import("@/lib/contracts/doc-kind");
    const signals = detectAmendmentSignals({
      title: f.title,
      warnings: (metadata.import_warnings as string[] | undefined) ?? f.warnings ?? [],
      selfNumber: f.self_contract_number,
      fileName: (data.source_file_path ?? "").split("/").pop() ?? null,
    });
    const isAmendment = f.document_kind === "amendment" || signals.isAmendment;
    const amendmentNumber = (f.amendment_number ?? "").trim() || signals.number;
    if (f.document_kind) metadata.document_kind_extracted = f.document_kind;
    if (amendmentNumber) metadata.amendment_number_extracted = amendmentNumber;
    if (f.amends_contract_number) {
      metadata.amends_contract_number_extracted = f.amends_contract_number;
    }
    if (isAmendment) {
      metadata.import_warnings = [
        ...((metadata.import_warnings as string[] | undefined) ?? []),
        amendmentNumber
          ? `Documento aparenta ser TERMO ADITIVO nº ${amendmentNumber}: revise o tipo de documento e vincule ao contrato principal.`
          : "Documento aparenta ser TERMO ADITIVO: revise o tipo de documento e vincule ao contrato principal.",
      ];
    }

    const insertPayload: Record<string, unknown> = {
      workspace_id: workspaceId,
      owner_id: userId,
      role,
      title:
        buildContractTitle({
          role,
          serviceType: f.service_type,
          documentKind: isAmendment ? "amendment" : "main",
          amendmentNumber,
          contractingName: f.contracting_name,

          counterpartyName: f.counterparty_name,
          ownName: ownSideName,
          startsAt: f.starts_at ?? null,
        }) ||
        f.title?.trim() ||
        "Contrato importado",

      counterparty_company_id: counterpartyCompanyId,
      contracting_legal_entity_id: ownEntity?.id ?? null,

      total_value: f.total_value ?? f.monthly_value ?? 0,
      currency: f.currency ?? "BRL",
      starts_at: f.starts_at ?? null,
      ends_at: f.ends_at ?? null,
      auto_renew: f.auto_renew ?? false,
      notice_days: f.notice_days ?? 30,
      number: generateNumber(),
      public_token: token(),
      status: "draft",
      metadata,
      // novos campos
      monthly_value: f.monthly_value ?? null,
      hours_per_month: f.hours_per_month ?? null,
      payment_day: f.payment_day ?? null,
      payment_method: f.payment_method ?? null,
      late_fee_percent: f.late_fee_percent ?? null,
      late_interest_monthly_percent: f.late_interest_monthly_percent ?? null,
      expense_reimbursement_days: f.expense_reimbursement_days ?? null,
      readjustment_index: f.readjustment_index ?? null,
      readjustment_period: f.readjustment_period ?? null,
      penalty_percent: f.penalty_percent ?? null,
      cure_period_days: f.cure_period_days ?? null,
      trial_period_days: f.trial_period_days ?? null,
      unilateral_termination_notice_days: f.unilateral_termination_notice_days ?? null,
      service_type: f.service_type ?? null,
      service_scope: f.service_scope ?? null,
      service_location: f.service_location ?? null,
      governing_law: f.governing_law ?? null,
      jurisdiction: f.jurisdiction ?? null,
      confidentiality_term_months: f.confidentiality_term_months ?? null,
      signature_provider: f.signature_provider ?? null,
      signature_document_id: f.signature_document_id ?? null,
      signature_operation_id: f.signature_operation_id ?? null,
      source_file_path: data.source_file_path ?? null,
      imported_from: data.imported_from,
      import_confidence: f.confidence ?? null,
    };

    const { data: row, error } = await supabase
      .from("contracts")
      .insert(insertPayload as never)
      .select("id")
      .single();
    if (error) throw error;
    return row as { id: string };
  });

// ============= VIEW ORIGINAL FILE =============
// Gera URL assinada temporária do arquivo original importado (bucket `contract-imports`).
export const getContractSourceFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("contracts")
      .select("id, source_file_path, imported_from")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!row) {
      throw new Error("Contrato não encontrado ou você não possui acesso a ele.");
    }
    if (!row.source_file_path) {
      throw new Error("Arquivo original não disponível para este contrato.");
    }
    const path = row.source_file_path as string;
    // A consulta acima é feita com a sessão do usuário e mantém a autorização
    // do contrato sob RLS. Só depois dela o servidor assina o objeto: arquivos
    // importados pertencem ao uploader, mas devem acompanhar o acesso ao contrato.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("contract-imports")
      .createSignedUrl(path, 60 * 10);
    if (sErr || !signed?.signedUrl) {
      if (sErr?.message.toLowerCase().includes("object not found")) {
        throw new Error(
          "O arquivo original deste contrato não foi encontrado. Solicite o reenvio do documento.",
        );
      }
      throw new Error("Não foi possível preparar o arquivo deste contrato. Tente novamente.");
    }
    const fileName = path.split("/").pop() ?? "contrato";
    return {
      url: signed.signedUrl,
      fileName,
      kind: (row.imported_from as string | null) ?? null,
    };
  });

// ============= VÍNCULO AUTOMÁTICO PRESTAÇÃO ↔ COMPRA =============
// Depois de um lote importado, tenta casar cada contrato de compra com o contrato
// de prestação citado no documento. Sem casamento, o contrato fica pendente e
// aparece na aba de vinculação manual.

export const linkImportedContracts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(50) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techcontracts.contracts.update.own",
      "techcontracts.contracts.create.own",
    ]);

    const { resolveReferencedContract } = await import("@/lib/contracts/import-link.server");

    const { data: batch, error: batchErr } = await supabase
      .from("contracts")
      .select("id, role, number, title, parent_contract_id, metadata")
      .in("id", data.ids);
    if (batchErr) throw batchErr;

    // Universo de contratos de prestação do workspace (lote + existentes).
    const { data: providers, error: provErr } = await supabase
      .from("contracts")
      .select("id, number, metadata")
      .eq("role", "provider")
      .order("created_at", { ascending: false })
      .limit(500);
    if (provErr) throw provErr;

    const candidates = (providers ?? []).map((p) => {
      const row = p as {
        id: string;
        number: string | null;
        metadata: Record<string, unknown> | null;
      };
      return {
        id: row.id,
        number: row.number,
        selfNumber: (row.metadata?.["self_contract_number"] as string | undefined) ?? null,
      };
    });

    const linked: Array<{ id: string; parent_id: string; matched_number: string }> = [];
    const pending: Array<{ id: string; title: string; referenced: string[] }> = [];

    for (const c of batch ?? []) {
      const row = c as {
        id: string;
        role: string;
        title: string;
        parent_contract_id: string | null;
        metadata: Record<string, unknown> | null;
      };
      if (row.role !== "client" || row.parent_contract_id) continue;
      const referenced = Array.isArray(row.metadata?.["referenced_contract_numbers"])
        ? (row.metadata?.["referenced_contract_numbers"] as string[])
        : [];
      const hit = resolveReferencedContract(
        referenced,
        candidates.filter((k) => k.id !== row.id),
      );
      if (!hit) {
        pending.push({ id: row.id, title: row.title, referenced });
        continue;
      }
      const { error: upErr } = await supabase
        .from("contracts")
        .update({ parent_contract_id: hit.id })
        .eq("id", row.id);
      if (upErr) {
        pending.push({ id: row.id, title: row.title, referenced });
        continue;
      }
      linked.push({ id: row.id, parent_id: hit.id, matched_number: hit.matchedNumber });
    }

    return { linked, pending };
  });

// ============= FILA DE VINCULAÇÃO MANUAL =============

export type { PendingLinkRow } from "./pending-link";

export const listContractsPendingLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        role: z.enum(["provider", "client", "amendment", "all"]).optional(),
        search: z.string().max(200).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { computePendingLinks } = await import("./pending-link");

    const { data: rows, error } = await supabase
      .from("contracts")
      .select(
        "id, role, number, title, status, starts_at, ends_at, parent_contract_id, document_kind, amendment_of_id, metadata, companies:counterparty_company_id(name)",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;

    return computePendingLinks(
      (rows ?? []) as unknown as Parameters<typeof computePendingLinks>[0],
      { role: data.role, search: data.search },
    );
  });

// Contagem leve da fila de vinculação, usada na badge do botão em /contracts.
export const countContractsPendingLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { computePendingLinks } = await import("./pending-link");

    const { data: rows, error } = await supabase
      .from("contracts")
      .select(
        "id, role, number, title, status, starts_at, ends_at, parent_contract_id, document_kind, amendment_of_id, metadata",
      )
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw error;

    const pending = computePendingLinks(
      (rows ?? []) as unknown as Parameters<typeof computePendingLinks>[0],
    );
    return { count: pending.length };
  });

// Remove um contrato da fila de vinculação (declara que não há contrato par).
export const dismissContractLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), dismissed: z.boolean().default(true) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techcontracts.contracts.update.own",
    ]);

    const { data: row, error } = await supabase
      .from("contracts")
      .select("id, metadata")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("Contrato não encontrado.");

    const metadata = {
      ...((row.metadata as Record<string, unknown> | null) ?? {}),
      link_dismissed: data.dismissed,
    };
    const { error: upErr } = await supabase
      .from("contracts")
      .update({ metadata })
      .eq("id", data.id);
    if (upErr) throw upErr;
    return { id: data.id, dismissed: data.dismissed };
  });
