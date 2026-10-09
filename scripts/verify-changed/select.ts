// Seleção conservadora de checks a partir dos arquivos alterados.
// Qualquer dúvida → "full". Só arquivos de código de produto conhecidos → "incremental".

export type VerifyPlan = {
  mode: "full" | "incremental" | "none";
  reason?: string;
  modules: string[];
  lintFiles: string[];
  testTargets: string[];
};

/** Mudou aqui → todo o resto pode ser afetado: roda tudo. */
const FULL_PATTERNS: RegExp[] = [
  /^package\.json$/,
  /^bun\.lockb?$/,
  /^tsconfig.*\.json$/,
  /^vite\.config\./,
  /^vitest\.config\./,
  /^eslint(\.typed)?\.config\./,
  /^eslint-rules\//,
  /^\.prettierrc/,
  /^wrangler\.jsonc$/,
  /^src\/routeTree\.gen\.ts$/,
  /^src\/integrations\//,
  /^src\/(router|start|server)\.tsx?$/,
  /^src\/routes\/__root\.tsx$/,
  /^src\/styles\.css$/,
  /^src\/lib\/utils\.ts$/,
  /^src\/components\/ui\//,
  /^src\/components\/techhire\/ui\//,
  /^src\/lib\/access-control\//,
  /^src\/lib\/db-types\.ts$/,
  /^src\/test\//,
  /^supabase\/migrations\//,
  /^scripts\/verify-changed/,
  /^docs\/architecture\/hardcoded-values\.md$/,
  /^scripts\/hardcode-guard\//,
];

/** Grupos informativos (o que de fato decide os testes é o grafo de imports). */
const MODULES: [string, RegExp][] = [
  ["TechHire", /\/(ats|\(ats\)|techhire)\//],
  ["Agents", /\/(agents?|ai-agent|prospecting\/sdr)\b/],
  [
    "TechSales",
    /\/(crm|deals|leads|contacts|companies|prospecting|inbox|whatsapp|email|quotes|proposals)\b/,
  ],
  ["TechProjects", /\/projects?\b/],
  ["TechPeople", /\/people\b/],
  ["TechContracts", /\/(contracts|services)\b/],
  ["TechFinance", /\/finance/],
  ["Workflows", /\/workflows?\b/],
];

const CODE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const IGNORABLE =
  /^(docs\/|\.lovable\/|roadmap\.md$|AGENTS\.md$|.*\/AGENTS\.md$|README|public\/|tests\/e2e\/)/;

export function classifyChanges(
  changed: string[] | null,
  exists: (f: string) => boolean,
): VerifyPlan {
  const empty = { modules: [], lintFiles: [], testTargets: [] };
  if (changed === null)
    return { mode: "full", reason: "não foi possível listar alterações", ...empty };
  if (!changed.length) return { mode: "none", reason: "nenhuma alteração", ...empty };
  const hit = changed.find((f) => FULL_PATTERNS.some((p) => p.test(f)));
  if (hit) return { mode: "full", reason: `arquivo compartilhado/config: ${hit}`, ...empty };
  const unknown = changed.find(
    (f) =>
      !IGNORABLE.test(f) && !(CODE.test(f) && (f.startsWith("src/") || f.startsWith("scripts/"))),
  );
  if (unknown) return { mode: "full", reason: `fora do mapa: ${unknown}`, ...empty };

  const code = changed.filter((f) => CODE.test(f) && !IGNORABLE.test(f));
  const present = code.filter(exists);
  // Arquivo de código removido: quem o importava pode quebrar sem aparecer no grafo.
  if (present.length !== code.length)
    return { mode: "full", reason: "arquivo de código removido/renomeado", ...empty };
  const modules = [
    ...new Set(
      present.flatMap((f) => MODULES.filter(([, re]) => re.test(`/${f}`)).map(([m]) => m)),
    ),
  ];
  if (!present.length)
    return { mode: "none", reason: "só documentação", modules, lintFiles: [], testTargets: [] };
  return { mode: "incremental", modules, lintFiles: present, testTargets: present };
}
