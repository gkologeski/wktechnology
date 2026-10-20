// Aba "Negócios" da conciliação: ganhos sem projeto, candidatos explicados, vínculo exato auditado,
// prévia/lote com controle de concorrência, criação explícita do faltante e desfazer vínculos intactos.
import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  EmptyState,
  FilterBar,
  MetricCard,
  SectionHeader,
  Skeletons,
} from "@/components/techhire/ui";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  applyDeliveryHistory,
  applyExactDeliveryHistory,
  createMissingDeliveryProjects,
  getDeliveryHistory,
  previewDeliveryHistory,
  revertDeliveryHistory,
} from "@/lib/projects/deal-delivery.functions";
import { CRITERION_LABEL } from "@/lib/projects/deal-delivery-labels";
import type { PairPreview } from "@/lib/projects/deal-delivery-history.server";
import { NoteDialog } from "./note-dialog";
import { DealHistoryRow, type Pair } from "./recon-deals-row";
import { Pager } from "./pager";
import { PickProjectDialog, PreviewDialog } from "./recon-deals-dialogs";

const PAGE = 25;
const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—");

export function ReconDealsTab() {
  const qc = useQueryClient();
  const get = useServerFn(getDeliveryHistory);
  const preview = useServerFn(previewDeliveryHistory);
  const apply = useServerFn(applyDeliveryHistory);
  const exact = useServerFn(applyExactDeliveryHistory);
  const create = useServerFn(createMissingDeliveryProjects);
  const revert = useServerFn(revertDeliveryHistory);
  const [filter, setFilter] = useState<"missing" | "linked" | "all">("missing");
  const [q, setQ] = useState("");
  const dq = useDebouncedValue(q, 300);
  const [page, setPage] = useState(1);
  const [pairs, setPairs] = useState<Map<string, Pair>>(new Map());
  const [deals, setDeals] = useState<Set<string>>(new Set());
  const [pv, setPv] = useState<PairPreview[] | null>(null);
  const [pvOpen, setPvOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [revertId, setRevertId] = useState<string | null>(null);
  const [pick, setPick] = useState<{ id: string; name: string } | null>(null);

  const list = useQuery({
    queryKey: ["recon-deals", filter, dq, page],
    queryFn: () =>
      get({ data: { filter, q: dq || null, from: null, to: null, page, pageSize: PAGE } }),
    placeholderData: keepPreviousData,
  });
  const done = (msg: string) => {
    toast.success(msg);
    void qc.invalidateQueries({ queryKey: ["recon-deals"] });
  };
  const onErr = (e: Error) => toast.error(e.message);
  const mExact = useMutation({
    mutationFn: () => exact(),
    onSuccess: (r) =>
      done(`Vínculos exatos aplicados: ${r.linked}. Ignorados por conflito: ${r.skipped}.`),
    onError: onErr,
  });
  const mPreview = useMutation({
    mutationFn: () =>
      preview({
        data: {
          pairs: [...pairs.values()].map((p) => ({ dealId: p.dealId, projectId: p.projectId })),
        },
      }),
    onSuccess: (r) => setPv(r),
    onError: (e: Error) => {
      setPvOpen(false);
      onErr(e);
    },
  });
  const mApply = useMutation({
    mutationFn: (note: string) =>
      apply({
        data: {
          note,
          pairs: (pv ?? []).map((r) => ({
            dealId: r.deal_id,
            projectId: r.project_id,
            snapshot: r.snapshot ?? "",
            criterion: pairs.get(`${r.deal_id}:${r.project_id}`)?.criterion ?? "manual",
          })),
        },
      }),
    onSuccess: (r) => {
      setPvOpen(false);
      setPairs(new Map());
      done(`${r.linked} vínculo(s) confirmado(s) e auditado(s).`);
    },
    onError: onErr,
  });
  const mCreate = useMutation({
    mutationFn: (note: string) => create({ data: { dealIds: [...deals], note } }),
    onSuccess: (r) => {
      setCreateOpen(false);
      setDeals(new Set());
      done(`${r.created.length} projeto(s) faltante(s) criado(s) em planejamento.`);
    },
    onError: onErr,
  });
  const mRevert = useMutation({
    mutationFn: (v: { id: string; note: string }) =>
      revert({ data: { eventIds: [v.id], note: v.note } }),
    onSuccess: (r) => {
      setRevertId(null);
      done(r.reverted > 0 ? "Vínculo desfeito." : "Nada desfeito: o vínculo já tinha mudado.");
    },
    onError: onErr,
  });

  const togglePair = (p: Pair, on: boolean) =>
    setPairs((prev) => {
      const n = new Map(prev);
      const k = `${p.dealId}:${p.projectId}`;
      if (on) n.set(k, p);
      else n.delete(k);
      return n;
    });
  const toggleDeal = (id: string, on: boolean) =>
    setDeals((prev) => {
      const n = new Set(prev);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  const d = list.data;
  const pages = Math.max(1, Math.ceil((d?.total ?? 0) / PAGE));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Negócios ganhos"
          value={String(d?.summary.won ?? "—")}
          loading={list.isLoading}
        />
        <MetricCard
          label="Com projeto"
          value={String(d?.summary.with_project ?? "—")}
          loading={list.isLoading}
        />
        <MetricCard
          label="Sem projeto"
          value={String(d?.summary.missing ?? "—")}
          loading={list.isLoading}
          tone="warning"
        />
        <MetricCard
          label="Revisões abertas"
          value={String(d?.summary.reviews_open ?? "—")}
          loading={list.isLoading}
        />
      </div>

      <SectionHeader
        title="Negócios ganhos e projetos"
        description="Só chave exata (contrato ou serviço do negócio ligado ao projeto) é aplicada sem revisão. Mesma empresa é sugestão: confira horas, período e natureza antes de vincular. Hunting, recorrentes e aditivos aparecem sinalizados."
      />
      <FilterBar
        search={{
          value: q,
          onChange: (v) => {
            setQ(v);
            setPage(1);
          },
          placeholder: "Buscar negócio",
        }}
        chips={
          <Select
            value={filter}
            onValueChange={(v) => {
              setFilter(v as typeof filter);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-44" aria-label="Filtro de negócios">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="missing">Sem projeto</SelectItem>
              <SelectItem value="linked">Com projeto</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={mExact.isPending}
          onClick={async () => {
            const ok = await confirmDialog({
              title: "Aplicar vínculos exatos?",
              description:
                "Liga só pares com chave de origem exata e sem conflito. Cada vínculo fica auditado e pode ser desfeito.",
              confirmLabel: "Aplicar",
            });
            if (ok) mExact.mutate();
          }}
        >
          {mExact.isPending ? "Aplicando…" : "Aplicar vínculos exatos"}
        </Button>
        <Button
          size="sm"
          disabled={pairs.size === 0}
          onClick={() => {
            setPv(null);
            setPvOpen(true);
            mPreview.mutate();
          }}
        >
          Prévia e vincular ({pairs.size})
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={deals.size === 0 || deals.size > 25}
          onClick={() => setCreateOpen(true)}
        >
          Criar projeto faltante ({deals.size}/25)
        </Button>
      </div>

      {list.isLoading ? (
        <Skeletons.Card />
      ) : list.isError ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Não foi possível carregar os negócios.</p>
          <Button variant="outline" size="sm" onClick={() => void list.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : (d?.rows.length ?? 0) === 0 ? (
        <EmptyState title="Nada por aqui" description="Nenhum negócio ganho neste filtro." />
      ) : (
        <ul className="space-y-3" aria-label="Negócios ganhos">
          {d!.rows.map((r) => (
            <DealHistoryRow
              key={r.id}
              r={r}
              selected={deals.has(r.id)}
              pairs={pairs}
              manualPairs={[...pairs.values()]}
              onToggleDeal={(on) => toggleDeal(r.id, on)}
              onTogglePair={togglePair}
              onPick={() => setPick({ id: r.id, name: r.name })}
            />
          ))}
        </ul>
      )}
      {pages > 1 && (
        <Pager label={`${d?.total ?? 0} negócio(s)`} page={page} pages={pages} onPage={setPage} />
      )}

      {(d?.recent_links.length ?? 0) > 0 && (
        <div className="space-y-2">
          <SectionHeader
            title="Vínculos recentes"
            description="Desfazer remove só o vínculo, e só se ninguém o alterou depois."
          />
          <ul className="divide-y rounded-md border">
            {d!.recent_links.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <span>
                  {e.deal_name} → {e.project_name}{" "}
                  <span className="text-xs text-muted-foreground">
                    · {CRITERION_LABEL[e.criterion ?? "manual"] ?? e.criterion} ·{" "}
                    {fmtDate(e.created_at)}
                  </span>
                </span>
                {e.revertable && (
                  <Button size="sm" variant="ghost" onClick={() => setRevertId(e.id)}>
                    Desfazer
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <PreviewDialog
        open={pvOpen}
        rows={pv}
        loading={mPreview.isPending}
        busy={mApply.isPending}
        onCancel={() => setPvOpen(false)}
        onConfirm={(n) => mApply.mutate(n)}
      />
      <NoteDialog
        open={createOpen}
        title={`Criar ${deals.size} projeto(s) faltante(s)`}
        description="Cada negócio selecionado ganha 1 projeto em planejamento (ou um por entrega definida), sem contrato fictício, equipe, cobrança ou horas."
        requireNote
        busy={mCreate.isPending}
        onCancel={() => setCreateOpen(false)}
        onConfirm={(n) => n && mCreate.mutate(n)}
      />
      <NoteDialog
        open={revertId !== null}
        title="Desfazer vínculo"
        description="O projeto e as horas continuam; só a ligação com o negócio é removida."
        requireNote
        busy={mRevert.isPending}
        onCancel={() => setRevertId(null)}
        onConfirm={(n) => revertId && n && mRevert.mutate({ id: revertId, note: n })}
      />
      <PickProjectDialog
        dealId={pick?.id ?? null}
        dealName={pick?.name ?? null}
        onCancel={() => setPick(null)}
        onPick={(p) => {
          if (pick)
            togglePair(
              { dealId: pick.id, projectId: p.id, criterion: "manual", label: p.name },
              true,
            );
          setPick(null);
        }}
      />
    </div>
  );
}
