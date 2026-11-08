// ACEITE-MINUTA: Configurações → Fluxos de aprovação → Minuta de contrato.
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Save, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, FormSection, EmptyState, Skeletons } from "@/components/techhire/ui";
import { usePermissions } from "@/lib/access-control/use-permissions";
import {
  getContractDraftApprovers,
  setContractDraftApprovers,
} from "@/lib/contracts/contract-drafts.functions";

const MANAGE_KEY = "techcontracts.contract_draft_approvers.manage.workspace";

export function ContractDraftApproversPage() {
  const p = usePermissions();
  if (p.isLoading)
    return (
      <p className="p-6" role="status">
        Verificando acesso…
      </p>
    );
  if (!p.workspaceId || !p.can(MANAGE_KEY))
    return (
      <p className="p-6" role="alert">
        Você não tem permissão para configurar aprovadores jurídicos.
      </p>
    );
  return <ApproversForm key={p.workspaceId} />;
}

function ApproversForm() {
  const qc = useQueryClient();
  const getFn = useServerFn(getContractDraftApprovers);
  const setFn = useServerFn(setContractDraftApprovers);
  const q = useQuery({ queryKey: ["contract-draft-approvers"], queryFn: () => getFn() });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  useEffect(() => {
    if (q.data) setSelected(new Set(q.data.selected));
  }, [q.data]);
  const save = useMutation({
    mutationFn: () => setFn({ data: { userIds: [...selected] } }),
    onSuccess: (r) => {
      toast.success(`Aprovadores salvos (${r.count}).`);
      void qc.invalidateQueries({ queryKey: ["contract-draft-approvers"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
  });

  type Member = { id: string; name: string; role: string };
  const members = ((q.data?.members ?? []) as Member[]).filter((m) =>
    m.name.toLowerCase().includes(filter.trim().toLowerCase()),
  );
  const changed =
    !!q.data &&
    (selected.size !== q.data.selected.length || q.data.selected.some((id) => !selected.has(id)));

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <PageHeader
        eyebrow="Fluxos de aprovação"
        title="Minuta de contrato"
        description="Quem revisa e aprova a minuta enviada ao cliente depois que ele aceita a proposta. Cada aprovador também precisa da permissão “Aprovar minuta de contrato” no cargo."
        primaryAction={
          <Button
            onClick={() => save.mutate()}
            disabled={!changed || save.isPending || selected.size > 20}
          >
            {save.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar aprovadores
          </Button>
        }
      />
      {q.isLoading ? (
        <div role="status" aria-label="Carregando membros">
          <Skeletons.Row />
          <Skeletons.Row />
          <Skeletons.Row />
        </div>
      ) : q.isError ? (
        <div className="space-y-3" role="alert">
          <p>Não foi possível carregar os membros.</p>
          <Button variant="outline" onClick={() => q.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : (
        <FormSection
          title="Aprovadores jurídicos"
          description={`${selected.size} selecionado(s), máximo 20. Sem aprovador, o responsável do workflow é avisado para configurar.`}
        >
          <div className="space-y-1">
            <Label htmlFor="approver-filter">Buscar membro</Label>
            <Input
              id="approver-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Nome"
            />
          </div>
          {members.length === 0 ? (
            <EmptyState icon={Scale} title="Nenhum membro encontrado" compact />
          ) : (
            <ul className="max-h-[420px] divide-y divide-border overflow-auto rounded-md border border-border">
              {members.map((m) => {
                const cid = `approver-${m.id}`;
                return (
                  <li key={m.id} className="flex items-center gap-3 px-3 py-2">
                    <Checkbox
                      id={cid}
                      checked={selected.has(m.id)}
                      onCheckedChange={(v) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (v) next.add(m.id);
                          else next.delete(m.id);
                          return next;
                        })
                      }
                    />
                    <Label htmlFor={cid} className="flex-1 cursor-pointer font-normal">
                      {m.name}
                    </Label>
                  </li>
                );
              })}
            </ul>
          )}
        </FormSection>
      )}
    </div>
  );
}
