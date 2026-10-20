// Aba "Vínculos": empresas e pessoas canônicas. Só relação exata é aplicada sozinha;
// nome/ambíguo vira sugestão para confirmar ou recusar; desvincular reverte só o rastreado.
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, SectionHeader, Skeletons, StatusBadge } from "@/components/techhire/ui";
import {
  applyReconciliationExactLinks,
  decideReconciliationSuggestions,
  getReconciliationLinks,
  revertReconciliationLinks,
} from "@/lib/projects/reconciliation.functions";
import { PROVIDER_LABEL, type ReconProvider } from "@/lib/projects/reconciliation-labels";
import { NoteDialog } from "./note-dialog";

const CRITERION_LABEL: Record<string, string> = {
  name_exact: "Mesmo nome",
  email_ambiguous: "E-mail repetido (ambíguo)",
  source_conflict: "Origem e mapeamento divergem",
};
const BATCH_LABEL: Record<string, string> = {
  apply_exact: "Vínculos exatos",
  confirm_suggestion: "Sugestões confirmadas",
  reject_suggestion: "Sugestões recusadas",
  revert: "Desvinculação",
};
const COUNT_LABEL: Record<string, string> = {
  company_links: "empresas ligadas",
  person_links: "apontamentos com pessoa",
  allocation_links: "com alocação",
  suggestions_new: "novas sugestões",
  company_conflicts_new: "conflitos de empresa",
  person_exact_subjects: "usuários com e-mail único",
  person_ambiguous_subjects: "usuários ambíguos",
  confirmed: "confirmadas",
  rows_linked: "registros ligados",
  rejected: "recusadas",
  reverted: "desfeitos",
  skipped_changed_since: "mantidos (mudaram depois)",
};
const MEMBER_LABEL: Record<string, string> = {
  active: "Ativo",
  inactive: "Histórico (sem acesso)",
};

function toggle(set: Set<string>, id: string, on: boolean) {
  const n = new Set(set);
  if (on) n.add(id);
  else n.delete(id);
  return n;
}

