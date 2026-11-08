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
import { usePermissions } from "@/lib/access-control/use-permissions";

const VIEW_KEY = "techcontracts.contract_drafts.view.workspace";

export function ContractDraftReviewPage({ id }: { id: string }) {
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
  return <DraftReview id={id} />;
}

function DraftReview({ id }: { id: string }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getContractDraft);
  const bodyFn = useServerFn(getContractDraftTemplateBody);
  const reviewFn = useServerFn(reviewContractDraft);
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
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
  });

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

  const { draft, deal, canReview, templates, events } = q.data;
  const status = draft.status as ContractDraftStatus;
  const editable = canReview && isContractDraftReviewable(status);
  const busy = review.isPending || loadingTpl;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/contracts" search={{} as never}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Contratos
        </Link>
      </Button>
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
              disabled={busy || !contractDraftHasText(body)}
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
      {draft.missing_template && editable && (
        <p
          className="flex items-center gap-2 rounded-md border border-border bg-muted p-3 text-sm"
          role="alert"
        >
          <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />O serviço da proposta
          não tem modelo padrão vinculado. Escolha um modelo abaixo.
        </p>
      )}
      {canReview && canSendContractDraft(status) && (
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
      {draft.decision_note && (
        <p className="text-sm text-muted-foreground">Motivo informado: {draft.decision_note}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
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
              dangerouslySetInnerHTML={{ __html: draft.body_html || "<p>Sem texto.</p>" }}
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
