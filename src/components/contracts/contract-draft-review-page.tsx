// ACEITE-MINUTA: tela "Revisar minuta" do aprovador jurídico.
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Check, Loader2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader, SectionHeader, EmptyState, Skeletons } from "@/components/techhire/ui";
import { WordEditor } from "@/components/word-editor-lazy";
import {
  getContractDraft,
  prepareContractDraftText,
  reopenContractDraft,
  getContractDraftVersion,
  getContractDraftTemplateBody,
  reviewContractDraft,
} from "@/lib/contracts/contract-drafts.functions";
import {
  CONTRACT_DRAFT_EVENT_LABEL,
  CONTRACT_DRAFT_STATUS_LABEL,
  canSendContractDraft,
  contractDraftHasText,
  isContractDraftReviewable,
  type ContractDraftStatus,
} from "@/lib/contracts/contract-draft-status";
import { ContractDraftSendPanel } from "@/components/contracts/contract-draft-send-panel";
import { usedTokens } from "@/lib/contracts/template-tokens";
import { sanitizeTemplateHtml } from "@/lib/contracts/template-html-format";
import { IsoDatePicker } from "@/components/iso-date-picker";
import { readViewAs } from "@/lib/view-as-client";
import { usePermissions } from "@/lib/access-control/use-permissions";

const VIEW_KEY = "techcontracts.contract_drafts.view.workspace";

export function ContractDraftReviewPage({
  id,
  embedded = false,
}: {
  id: string;
  embedded?: boolean;
}) {
  const p = usePermissions();
  if (p.isLoading)
    return (
      <p className="p-6" role="status">
        Verificando acesso…
      </p>
    );
  if (!p.can(VIEW_KEY))
    return (
      <p className="p-6" role="alert">
        Você não tem permissão para consultar minutas de contrato.
      </p>
    );
  return <DraftReview id={id} embedded={embedded} />;
}

