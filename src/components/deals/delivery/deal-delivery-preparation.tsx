// Bloco "Preparação da entrega" no negócio: situação, pendências, projetos ligados e ações.
// Abrir a tela só lê; criar, vincular, agrupar e reprocessar são sempre ações explícitas.
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, FolderPlus, Layers, Link2, RotateCw, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/techhire/ui";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { NoteDialog } from "@/components/projects/reconciliation/note-dialog";
import {
  createDeliveryProjectFromDeal,
  getDealDeliveryOverview,
  linkDeliveryProject,
  resolveDeliveryReview,
  retryDealDelivery,
  saveDeliveryGroups,
  unlinkDeliveryProject,
} from "@/lib/projects/deal-delivery.functions";
import {
  BLOCKING_PENDING,
  GROUP_DEFAULT,
  GROUP_NONE,
  JOB_STATUS_LABEL,
  LINK_LABEL,
  REVIEW_LABEL,
  SKIP_REASON_LABEL,
  deliveryHeadline,
  groupLabel,
  pendingLabel,
  type DeliveryOverview,
} from "@/lib/projects/deal-delivery-labels";
import { projectStatusLabel } from "@/lib/projects/delivery-labels";
import { LinkProjectDialog, type GroupOption } from "./link-project-dialog";
import { DeliveryGroupsDialog, type GroupSave } from "./delivery-groups-dialog";

const TONE_STATUS = {
  success: "open",
  warning: "onhold",
  danger: "closed",
  neutral: "draft",
} as const;

function missingGroups(o: DeliveryOverview): GroupOption[] {
  const taken = new Set(o.projects.map((p) => p.group_key));
  if (!o.groups_explicit)
    return taken.has(GROUP_DEFAULT) ? [] : [{ key: GROUP_DEFAULT, label: null }];
  const seen = new Map<string, string | null>();
  for (const i of o.items) {
    if (i.group_key && i.group_key !== GROUP_NONE && !taken.has(i.group_key))
      seen.set(i.group_key, i.group_label);
  }
  return [...seen].map(([key, label]) => ({ key, label }));
}

