import { getPublicAppUrl } from "@/lib/app-url";
import { formatDateTime } from "@/lib/crm";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listEsignDocuments,
  createEsignDocument,
  sendEsignDocument,
  cancelEsignDocument,
  deleteEsignDocument,
  getEsignDocument,
  addEsignSigner,
  removeEsignSigner,
} from "@/lib/esign.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmailInput } from "@/components/ui/email-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, Send, X, Trash2, Copy, ExternalLink, Eye, FileSignature } from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/ui/confirm-dialog";

export const Route = createFileRoute("/_authenticated/settings/esign")({
  component: EsignPage,
});

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  sent: "Enviado",
  partially_signed: "Parcial",
  completed: "Concluído",
  declined: "Recusado",
  expired: "Expirado",
  canceled: "Cancelado",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  sent: "secondary",
  partially_signed: "secondary",
  completed: "default",
  declined: "destructive",
  expired: "outline",
  canceled: "outline",
};
const SIGNER_LABEL: Record<string, string> = {
  pending: "Pendente",
  viewed: "Visualizado",
  signed: "Assinado",
  declined: "Recusado",
};

function EsignPage() {
  const qc = useQueryClient();
  const list = useServerFn(listEsignDocuments);
  const create = useServerFn(createEsignDocument);
  const send = useServerFn(sendEsignDocument);
  const cancel = useServerFn(cancelEsignDocument);
  const del = useServerFn(deleteEsignDocument);

  const [openCreate, setOpenCreate] = useState(false);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    body: "",
    ordered: false,
    signers: [{ name: "", email: "", sign_order: 1 }],
  });

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["esign-docs"],
    queryFn: () => list(),
  });

  const createMut = useMutation({
    mutationFn: () =>
      create({
        data: {
          title: draft.title,
          description: draft.description || undefined,
          body: draft.body,
          ordered: draft.ordered,
          signers: draft.signers.filter((s) => s.name && s.email),
        },
      }),
    onSuccess: () => {
      toast.success("Documento criado.");
      setOpenCreate(false);
      setDraft({
        title: "",
        description: "",
        body: "",
        ordered: false,
        signers: [{ name: "", email: "", sign_order: 1 }],
      });
      qc.invalidateQueries({ queryKey: ["esign-docs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = docs.length;
  const completed = docs.filter((d) => d.status === "completed").length;
  const pending = docs.filter((d) =>
    ["sent", "partially_signed", "draft"].includes(d.status),
  ).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{total}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Concluídos</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{completed}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Em aberto</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{pending}</CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-1" /> Novo documento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Novo documento para assinatura</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              <div className="space-y-1.5">
                <Label>Título *</Label>
                <Input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="Contrato de prestação de serviços"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Input
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Conteúdo do documento *</Label>
                <Textarea
                  rows={10}
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  placeholder="Cole aqui o texto integral do contrato/termo a ser assinado."
                />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium">Assinatura em ordem</div>
                  <div className="text-xs text-muted-foreground">
                    Cada signatário só assina depois do anterior.
                  </div>
                </div>
                <Switch
                  checked={draft.ordered}
                  onCheckedChange={(v) => setDraft({ ...draft, ordered: v })}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Signatários *</Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        signers: [
                          ...draft.signers,
                          { name: "", email: "", sign_order: draft.signers.length + 1 },
                        ],
                      })
                    }
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Adicionar
                  </Button>
                </div>
                {draft.signers.map((s, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_70px_auto] gap-2 items-end">
                    <Input
                      placeholder="Nome"
                      value={s.name}
                      onChange={(e) => {
                        const ns = [...draft.signers];
                        ns[i] = { ...s, name: e.target.value };
                        setDraft({ ...draft, signers: ns });
                      }}
                    />
                    <EmailInput
                      placeholder="email@exemplo.com"
                      value={s.email}
                      onChange={(v) => {
                        const ns = [...draft.signers];
                        ns[i] = { ...s, email: v };
                        setDraft({ ...draft, signers: ns });
                      }}
                    />
                    <Input
                      placeholder="Ord."
                      type="number"
                      min={1}
                      value={s.sign_order}
                      onChange={(e) => {
                        const ns = [...draft.signers];
                        ns[i] = { ...s, sign_order: Number(e.target.value) || 1 };
                        setDraft({ ...draft, signers: ns });
                      }}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        setDraft({ ...draft, signers: draft.signers.filter((_, j) => j !== i) })
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenCreate(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => createMut.mutate()}
                disabled={createMut.isPending || !draft.title || !draft.body}
              >
                {createMut.isPending ? "Criando…" : "Criar rascunho"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : docs.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <FileSignature className="h-10 w-10 mx-auto mb-2 opacity-50" />
            Nenhum documento. Crie o primeiro para enviar para assinatura eletrônica.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => {
            const signers = (d.esign_signers ?? []) as Array<{
              id: string;
              name: string;
              status: string;
            }>;
            const signed = signers.filter((s) => s.status === "signed").length;
            return (
              <div
                key={d.id}
                className="rounded-md border p-3 flex items-center justify-between gap-3 hover:bg-accent/30 cursor-pointer"
                onClick={() => setDrawerId(d.id)}
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{d.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(d.created_at)} · {signed}/{signers.length} assinaram
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Badge variant={STATUS_VARIANT[d.status] ?? "outline"}>
                    {STATUS_LABEL[d.status] ?? d.status}
                  </Badge>
                  {d.status === "draft" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await send({ data: { id: d.id } });
                        toast.success("Documento enviado.");
                        qc.invalidateQueries({ queryKey: ["esign-docs"] });
                      }}
                    >
                      <Send className="h-3.5 w-3.5 mr-1" />
                      Enviar
                    </Button>
                  )}
                  {!["completed", "declined", "canceled"].includes(d.status) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        if (!(await confirmDialog("Cancelar este documento?"))) return;
                        await cancel({ data: { id: d.id } });
                        qc.invalidateQueries({ queryKey: ["esign-docs"] });
                      }}
                    >
                      Cancelar
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (!(await confirmDialog("Excluir definitivamente?"))) return;
                      await del({ data: { id: d.id } });
                      qc.invalidateQueries({ queryKey: ["esign-docs"] });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <EsignDrawer id={drawerId} onClose={() => setDrawerId(null)} />
    </div>
  );
}

function EsignDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const get = useServerFn(getEsignDocument);
  const addS = useServerFn(addEsignSigner);
  const rmS = useServerFn(removeEsignSigner);

  const { data, isLoading } = useQuery({
    queryKey: ["esign-doc", id],
    queryFn: () => get({ data: { id: id! } }),
    enabled: !!id,
  });

  const [newSigner, setNewSigner] = useState({ name: "", email: "", sign_order: 1 });

  function publicUrl(token: string) {
    return `${getPublicAppUrl()}/sign/${token}`;
  }

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[90vw] sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{data?.doc?.title ?? "Documento"}</SheetTitle>
        </SheetHeader>
        {isLoading || !data ? (
          <p className="text-sm text-muted-foreground mt-4">Carregando…</p>
        ) : (
          <div className="space-y-5 mt-4">
            <div>
              <div className="text-xs uppercase text-muted-foreground mb-1">Conteúdo</div>
              <div className="rounded-md border bg-muted/30 p-3 whitespace-pre-wrap text-sm max-h-60 overflow-y-auto">
                {data.doc.body}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs uppercase text-muted-foreground">Signatários</div>
              </div>
              <div className="space-y-2">
                {data.signers.map((s) => (
                  <div key={s.id} className="rounded-md border p-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="font-medium text-sm">
                          {s.name}{" "}
                          <span className="text-xs text-muted-foreground">#{s.sign_order}</span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{s.email}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline">{SIGNER_LABEL[s.status] ?? s.status}</Badge>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={async () => {
                            await navigator.clipboard.writeText(publicUrl(s.public_token));
                            toast.success("Link copiado.");
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => window.open(publicUrl(s.public_token), "_blank")}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                        {s.status === "pending" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={async () => {
                              await rmS({ data: { id: s.id } });
                              qc.invalidateQueries({ queryKey: ["esign-doc", id] });
                              qc.invalidateQueries({ queryKey: ["esign-docs"] });
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {s.signed_at && (
                      <div className="text-xs text-muted-foreground">
                        Assinado em {formatDateTime(s.signed_at)}
                      </div>
                    )}
                  </div>
                ))}
                <div className="grid grid-cols-[1fr_1fr_70px_auto] gap-2 items-end pt-2">
                  <Input
                    placeholder="Nome"
                    value={newSigner.name}
                    onChange={(e) => setNewSigner({ ...newSigner, name: e.target.value })}
                  />
                  <EmailInput
                    placeholder="Email"
                    value={newSigner.email}
                    onChange={(v) => setNewSigner({ ...newSigner, email: v })}
                  />
                  <Input
                    placeholder="Ord."
                    type="number"
                    min={1}
                    value={newSigner.sign_order}
                    onChange={(e) =>
                      setNewSigner({ ...newSigner, sign_order: Number(e.target.value) || 1 })
                    }
                  />
                  <Button
                    size="sm"
                    onClick={async () => {
                      if (!newSigner.name || !newSigner.email) return;
                      await addS({ data: { documentId: id!, ...newSigner } });
                      setNewSigner({ name: "", email: "", sign_order: data.signers.length + 1 });
                      qc.invalidateQueries({ queryKey: ["esign-doc", id] });
                      qc.invalidateQueries({ queryKey: ["esign-docs"] });
                    }}
                  >
                    Adicionar
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs uppercase text-muted-foreground mb-2 flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" /> Trilha de auditoria
              </div>
              <div className="rounded-md border divide-y text-sm max-h-60 overflow-y-auto">
                {data.audit.length === 0 ? (
                  <div className="p-3 text-muted-foreground text-xs">Sem eventos ainda.</div>
                ) : (
                  data.audit.map((a) => (
                    <div key={a.id} className="p-2 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-medium text-xs">{a.event}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {formatDateTime(a.created_at)}
                          {a.ip_address ? ` · ${a.ip_address}` : ""}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
