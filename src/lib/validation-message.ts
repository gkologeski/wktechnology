const FIELD_LABELS: Record<string, string> = {
  full_name: "Nome",
  email: "Email",
  phone: "Telefone",
  linkedin_url: "LinkedIn",
  location: "Localização",
  current_position: "Cargo atual",
  current_company: "Empresa atual",
  notes: "Observações",
  source: "Origem",
  skills: "Habilidades",
  tags: "Tags",
};

type Issue = { path?: unknown[]; message?: string };

function labelFor(path: unknown[] | undefined): string | null {
  const first = path?.find((p) => typeof p === "string") as string | undefined;
  if (!first) return null;
  return FIELD_LABELS[first] ?? first;
}

/**
 * Converte erros de validação (array de issues do Zod, serializado ou não)
 * em uma mensagem legível em português.
 */
export function formatValidationError(error: unknown, fallback = "Erro ao salvar"): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (!raw) return fallback;

  let issues: Issue[] | null = null;
  const trimmed = raw.trim();
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) issues = parsed as Issue[];
      else if (Array.isArray((parsed as { issues?: Issue[] }).issues))
        issues = (parsed as { issues: Issue[] }).issues;
    } catch {
      issues = null;
    }
  }

  if (!issues || issues.length === 0) return raw || fallback;

  const parts = issues.slice(0, 3).map((issue) => {
    const label = labelFor(issue.path);
    const msg = issue.message && issue.message !== "Invalid url" ? issue.message : "valor inválido";
    return label ? `${label}: ${msg}` : msg;
  });
  return `Verifique os campos — ${parts.join("; ")}`;
}
