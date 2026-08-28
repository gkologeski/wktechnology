import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  getProposal,
  updateProposal,
  sendProposal,
  requestProposalApproval,
  decideProposalApproval,
  listClauses,
} from "@/lib/proposals.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyCommitInput } from "@/components/ui/currency-commit-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { sanitizeHtml } from "@/components/rich-html-editor";
import { WordEditor, type WordEditorHandle } from "@/components/word-editor-lazy";
import { useRef } from "react";
import { renderTokens } from "@/lib/message-tokens";
import { ArrowLeft, Save, Send, ShieldCheck, Lock, FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/proposals/$id")({
  component: ProposalEditor,
});

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  in_review: "Em revisão",
  approved: "Aprovada",
  sent: "Enviada",
  accepted: "Aceita",
  rejected: "Recusada",
  expired: "Expirada",
  canceled: "Cancelada",
};

function ProposalEditor() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const get = useServerFn(getProposal);
  const update = useServerFn(updateProposal);
  const send = useServerFn(sendProposal);
  const req = useServerFn(requestProposalApproval);
  const decide = useServerFn(decideProposalApproval);
  const lcl = useServerFn(listClauses);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["proposal", id],
    queryFn: () => get({ data: { id } }),
    retry: 1,
  });
  const { data: clauses } = useQuery({ queryKey: ["clauses"], queryFn: () => lcl() });
  const prop = data?.proposal;
  const approvals = data?.approvals ?? [];

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const editorRef = useRef<WordEditorHandle>(null);

  const insertIntoEditor = (html: string) => {
    if (editorRef.current) editorRef.current.insertHtml(html);
    else setBody((b) => b + html);
  };

  useEffect(() => {
    if (prop) {
      setTitle(prop.title);
      setBody(prop.body);
      setAmount(prop.total_amount != null ? String(prop.total_amount) : "");
    }
  }, [prop]);

  const locked = prop?.locked;

  const saveM = useMutation({
    mutationFn: () =>
      update({
        data: { id, patch: { title, body, total_amount: amount ? Number(amount) : null } },
      }),
    onSuccess: () => {
      toast.success("Salvo");
      qc.invalidateQueries({ queryKey: ["proposal", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const sendM = useMutation({
    mutationFn: () => send({ data: { id } }),
    onSuccess: (r) => {
      toast.success(`Contrato enviada. Hash: ${r.contentHash?.slice(0, 12)}…`);
      qc.invalidateQueries({ queryKey: ["proposal", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const reqM = useMutation({
    mutationFn: () => req({ data: { proposalId: id, comment } }),
    onSuccess: () => {
      toast.success("Aprovação solicitada");
      setComment("");
      qc.invalidateQueries({ queryKey: ["proposal", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const decideM = useMutation({
    mutationFn: (vars: { approvalId: string; decision: "approved" | "rejected" }) =>
      decide({ data: { approvalId: vars.approvalId, decision: vars.decision, comment } }),
    onSuccess: () => {
      toast.success("Decisão registrada");
      setComment("");
      qc.invalidateQueries({ queryKey: ["proposal", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const previewHtml = useMemo(() => {
    if (!prop) return "";
    const ctx = {
      first_name: null,
      last_name: null,
      full_name: null,
      email: null,
      company: null,
    };
    // Replace standard tokens; rendering richer tokens (deal/contact/company) requires fetching those — kept minimal here.
    return sanitizeHtml(renderTokens(body || "", ctx));
  }, [body, prop]);

  const insertClause = (clauseBody: string) => {
    if (locked) return;
    insertIntoEditor(`<hr/>${clauseBody}`);
  };

  if (isLoading)
    return <div className="p-6 text-sm text-muted-foreground">Carregando proposta…</div>;
  if (isError)
    return (
      <div className="p-6 space-y-3">
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">Não foi possível carregar a proposta.</p>
          <p className="text-muted-foreground mt-1">
            {(error as Error)?.message ?? "Erro desconhecido"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/proposals">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Link>
          </Button>
          <Button onClick={() => refetch()}>Tentar novamente</Button>
        </div>
      </div>
    );
  if (!prop)
    return (
      <div className="p-6 space-y-3">
        <p className="text-sm text-muted-foreground">Contrato não encontrada.</p>
        <Button variant="outline" asChild>
          <Link to="/proposals">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para propostas
          </Link>
        </Button>
      </div>
    );

  return (
    <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/proposals">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-semibold">{prop.title}</h1>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">v{prop.version}</Badge>
                <Badge>{STATUS_LABEL[prop.status]}</Badge>
                {locked && (
                  <span className="flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    Imutável
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => saveM.mutate()}
              disabled={locked || saveM.isPending}
            >
              <Save className="mr-2 h-4 w-4" />
              Salvar
            </Button>
            {prop.status === "draft" && (
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="secondary">
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Solicitar aprovação
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Solicitar aprovação interna</SheetTitle>
                  </SheetHeader>
                  <div className="space-y-3 pt-4">
                    <Label>Comentário</Label>
                    <Textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={4}
                    />
                    <Button onClick={() => reqM.mutate()} disabled={reqM.isPending}>
                      Enviar para revisão
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            )}
            {(prop.status === "approved" || prop.status === "draft") && (
              <Button onClick={() => sendM.mutate()} disabled={sendM.isPending}>
                <Send className="mr-2 h-4 w-4" />
                Enviar e selar
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Conteúdo da proposta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Título</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={!!locked}
                />
              </div>
              <div className="space-y-1">
                <Label>Valor (BRL)</Label>
                <CurrencyCommitInput
                  currency="BRL"
                  value={amount === "" ? null : Number(amount)}
                  onCommit={(n) => setAmount(n === null ? "" : String(n))}
                  disabled={!!locked}
                />
              </div>
            </div>
            {locked ? (
              <div
                className="rounded-md border bg-muted/30 p-3 text-sm"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(body) }}
              />
            ) : (
              <WordEditor
                ref={editorRef}
                value={body}
                onChange={setBody}
                minHeight={400}
                placeholder="Escreva sua proposta… use {{deal.amount}}, {{contact.name}}, etc."
              />
            )}
            <div className="text-xs text-muted-foreground">
              Pré-visualização (tokens simples):{" "}
              <span
                className="ml-2 inline-block"
                dangerouslySetInnerHTML={{ __html: previewHtml.slice(0, 200) }}
              />
            </div>
          </CardContent>
        </Card>

        {approvals.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Aprovações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {approvals.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-md border p-2 text-sm"
                >
                  <div>
                    <Badge
                      variant={
                        a.status === "approved"
                          ? "default"
                          : a.status === "rejected"
                            ? "destructive"
                            : "outline"
                      }
                    >
                      {a.status}
                    </Badge>
                    <span className="ml-2 text-muted-foreground">{a.comment ?? ""}</span>
                  </div>
                  {a.status === "pending" && (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => decideM.mutate({ approvalId: a.id, decision: "approved" })}
                      >
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => decideM.mutate({ approvalId: a.id, decision: "rejected" })}
                      >
                        Reprovar
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <aside className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Variáveis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            {[
              "{{contact.name}}",
              "{{contact.email}}",
              "{{company.name}}",
              "{{company.cnpj}}",
              "{{deal.amount}}",
              "{{deal.title}}",
            ].map((t) => (
              <button
                key={t}
                type="button"
                disabled={!!locked}
                onClick={() => insertIntoEditor(" " + t)}
                className="block w-full rounded px-2 py-1 text-left font-mono hover:bg-muted disabled:opacity-50"
              >
                {t}
              </button>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between">
              Cláusulas
              <Link to="/settings/clauses" className="text-xs text-primary hover:underline">
                Gerenciar
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            {(clauses ?? []).length === 0 && (
              <p className="text-muted-foreground">Biblioteca vazia.</p>
            )}
            {(clauses ?? []).map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={!!locked}
                onClick={() => insertClause(c.body)}
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-muted disabled:opacity-50"
              >
                <FileText className="h-3 w-3" />
                <span className="flex-1">{c.title}</span>
                {c.category && <span className="text-muted-foreground">{c.category}</span>}
              </button>
            ))}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
