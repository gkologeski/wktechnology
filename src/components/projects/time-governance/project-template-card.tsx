// Modelo de entrega sugerido pelo serviço do projeto. Só aplica por ação explícita; em projeto
// com histórico importado pede confirmação extra. Nunca reclassifica nem apaga o que existe.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { SectionHeader, RowSkeleton } from "@/components/techhire/ui";
import { Button } from "@/components/ui/button";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  applyDeliveryTemplate,
  getProjectTemplateSuggestion,
} from "@/lib/projects/time-governance.functions";
import { TEMPLATE_KIND_LABEL, describeTemplate } from "@/lib/projects/delivery-template.shared";

export function ProjectTemplateCard({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const suggestFn = useServerFn(getProjectTemplateSuggestion);
  const applyFn = useServerFn(applyDeliveryTemplate);

  const q = useQuery({
    queryKey: ["project-template", projectId],
    queryFn: () => suggestFn({ data: { projectId } }),
  });
  const apply = useMutation({
    mutationFn: (v: { versionId: string; confirmImported: boolean }) =>
      applyFn({ data: { projectId, ...v } }),
    onSuccess: (r) => {
      toast.success(
        r.already_applied
          ? "Modelo já estava aplicado"
          : `Modelo aplicado: ${r.milestones} marco(s), ${r.tasks} tarefa(s)`,
      );
      void qc.invalidateQueries({ queryKey: ["project-template", projectId] });
      void qc.invalidateQueries({ queryKey: ["project", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const d = q.data;
  const s = d?.suggestion;

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <SectionHeader
        title="Modelo de entrega"
        description="Sugerido pelo serviço do catálogo ligado ao projeto. Aplicar cria marcos e tarefas iniciais uma única vez; nada é removido."
      />
      {q.isLoading ? (
        <RowSkeleton />
      ) : q.isError ? (
        <p className="text-sm text-muted-foreground">{(q.error as Error).message}</p>
      ) : d?.applied_version_id ? (
        <p className="text-sm">
          Modelo aplicado em{" "}
          {d.applied_at ? new Date(d.applied_at).toLocaleDateString("pt-BR") : "—"}.
        </p>
      ) : !d?.service_catalog_id ? (
        <p className="text-sm text-muted-foreground">
          Projeto sem serviço do catálogo: nenhum modelo sugerido.
        </p>
      ) : !s ? (
        <p className="text-sm text-muted-foreground">
          Nenhum modelo ativo para o serviço deste projeto.
        </p>
      ) : (
        <div className="space-y-2 text-sm">
          <p>
            <span className="font-medium">{s.name}</span> · {TEMPLATE_KIND_LABEL[s.kind] ?? s.kind}{" "}
            · v{s.version}
          </p>
          <p className="text-muted-foreground">{describeTemplate(s.definition)}</p>
          {d.imported_entries > 0 && (
            <p className="text-muted-foreground" role="status">
              Este projeto tem {d.imported_entries} apontamento(s) importados e {d.tasks} tarefa(s):
              o histórico não é reclassificado.
            </p>
          )}
          <Button
            size="sm"
            disabled={apply.isPending}
            onClick={() =>
              void confirmDialog({
                title: "Aplicar o modelo de entrega?",
                description:
                  d.imported_entries > 0
                    ? "O projeto já tem histórico importado. Os marcos e tarefas do modelo serão acrescentados sem mexer no que existe."
                    : "Os marcos e tarefas do modelo serão criados neste projeto.",
                confirmLabel: "Aplicar",
              }).then(
                (ok) =>
                  ok &&
                  apply.mutate({
                    versionId: s.version_id,
                    confirmImported: d.imported_entries > 0,
                  }),
              )
            }
          >
            {apply.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Aplicar modelo
          </Button>
        </div>
      )}
    </section>
  );
}
