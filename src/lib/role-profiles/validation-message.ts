import { ZodError, type ZodTypeAny, type z } from "zod";
import { CLIENT_FIELDS } from "./schema";

const EXTRA_LABELS: Record<string, string> = {
  title: "Cargo",
  quantity: "Quantidade",
  modality: "Modalidade",
  priority: "Prioridade",
  seniority: "Senioridade",
  "need.reason": "Motivo da contratação",
  "outsourcing.allocation_months": "Duração da alocação (meses)",
  "outsourcing.management": "Gestão",
  "outsourcing.start_policy": "Política de início",
  "outsourcing.replacement_policy": "Política de substituição",
  "requirements.skills": "Competências técnicas",
  "requirements.languages": "Idiomas",
  "hunting.guarantee_days": "Garantia (dias)",
  "selection.client_confirmation": "Confirmação do cliente",
};

function labelFor(path: (string | number)[]): string {
  const parts = path.filter((p): p is string => typeof p === "string");
  for (let n = parts.length; n > 0; n--) {
    const key = parts.slice(0, n).join(".");
    const l = (CLIENT_FIELDS as Record<string, string>)[key] ?? EXTRA_LABELS[key];
    if (l) return l;
  }
  return parts.join(".") || "Campo";
}

function reason(issue: ZodError["issues"][number]): string {
  const i = issue as unknown as {
    code: string;
    minimum?: number;
    maximum?: number;
    validation?: string;
  };
  if (i.code === "too_small")
    return i.minimum !== undefined ? `precisa ser no mínimo ${i.minimum}` : "está vazio";
  if (i.code === "too_big")
    return i.maximum !== undefined ? `aceita no máximo ${i.maximum}` : "está grande demais";
  if (i.code === "invalid_string" && i.validation === "regex") return "está em formato inválido";
  if (i.code === "invalid_enum_value") return "tem uma opção inválida";
  if (i.code === "invalid_type") return "tem um valor inválido";
  if (i.code === "unrecognized_keys") return "contém dados não reconhecidos";
  return "é inválido";
}

/** Converte erros de validação em mensagem PT-BR com o nome do campo. */
export function validationMessage(err: ZodError): string {
  const seen = new Set<string>();
  const msgs: string[] = [];
  for (const issue of err.issues) {
    const m = `${labelFor(issue.path)} ${reason(issue)}`;
    if (!seen.has(m)) {
      seen.add(m);
      msgs.push(m);
    }
  }
  return `Revise: ${msgs.slice(0, 3).join("; ")}${msgs.length > 3 ? "…" : ""}.`;
}

/** parse que lança erro legível em vez do JSON técnico. */
export function parseFriendly<S extends ZodTypeAny>(schema: S, value: unknown): z.output<S> {
  const r = schema.safeParse(value);
  if (!r.success) throw new Error(validationMessage(r.error));
  return r.data;
}