function DraftReview({ id, embedded }: { id: string; embedded: boolean }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getContractDraft);
  const bodyFn = useServerFn(getContractDraftTemplateBody);
  const fillFn = useServerFn(prepareContractDraftText);
  const [missing, setMissing] = useState<string[]>([]);
  const [preparedTerms, setPreparedTerms] = useState<{
    number?: string;
    starts_at: string;
    ends_at: string | null;
  } | null>(null);
  const reviewFn = useServerFn(reviewContractDraft);
  const reopenFn = useServerFn(reopenContractDraft);
  const [reopen, setReopen] = useState(false);
  const [historicalRevision, setHistoricalRevision] = useState<number | null>(null);
  const versionFn = useServerFn(getContractDraftVersion);
  const historical = useQuery({
    queryKey: ["contract-draft-version", id, historicalRevision],
    enabled: historicalRevision !== null,
    queryFn: () => versionFn({ data: { draftId: id, revision: historicalRevision! } }),
  });
  const q = useQuery({ queryKey: ["contract-draft", id], queryFn: () => getFn({ data: { id } }) });
  const [body, setBody] = useState("");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [note, setNote] = useState("");
  const [loadingTpl, setLoadingTpl] = useState(false);

  useEffect(() => {
    if (q.data?.draft) {
      setBody(q.data.draft.body_html ?? "");
      setTemplateId(q.data.draft.template_id ?? null);
      setDirty(false);
      setPreparedTerms(q.data.draft.prepared_terms?.starts_at ? q.data.draft.prepared_terms : null);
    }
  }, [q.data?.draft?.id, q.data?.draft?.revision]); // eslint-disable-line react-hooks/exhaustive-deps

  const review = useMutation({
    mutationFn: (decision: "save" | "approve" | "reject") =>
      reviewFn({
        data: {
          id,
          revision: q.data!.draft.revision,
          decision,
          templateId,
          body: dirty || templateId !== q.data!.draft.template_id ? body : null,
          note: decision === "reject" ? note : null,
          preparedTerms,
        },
      }),
    onSuccess: (r) => {
      toast.success(
        r.status === "approved"
          ? "Envio da minuta aprovado."
          : r.status === "rejected"
            ? "Minuta recusada."
            : "Alterações salvas.",
      );
      setRejectOpen(false);
      setNote("");
      void qc.invalidateQueries({ queryKey: ["contract-draft", id] });
      void qc.invalidateQueries({ queryKey: ["deal-contracting-journey"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
  });

  async function fillFromProposal() {
    if (!templateId) return;
    setLoadingTpl(true);
    try {
      const r = await fillFn({ data: { draftId: id, templateId, body } });
      setBody(r.body);
      setPreparedTerms(r.preparedTerms);
      setMissing(r.missing);
      setDirty(true);
      toast.success(
        r.missing.length
          ? "Dados disponíveis preenchidos. Confira as pendências."
          : "Dados da proposta preenchidos. Revise antes de aprovar.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível preencher a minuta.");
    } finally {
      setLoadingTpl(false);
    }
  }
  async function switchTemplate(next: string) {
    setLoadingTpl(true);
    try {
      const r = await bodyFn({ data: { draftId: id, templateId: next } });
      setTemplateId(next);
      setBody(r.body);
      setDirty(true);
      toast.success("Modelo trocado. Revise o texto antes de aprovar.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível carregar o modelo.");
    } finally {
      setLoadingTpl(false);
    }
  }

  if (q.isLoading)
    return (
      <div className="p-6" role="status" aria-label="Carregando minuta">
        <Skeletons.Card />
      </div>
    );
  if (q.isError)
    return (
      <div className="space-y-3 p-6" role="alert">
        <p>Não foi possível carregar a minuta.</p>
        <Button variant="outline" onClick={() => q.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  if (!q.data)
    return (
      <div className="p-6">
        <EmptyState
          title="Minuta não encontrada"
          description="Ela não existe ou você não tem permissão para consultá-la."
        />
      </div>
    );

  const { draft, deal, canReview, templates, events, versions } = q.data;
  const status = draft.status as ContractDraftStatus;
  const reviewerWritable = canReview && !readViewAs()?.readOnly && readViewAs()?.mode !== "role";
  const editable = reviewerWritable && isContractDraftReviewable(status);
  const busy = review.isPending || loadingTpl;

  return (
    <div className={embedded ? "space-y-5" : "mx-auto max-w-6xl space-y-6 p-6"}>
      {!embedded && (
        <Button asChild variant="ghost" size="sm">
          <Link to="/contracts" search={{} as never}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Contratos
          </Link>
        </Button>
      )}
      <PageHeader
        eyebrow="Minuta de contrato"
        title={draft.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant={status === "rejected" ? "destructive" : "secondary"}>
              {CONTRACT_DRAFT_STATUS_LABEL[status] ?? status}
            </Badge>
            {deal && (
              <Link
                to="/deals/$id"
                params={{ id: deal.id }}
                className="text-sm underline-offset-4 hover:underline"
              >
                Negócio: {deal.name ?? "sem nome"}
              </Link>
            )}
          </span>
        }
        primaryAction={
          editable ? (
            <Button
              onClick={() => review.mutate("approve")}
              disabled={busy || !contractDraftHasText(body) || usedTokens(body).length > 0}
            >
              {review.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Aprovar envio
            </Button>
          ) : undefined
        }
        secondaryActions={
          editable ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => review.mutate("save")}
                disabled={busy || !dirty}
              >
                <Save className="mr-2 h-4 w-4" /> Salvar edição
              </Button>
              <Button variant="outline" onClick={() => setRejectOpen(true)} disabled={busy}>
                <X className="mr-2 h-4 w-4" /> Recusar
              </Button>
            </div>
          ) : undefined
        }
      />

      {!canReview && (
        <p
          className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground"
          role="note"
        >
          Somente os aprovadores jurídicos configurados podem editar e aprovar esta minuta.
        </p>
      )}
      {editable && templateId && (
        <div className="space-y-3 rounded-md border bg-muted/40 p-4">
          <p className="text-sm">
            Preencha as informações já existentes na proposta e nos cadastros, sem redigitar as
            condições comerciais.
          </p>
          <Button variant="outline" onClick={() => void fillFromProposal()} disabled={busy}>
            Preencher dados da proposta
          </Button>
          {missing.length > 0 && (
            <p role="alert" className="text-sm text-destructive">
              Complete os dados no cadastro de origem e tente novamente: {missing.join(", ")}.
            </p>
          )}
          {draft.proposal_id && (
            <Button variant="link" asChild>
              <Link to="/proposals/$id" params={{ id: draft.proposal_id }}>
                Conferir proposta e cadastro da empresa
              </Link>
            </Button>
          )}
        </div>
      )}
      {editable && preparedTerms && (
        <section className="space-y-3 rounded-md border p-4">
          <h3 className="text-sm font-medium">Vigência conferida na minuta</h3>
          <p className="text-xs text-muted-foreground">
            Confira se as datas abaixo correspondem ao texto antes de aprovar. Elas serão
            preservadas no contrato final.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Início</Label>
              <IsoDatePicker
                ariaLabel="Início da vigência da minuta"
                value={preparedTerms.starts_at}
                onChange={(v) => {
                  setPreparedTerms({ ...preparedTerms, starts_at: v ?? "" });
                  setDirty(true);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label>Término</Label>
              <IsoDatePicker
                ariaLabel="Término da vigência da minuta"
                value={preparedTerms.ends_at ?? ""}
                onChange={(v) => {
                  setPreparedTerms({ ...preparedTerms, ends_at: v ?? null });
                  setDirty(true);
                }}
              />
            </div>
          </div>
        </section>
      )}
      {draft.missing_template && editable && (
        <p
          className="flex items-center gap-2 rounded-md border border-border bg-muted p-3 text-sm"
          role="alert"
        >
          <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />O serviço da proposta
          não tem modelo padrão vinculado. Escolha um modelo abaixo.
        </p>
      )}
      {reviewerWritable && canSendContractDraft(status) && (
        <section className="space-y-2" aria-label="Envio ao cliente">
          <SectionHeader title="Enviar ao cliente" />
          <ContractDraftSendPanel
            draftId={draft.id}
            title={draft.title}
            dealId={draft.deal_id}
            sent={status === "sent"}
            onDone={() => q.refetch()}
          />
        </section>
      )}
      {draft.client_decided_at && (
        <p className="rounded-md border border-border bg-muted p-3 text-sm" role="note">
          {status === "accepted" ? "Aceita" : "Resposta"} por {draft.client_name ?? "cliente"} em{" "}
          {new Date(draft.client_decided_at).toLocaleString("pt-BR")}
          {draft.client_note ? ` — Ajustes pedidos: ${draft.client_note}` : ""}
        </p>
      )}
      {reviewerWritable && !editable && status !== "canceled" && (
        <div className="space-y-2 rounded-md border p-3">
          <p className="text-xs text-muted-foreground">
            Mudanças antes da contratação exigem nova revisão jurídica e novo aceite. O link
            anterior será revogado; contratos já criados exigem aditivo.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setNote("");
              setReopen(true);
            }}
          >
            Preparar nova revisão
          </Button>
        </div>
      )}
      {reopen && (
        <section className="space-y-3 rounded-md border p-4">
          <Label htmlFor="draft-reopen-note">Motivo da nova revisão</Label>
          <Textarea id="draft-reopen-note" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2">
            <Button
              disabled={busy || note.trim().length < 10}
              onClick={async () => {
                setLoadingTpl(true);
                try {
                  await reopenFn({ data: { id, revision: draft.revision, note } });
                  setReopen(false);
                  setNote("");
                  await q.refetch();
                  void qc.invalidateQueries({ queryKey: ["deal-contracting-journey"] });
                  toast.success(
                    "Nova revisão aberta. O aceite e o link anteriores foram revogados.",
                  );
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "Não foi possível abrir nova revisão.",
                  );
                } finally {
                  setLoadingTpl(false);
                }
              }}
            >
              Abrir nova revisão
            </Button>
            <Button variant="outline" onClick={() => setReopen(false)}>
              Cancelar
            </Button>
          </div>
        </section>
      )}
      {versions.length > 0 && (
        <details className="rounded-md border p-4">
          <summary className="cursor-pointer text-sm font-medium">
            Versões de texto preservadas ({versions.length})
          </summary>
          <p className="mt-3 text-xs text-muted-foreground">
            Revisões preservadas a partir da implantação desta jornada. O número inclui decisões e
            atualizações de conteúdo; não reconstrói versões antigas.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {versions.map((v: { revision: number }) => (
              <Button
                key={v.revision}
                variant="outline"
                size="sm"
                onClick={() => setHistoricalRevision(v.revision)}
              >
                Revisão {v.revision}
              </Button>
            ))}
          </div>
          {historicalRevision !== null && (
            <div className="prose mt-4 max-w-none border-t pt-4 dark:prose-invert">
              <h4>Texto preservado · revisão {historicalRevision}</h4>
              {historical.isLoading && <p role="status">Carregando versão…</p>}
              {historical.isError && <p role="alert">Não foi possível consultar esta versão.</p>}
              <div
                dangerouslySetInnerHTML={{
                  __html: sanitizeTemplateHtml(historical.data?.body_html ?? ""),
                }}
              />
            </div>
          )}
        </details>
      )}
      {draft.decision_note && (
        <p className="text-sm text-muted-foreground">Motivo informado: {draft.decision_note}</p>
      )}

      <div className={embedded ? "space-y-6" : "grid gap-6 lg:grid-cols-[1fr_280px]"}>
        <section className="space-y-3">
          <SectionHeader title="Texto da minuta" />
          {editable && (
            <div className="max-w-sm space-y-1">
              <Label htmlFor="draft-template">Modelo de contrato</Label>
              <Select
                value={templateId ?? undefined}
                onValueChange={switchTemplate}
                disabled={busy}
              >
                <SelectTrigger id="draft-template">
                  <SelectValue placeholder="Escolha um modelo" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {t.is_default ? " (padrão)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {editable ? (
            <WordEditor
              value={body}
              onChange={(html) => {
                setBody(html);
                setDirty(true);
              }}
              minHeight={480}
              placeholder="Texto da minuta…"
            />
          ) : (
            <div
              className="prose max-w-none rounded-md border border-border bg-card p-4 dark:prose-invert"
              // Corpo vem de modelo interno do workspace, gravado pelo jurídico.
              dangerouslySetInnerHTML={{
                __html: sanitizeTemplateHtml(draft.body_html || "<p>Sem texto.</p>"),
              }}
            />
          )}
        </section>
        <aside className="space-y-3">
          <SectionHeader title="Histórico" />
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem registros.</p>
          ) : (
            <ol className="space-y-3" aria-label="Histórico da minuta">
              {events.map(
                (e: { id: string; kind: string; actor_name: string; created_at: string }) => (
                  <li key={e.id} className="text-sm">
                    <p className="font-medium">{CONTRACT_DRAFT_EVENT_LABEL[e.kind] ?? e.kind}</p>
                    <p className="text-muted-foreground">
                      {e.actor_name} · {new Date(e.created_at).toLocaleString("pt-BR")}
                    </p>
                  </li>
                ),
              )}
            </ol>
          )}
        </aside>
      </div>

      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recusar minuta</AlertDialogTitle>
            <AlertDialogDescription>
              A minuta não será enviada ao cliente. Informe o motivo para o responsável do negócio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1">
            <Label htmlFor="reject-note">Motivo</Label>
            <Textarea
              id="reject-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={note.trim().length < 5 || review.isPending}
              onClick={(e) => {
                e.preventDefault();
                review.mutate("reject");
              }}
            >
              Recusar minuta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
