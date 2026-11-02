import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/lib/access-control/use-permissions";
import {
  createProspectingSequenceVersion,
  preflightProspectingSequence,
  listProspectingSequenceVersions,
} from "@/lib/prospecting/sequences/drafts.functions";
import type { SequenceDraft } from "@/lib/prospecting/sequences/draft";
export function SequenceReadiness({ row, disabled }: { row: SequenceDraft; disabled: boolean }) {
  const permissions = usePermissions(),
    cache = useQueryClient();
  const check = useServerFn(preflightProspectingSequence),
    create = useServerFn(createProspectingSequenceVersion),
    list = useServerFn(listProspectingSequenceVersions);
  const [report, setReport] = useState<Awaited<ReturnType<typeof check>> | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const versions = useQuery({
    queryKey: ["sequence-versions", row.workspace_id, row.id, row.revision],
    enabled: row.revision > 0 && !permissions.isLoading && !permissions.isError,
    queryFn: () =>
      list({ data: { workspaceId: row.workspace_id, id: row.id, expectedRevision: row.revision } }),
  });
  const canManage =
    !permissions.isLoading &&
    !permissions.isError &&
    permissions.canAny(
      ["own", "team", "workspace"].map((s) => `system.automation.sequences.manage.${s}`),
    );
  const run = async (version: boolean) => {
    if (disabled || busy || row.revision < 1 || (version && !canManage)) return;
    setBusy(true);
    setError("");
    try {
      const data = { workspaceId: row.workspace_id, id: row.id, expectedRevision: row.revision };
      if (version) {
        const result = await create({ data });
        toast.success(
          `Versão da revisão ${result.draft_revision} criada. Nenhum contato iniciado.`,
        );
        await cache.invalidateQueries({
          queryKey: ["sequence-versions", row.workspace_id, row.id],
        });
      } else setReport(await check({ data }));
    } catch {
      setReport(null);
      setError(
        "Não foi possível concluir. Confira suas permissões, as conexões e se o rascunho foi alterado em outra sessão.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className="space-y-3 rounded-lg border bg-card p-4"
      aria-label="Validação e versões da sequência"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          disabled={disabled || busy || row.revision < 1}
          onClick={() => void run(false)}
        >
          {busy ? "Verificando…" : "Validar configuração salva"}
        </Button>
        <Button
          variant="outline"
          disabled={disabled || busy || !canManage || !report?.configurationValid}
          onClick={() => void run(true)}
        >
          Criar versão imutável
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Salve as alterações antes de validar. A versão preserva a configuração desta revisão; não
        ativa a sequência nem inscreve pessoas. Conexões, permissões e modelos serão verificados
        novamente antes dos disparos.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {!disabled && report && (
        <div aria-live="polite" className="space-y-2 text-sm">
          <p className="font-medium">
            {report.configurationValid
              ? "Configuração conferida para criar uma versão."
              : `${report.issues.length} pendência(s) na configuração salva.`}
          </p>
          {report.issues.map((issue, i) => (
            <p key={`${issue.stepId}-${issue.code}-${i}`} className="text-destructive">
              {issue.stepId
                ? `${row.definition.steps.find((s) => s.id === issue.stepId)?.title || "Etapa"}: `
                : ""}
              {issue.message}
            </p>
          ))}
        </div>
      )}
      {versions.isError ? (
        <p className="text-xs text-destructive">
          Não foi possível carregar o histórico de versões.
        </p>
      ) : versions.data && versions.data.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-sm font-medium">
            Versões de configuração ({versions.data.length}
            {versions.data.length === 25 ? "+" : ""})
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {versions.data.map((v) => (
              <li key={v.id}>
                Revisão {v.draft_revision} · {v.name} ·{" "}
                {new Intl.DateTimeFormat("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(new Date(v.created_at))}
              </li>
            ))}
          </ul>
        </details>
      ) : (
        <p className="text-xs text-muted-foreground">
          {row.revision < 1
            ? "Salve o rascunho para criar versões."
            : versions.isPending
              ? "Carregando versões…"
              : "Nenhuma versão criada."}
        </p>
      )}
    </section>
  );
}
