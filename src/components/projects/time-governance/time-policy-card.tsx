import { usePermissions } from "@/lib/access-control/use-permissions";
// Política de horas do workspace (versionada). Cada salvamento cria uma nova versão auditada;
// envios e fechamentos guardam a versão em vigor.
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { SectionHeader, EmptyState, RowSkeleton } from "@/components/techhire/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getTimePolicy, saveTimePolicy } from "@/lib/projects/time-governance.functions";
import type { TimePolicy } from "@/lib/projects/time-workflow.types";

const BOOLS: { key: keyof TimePolicy; label: string; hint: string }[] = [
  {
    key: "track_requires_link",
    label: "Apontar exige vínculo",
    hint: "Só membros liberados ou pessoas com alocação vigente no projeto.",
  },
  {
    key: "duration_entries_allowed",
    label: "Permitir lançamento só por duração",
    hint: "Sem horário; marcado como sobreposição não verificável.",
  },
  {
    key: "submit_blocks_on_overlap",
    label: "Sobreposição bloqueia o envio",
    hint: "Apontamentos sobrepostos precisam ser corrigidos antes.",
  },
  {
    key: "submit_requires_approver",
    label: "Envio exige aprovador nomeado",
    hint: "Projeto sem aprovador fica com pendência acionável.",
  },
  {
    key: "closing_requires_client_acceptance",
    label: "Fechamento exige aceite (quando o projeto pede)",
    hint: "Vale só para projetos com aceite do cliente ligado.",
  },
  {
    key: "paid_break_counts_as_presence",
    label: "Pausa paga conta como presença",
    hint: "Informativo para TechPeople; nunca vira hora de projeto.",
  },
  {
    key: "paid_break_counts_as_productive",
    label: "Pausa paga conta como hora produtiva",
    hint: "Padrão desligado: presença não é esforço no projeto.",
  },
  {
    key: "allow_self_approval",
    label: "Permitir autoaprovação",
    hint: "Padrão desligado. Mesmo ligado, exige ser aprovador nomeado.",
  },
];

export function TimePolicyCard() {
  const { can } = usePermissions();
  const qc = useQueryClient();
  const getFn = useServerFn(getTimePolicy);
  const saveFn = useServerFn(saveTimePolicy);
  const q = useQuery({ queryKey: ["time-policy"], queryFn: () => getFn() });
  const [draft, setDraft] = useState<TimePolicy | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (q.data) setDraft(q.data.policy);
  }, [q.data]);

  const save = useMutation({
    mutationFn: () => {
      const { version: _v, saved_at: _s, ...rules } = draft!;
      return saveFn({
        data: { rules: rules as Record<string, boolean | number>, note: note.trim() || undefined },
      });
    },
    onSuccess: (r) => {
      toast.success(`Política salva (versão ${r.version})`);
      setNote("");
      void qc.invalidateQueries({ queryKey: ["time-policy"] });
      void qc.invalidateQueries({ queryKey: ["trackable-projects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <SectionHeader
        title="Política de horas"
        description={
          q.data
            ? q.data.policy.version > 0
              ? `Versão ${q.data.policy.version} em vigor.`
              : "Usando os padrões do sistema (nenhuma versão salva ainda)."
            : "Regras de apontamento, envio, aprovação e fechamento."
        }
      />
      {q.isLoading || !draft ? (
        q.isError ? (
          <EmptyState title="Não foi possível carregar" description={(q.error as Error).message} />
        ) : (
          <RowSkeleton />
        )
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            {BOOLS.map((b) => (
              <div key={b.key} className="flex items-start gap-3 rounded-md border p-3">
                <Switch
                  id={`pol-${b.key}`}
                  checked={!!draft[b.key]}
                  onCheckedChange={(v) => setDraft({ ...draft, [b.key]: v })}
                />
                <div>
                  <Label htmlFor={`pol-${b.key}`}>{b.label}</Label>
                  <p className="text-xs text-muted-foreground">{b.hint}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="pol-max">Limite diário para alerta (horas)</Label>
              <Input
                id="pol-max"
                type="number"
                min={1}
                max={24}
                value={Math.round(draft.max_daily_seconds / 3600)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    max_daily_seconds:
                      Math.max(1, Math.min(24, Number(e.target.value) || 1)) * 3600,
                  })
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pol-alloc">Alocação máxima sem justificativa (%)</Label>
              <Input
                id="pol-alloc"
                type="number"
                min={1}
                max={300}
                value={draft.allocation_max_pct}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    allocation_max_pct: Math.max(1, Math.min(300, Number(e.target.value) || 100)),
                  })
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pol-note">Motivo da mudança</Label>
              <Input id="pol-note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <Button
            disabled={save.isPending || !can("techprojects.time_policy.manage.workspace")}
            onClick={() => save.mutate()}
          >
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar nova versão
          </Button>
          {(q.data?.history ?? []).length > 0 && (
            <ul className="text-xs text-muted-foreground">
              {q.data!.history.map((h) => (
                <li key={h.version}>
                  v{h.version} · {new Date(h.created_at).toLocaleString("pt-BR")}
                  {h.note ? ` · ${h.note}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