export function DealDeliveryPreparation({ dealId }: { dealId: string }) {
  const qc = useQueryClient();
  const get = useServerFn(getDealDeliveryOverview);
  const create = useServerFn(createDeliveryProjectFromDeal);
  const link = useServerFn(linkDeliveryProject);
  const unlink = useServerFn(unlinkDeliveryProject);
  const groups = useServerFn(saveDeliveryGroups);
  const retry = useServerFn(retryDealDelivery);
  const resolve = useServerFn(resolveDeliveryReview);
  const key = ["deal-delivery-overview", dealId];
  const q = useQuery({ queryKey: key, queryFn: () => get({ data: { dealId } }) });
  const [linkOpen, setLinkOpen] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [unlinkId, setUnlinkId] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ["deal-delivery", dealId] });
  };
  const onErr = (e: Error) => toast.error(e.message);
  const mCreate = useMutation({
    mutationFn: () => create({ data: { dealId, ownerId: null } }),
    onSuccess: (r) => {
      const n = r.results.filter((x) => x.action === "created").length;
      toast.success(
        n > 0
          ? `${n} projeto(s) criado(s) em planejamento.`
          : "O projeto já existia; nada duplicado.",
      );
      refresh();
    },
    onError: onErr,
  });
  const mLink = useMutation({
    mutationFn: (v: { projectId: string; group: string; note: string | null }) =>
      link({ data: { dealId, ...v } }),
    onSuccess: () => {
      toast.success("Projeto vinculado ao negócio.");
      setLinkOpen(false);
      refresh();
    },
    onError: onErr,
  });
  const mUnlink = useMutation({
    mutationFn: (v: { projectId: string; note: string }) => unlink({ data: { dealId, ...v } }),
    onSuccess: () => {
      toast.success("Vínculo removido. O projeto e as horas continuam intactos.");
      setUnlinkId(null);
      refresh();
    },
    onError: onErr,
  });
  const mGroups = useMutation({
    mutationFn: (items: GroupSave[]) => groups({ data: { dealId, items } }),
    onSuccess: () => {
      toast.success("Entregas salvas.");
      setGroupsOpen(false);
      refresh();
    },
    onError: onErr,
  });
  const mRetry = useMutation({
    mutationFn: () => retry({ data: { dealId } }),
    onSuccess: (r) => {
      if (r.job_status === "failed") toast.error(r.error ?? "A preparação falhou de novo.");
      else toast.success("Preparação reprocessada.");
      refresh();
    },
    onError: onErr,
  });
  const mReview = useMutation({
    mutationFn: (v: { eventId: string; note: string }) => resolve({ data: v }),
    onSuccess: () => {
      toast.success("Revisão registrada.");
      setReviewId(null);
      refresh();
    },
    onError: onErr,
  });

  const o = q.data;
  const missing = useMemo(() => (o ? missingGroups(o) : []), [o]);

  if (q.isLoading) {
    return (
      <div className="space-y-2" aria-busy="true">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }
  if (q.isError || !o) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar a preparação da entrega.
        </p>
        <Button variant="outline" size="sm" onClick={() => void q.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  const head = deliveryHeadline(o);
  const pending = o.pending.filter(
    (p) => p !== "no_contract" || o.projects.length > 0 || o.deal.stage_type === "won",
  );

  return (
    <section className="space-y-3" aria-label="Preparação da entrega">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={TONE_STATUS[head.tone]} label={head.text} />
        {o.job && (
          <span className="text-xs text-muted-foreground">
            Preparação: {JOB_STATUS_LABEL[o.job.status]}
            {o.job.skip_reason
              ? ` · ${SKIP_REASON_LABEL[o.job.skip_reason] ?? o.job.skip_reason}`
              : ""}
            {o.job.status === "failed"
              ? ` · tentativa ${o.job.attempts}/${o.job.max_attempts}`
              : ""}
          </span>
        )}
      </div>

      {o.job?.status === "failed" && o.job.last_error && (
        <p className="flex items-start gap-1.5 text-sm text-destructive" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {o.job.last_error}
        </p>
      )}

      {pending.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Pendências da entrega">
          {pending.map((p) => (
            <li key={p}>
              <StatusBadge
                status={BLOCKING_PENDING.has(p) ? "onhold" : "draft"}
                label={pendingLabel(p)}
              />
            </li>
          ))}
        </ul>
      )}

      {o.reviews.length > 0 && (
        <ul className="space-y-1.5" aria-label="Revisões pendentes">
          {o.reviews.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <span>{REVIEW_LABEL[r.kind] ?? r.kind}</span>
              {o.can.link && (
                <Button variant="ghost" size="sm" onClick={() => setReviewId(r.id)}>
                  Registrar revisão
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {o.projects.length > 0 && (
        <ul className="divide-y rounded-md border" aria-label="Projetos de entrega">
          {o.projects.map((p) => (
            <li key={p.id} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                {p.visible ? (
                  <Link
                    to="/projects/$id"
                    params={{ id: p.id }}
                    className="text-sm font-medium hover:underline"
                  >
                    {p.name}
                  </Link>
                ) : (
                  <span className="text-sm font-medium">{p.name}</span>
                )}
                <p className="text-xs text-muted-foreground">
                  {projectStatusLabel(p.status)} · {groupLabel(p.group_key)} · {LINK_LABEL[p.link]}{" "}
                  · Responsável: {p.assigned_name ?? "não definido"}
                  {p.has_contract ? " · com contrato" : " · sem contrato"}
                </p>
                {!p.visible && (
                  <p className="text-xs text-muted-foreground">
                    Você não tem acesso ao projeto no TechProjects.
                  </p>
                )}
              </div>
              {o.can.link && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setUnlinkId(p.id)}
                  aria-label={`Desvincular ${p.name}`}
                >
                  <Unlink className="mr-1 h-3.5 w-3.5" /> Desvincular
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        {o.can.retry && (
          <Button
            size="sm"
            variant="outline"
            disabled={mRetry.isPending}
            onClick={() => mRetry.mutate()}
          >
            <RotateCw className="mr-1 h-3.5 w-3.5" />{" "}
            {mRetry.isPending ? "Reprocessando…" : "Reprocessar"}
          </Button>
        )}
        {o.can.create && missing.length > 0 && (
          <Button
            size="sm"
            disabled={mCreate.isPending}
            onClick={async () => {
              const ok = await confirmDialog({
                title: "Criar projeto de entrega?",
                description:
                  missing.length > 1
                    ? `Serão criados ${missing.length} projetos em planejamento, um por entrega.`
                    : "Será criado 1 projeto em planejamento ligado a este negócio, sem ativar equipe, cobrança ou contrato.",
                confirmLabel: "Criar",
              });
              if (ok) mCreate.mutate();
            }}
          >
            <FolderPlus className="mr-1 h-3.5 w-3.5" />{" "}
            {mCreate.isPending ? "Criando…" : "Criar projeto"}
          </Button>
        )}
        {o.can.link && missing.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => setLinkOpen(true)}>
            <Link2 className="mr-1 h-3.5 w-3.5" /> Vincular existente
          </Button>
        )}
        {o.can.groups && o.items.length > 0 && o.policy.allow_groups && (
          <Button size="sm" variant="ghost" onClick={() => setGroupsOpen(true)}>
            <Layers className="mr-1 h-3.5 w-3.5" /> Entregas por item
          </Button>
        )}
      </div>

      <LinkProjectDialog
        open={linkOpen}
        dealId={dealId}
        groups={missing}
        busy={mLink.isPending}
        onCancel={() => setLinkOpen(false)}
        onConfirm={(v) => mLink.mutate(v)}
      />
      <DeliveryGroupsDialog
        open={groupsOpen}
        items={o.items}
        busy={mGroups.isPending}
        onCancel={() => setGroupsOpen(false)}
        onSave={(rows) => mGroups.mutate(rows)}
      />
      <NoteDialog
        open={unlinkId !== null}
        title="Desvincular projeto"
        description="Remove só o vínculo com este negócio. O projeto, as horas e o contrato continuam como estão."
        requireNote
        busy={mUnlink.isPending}
        onCancel={() => setUnlinkId(null)}
        onConfirm={(n) => unlinkId && n && mUnlink.mutate({ projectId: unlinkId, note: n })}
      />
      <NoteDialog
        open={reviewId !== null}
        title="Registrar revisão"
        description="Descreva o que foi decidido. Nada é alterado automaticamente no projeto."
        requireNote
        busy={mReview.isPending}
        onCancel={() => setReviewId(null)}
        onConfirm={(n) => reviewId && n && mReview.mutate({ eventId: reviewId, note: n })}
      />
    </section>
  );
}