export function ReconLinksTab() {
  const qc = useQueryClient();
  const get = useServerFn(getReconciliationLinks);
  const apply = useServerFn(applyReconciliationExactLinks);
  const decide = useServerFn(decideReconciliationSuggestions);
  const revert = useServerFn(revertReconciliationLinks);
  const q = useQuery({ queryKey: ["recon-links"], queryFn: () => get() });
  const [selSugg, setSelSugg] = useState<Set<string>>(new Set());
  const [selPeople, setSelPeople] = useState<Set<string>>(new Set());
  const [selProjects, setSelProjects] = useState<Set<string>>(new Set());
  const [decision, setDecision] = useState<"confirm" | "reject" | null>(null);
  const done = (msg: string) => {
    toast.success(msg);
    void qc.invalidateQueries({ queryKey: ["recon-links"] });
    void qc.invalidateQueries({ queryKey: ["recon-overview"] });
  };
  const mApply = useMutation({
    mutationFn: () => apply(),
    onSuccess: (r) =>
      done(
        `Vínculos exatos: ${r.company_links} empresas, ${r.person_links} apontamentos com pessoa, ${r.allocation_links} com alocação; ${r.suggestions_new} novas sugestões.`,
      ),
    onError: (e: Error) => toast.error(e.message),
  });
  const mDecide = useMutation({
    mutationFn: (v: { action: "confirm" | "reject"; note: string | null }) =>
      decide({ data: { ids: [...selSugg], ...v } }),
    onSuccess: () => {
      setSelSugg(new Set());
      setDecision(null);
      done("Decisão registrada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mRevert = useMutation({
    mutationFn: (v: { kind: "company" | "person"; subjectIds: string[] }) => revert({ data: v }),
    onSuccess: (r) => {
      setSelPeople(new Set());
      setSelProjects(new Set());
      done(
        `${r.reverted} vínculos desfeitos; ${r.skipped_changed_since} já tinham mudado e foram mantidos.`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const pending = useMemo(
    () => (q.data?.suggestions ?? []).filter((s) => s.status === "suggested"),
    [q.data],
  );
  if (q.isLoading) return <Skeletons.Card lines={8} />;
  if (q.isError || !q.data)
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Não foi possível carregar os vínculos"
        description={(q.error as Error | null)?.message ?? ""}
        action={<Button onClick={() => void q.refetch()}>Tentar novamente</Button>}
      />
    );
  const d = q.data;
  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-lg border border-border-subtle bg-surface-2 p-5 shadow-xs">
        <SectionHeader
          title="Vínculos exatos"
          description="Liga projeto à empresa já indicada pela origem (mesmo workspace e sem conflito) e apontamento à pessoa com e-mail único nos dois lados. Alocação só com pessoa, projeto e vigência inequívocos. Ninguém ganha login, convite ou permissão."
          action={
            <Button
              size="sm"
              disabled={mApply.isPending}
              onClick={async () => {
                const ok = await confirmDialog({
                  title: "Aplicar vínculos exatos?",
                  description:
                    "Só campos de vínculo mudam; duração, datas, situação e ids da origem ficam iguais. Tudo fica rastreado e pode ser desfeito.",
                  confirmLabel: "Aplicar",
                });
                if (ok) mApply.mutate();
              }}
            >
              <Link2 className="mr-2 h-4 w-4" aria-hidden />
              Aplicar vínculos exatos
            </Button>
          }
        />
        {d.batches.length > 0 ? (
          <ul className="space-y-0.5 text-xs text-text-secondary">
            {d.batches.slice(0, 6).map((b) => (
              <li key={b.id}>
                {new Date(b.created_at).toLocaleString("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}{" "}
                · {BATCH_LABEL[b.kind] ?? b.kind} ·{" "}
                {Object.entries((b.counts ?? {}) as Record<string, unknown>)
                  .map(([k, v]) => `${Number(v).toLocaleString("pt-BR")} ${COUNT_LABEL[k] ?? k}`)
                  .join(" · ")}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="space-y-3">
        <SectionHeader
          title="Sugestões para revisão"
          description="Mesmo nome ou e-mail repetido nunca vincula sozinho. Escolha um candidato por registro."
        />
        {selSugg.size > 0 ? (
          <div className="flex gap-2" role="region" aria-label="Ações nas sugestões">
            <Button size="sm" onClick={() => setDecision("confirm")}>
              Confirmar {selSugg.size}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDecision("reject")}>
              Recusar {selSugg.size}
            </Button>
          </div>
        ) : null}
        {pending.length === 0 ? (
          <EmptyState
            compact
            title="Nenhuma sugestão pendente"
            description="Aplique os vínculos exatos para gerar sugestões."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Tipo</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead>Candidato</TableHead>
                <TableHead>Critério</TableHead>
                <TableHead>Fonte</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Checkbox
                      aria-label={`Selecionar sugestão para ${s.subjectName ?? "registro"}`}
                      checked={selSugg.has(s.id)}
                      onCheckedChange={(c) => setSelSugg((x) => toggle(x, s.id, Boolean(c)))}
                    />
                  </TableCell>
                  <TableCell>{s.kind === "person" ? "Pessoa" : "Empresa"}</TableCell>
                  <TableCell className="max-w-48 truncate">{s.subjectName ?? "Sem nome"}</TableCell>
                  <TableCell className="max-w-48 truncate">
                    {s.candidateName ?? "Sem nome"}
                  </TableCell>
                  <TableCell>{CRITERION_LABEL[s.criterion] ?? s.criterion}</TableCell>
                  <TableCell>
                    {s.provider === "erp"
                      ? "Cadastro"
                      : (PROVIDER_LABEL[s.provider as ReconProvider] ?? s.provider)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeader
          title="Profissionais dos apontamentos"
          description="Pessoa do cadastro ligada aos apontamentos de cada usuário."
          action={
            selPeople.size > 0 ? (
              <Button
                size="sm"
                variant="outline"
                disabled={mRevert.isPending}
                onClick={() => mRevert.mutate({ kind: "person", subjectIds: [...selPeople] })}
              >
                Desvincular {selPeople.size}
              </Button>
            ) : undefined
          }
        />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Usuário</TableHead>
              <TableHead>Acesso</TableHead>
              <TableHead className="text-right">Apontamentos</TableHead>
              <TableHead className="text-right">Com pessoa</TableHead>
              <TableHead>Pessoa</TableHead>
              <TableHead className="text-right">Sugestões</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {d.people.map((p) => (
              <TableRow key={p.userId}>
                <TableCell>
                  <Checkbox
                    aria-label={`Selecionar ${p.userName ?? "usuário"}`}
                    disabled={p.linkedByTrace === 0}
                    checked={selPeople.has(p.userId)}
                    onCheckedChange={(c) => setSelPeople((x) => toggle(x, p.userId, Boolean(c)))}
                  />
                </TableCell>
                <TableCell className="max-w-48 truncate">{p.userName ?? "Sem nome"}</TableCell>
                <TableCell>{MEMBER_LABEL[p.memberStatus ?? ""] ?? "Fora do workspace"}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {p.entries.toLocaleString("pt-BR")}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {p.entriesWithPerson.toLocaleString("pt-BR")}
                </TableCell>
                <TableCell className="max-w-48 truncate">
                  {p.persons.length ? (
                    p.persons.map((x) => x.name ?? "Sem nome").join(", ")
                  ) : (
                    <StatusBadge status="onhold" label="Sem pessoa" />
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{p.suggestions}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="space-y-3">
        <SectionHeader
          title="Projetos e empresas"
          description="Empresa canônica do cliente de cada projeto."
          action={
            selProjects.size > 0 ? (
              <Button
                size="sm"
                variant="outline"
                disabled={mRevert.isPending}
                onClick={() => mRevert.mutate({ kind: "company", subjectIds: [...selProjects] })}
              >
                Desvincular {selProjects.size}
              </Button>
            ) : undefined
          }
        />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Projeto</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Empresa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {d.projects.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Checkbox
                    aria-label={`Selecionar ${p.name}`}
                    disabled={!p.companyId}
                    checked={selProjects.has(p.id)}
                    onCheckedChange={(c) => setSelProjects((x) => toggle(x, p.id, Boolean(c)))}
                  />
                </TableCell>
                <TableCell className="max-w-64 truncate">{p.name}</TableCell>
                <TableCell>{PROVIDER_LABEL[p.source as ReconProvider] ?? p.source}</TableCell>
                <TableCell className="max-w-64 truncate">
                  {p.companyName ?? <StatusBadge status="onhold" label="Sem empresa" />}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <NoteDialog
        open={decision !== null}
        title={
          decision === "confirm"
            ? `Confirmar ${selSugg.size} sugestões`
            : `Recusar ${selSugg.size} sugestões`
        }
        description="A decisão fica registrada com seu nome. Confirmar liga só os campos de vínculo e pode ser desfeito."
        requireNote={false}
        busy={mDecide.isPending}
        onCancel={() => setDecision(null)}
        onConfirm={(note) => decision && mDecide.mutate({ action: decision, note })}
      />
    </div>
  );
}
