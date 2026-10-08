import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Copy, ExternalLink, FileText, Loader2, Paperclip, RefreshCw, Send, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/techhire/ui";
import {
  approveRoleProfile,
  archiveRoleProfile,
  createRoleProfile,
  createRoleProfileShareLink,
  forwardRoleProfile,
  getRoleProfile,
  getRoleProfileAttachmentUrl,
  removeRoleProfileAttachment,
  reviewRoleProfileProposal,
  revokeRoleProfileShareLink,
  saveRoleProfileTemplate,
  setRoleProfileStatus,
  syncRoleProfileAts,
  uploadRoleProfileAttachment,
} from "@/lib/role-profiles/role-profiles.functions";
import {
  CLIENT_FIELDS,
  CLIENT_FIELD_KEYS,
  MODALITY_LABEL,
  SENIORITY_LABEL,
  STATUS_LABEL,
  completeness,
  type ClientField,
  type ProfileData,
  type ProfileStatus,
} from "@/lib/role-profiles/schema";
import { RoleProfileStatusBadge } from "./role-profile-status-badge";
import type { WizardInitial } from "./role-profile-wizard";

const EVENT_LABEL: Record<string, string> = {
  created: "Perfil criado",
  imported: "Criado por importação com IA",
  duplicated: "Criado por duplicação",
  from_template: "Criado a partir de modelo",
  edited: "Editado",
  edited_after_approval: "Editado após aprovação — requer nova aprovação",
  status_changed: "Status alterado",
  approved: "Versão aprovada",
  forwarded: "Encaminhado ao recrutamento",
  forwarded_early: "Encaminhado antecipadamente (autorização comercial)",
  ats_synced: "Requisição do TechHire sincronizada",
  share_link_created: "Link do cliente gerado",
  share_link_revoked: "Link do cliente revogado",
  client_proposal: "Cliente sugeriu alterações",
  client_confirmed: "Cliente validou",
  client_proposal_applied: "Sugestão do cliente aplicada",
  client_proposal_rejected: "Sugestão do cliente recusada",
  attachment_removed: "Anexo removido",
  archived: "Arquivado",
};

const fmt = (v: unknown) => (v == null || v === "" ? "—" : Array.isArray(v) ? v.map((x) => (typeof x === "object" && x ? (x as { name?: string }).name : String(x))).join(", ") : String(v));
const fileToB64 = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] ?? ""); r.onerror = () => rej(new Error("Falha ao ler arquivo")); r.readAsDataURL(f); });

type Detail = {
  profile: { id: string; deal_id: string; title: string; quantity: number; modality: "outsourcing" | "hunting" | "both"; priority: "low" | "medium" | "high" | "urgent"; seniority: string | null; status: ProfileStatus; revision: number; data: ProfileData; ats_job_id: string | null; ats_synced_version: number | null; last_version: number; contact_id: string | null; assigned_to: string | null };
  commercial: WizardInitial["commercial"];
  perms: Record<"view" | "create" | "update" | "commercial" | "approve" | "early" | "forward" | "share", boolean>;
  missing: string[];
  versions: { id: string; version: number; approved_by: string; approved_at: string }[];
  approvedVersion: number | null;
  diffSinceLastVersion: { label: string; before: unknown; after: unknown; important: boolean }[];
  events: { id: string; kind: string; from_status: string | null; to_status: string | null; version: number | null; reason: string | null; actor_id: string | null; actor_kind: string; created_at: string }[];
  people: Record<string, string | null>;
  attachments: { id: string; filename: string; mime: string; size_bytes: number; uploaded_by_kind: string; created_at: string }[];
  links: { id: string; allowed_fields: string[]; expires_at: string; revoked_at: string | null; read_count: number; max_reads: number; write_count: number; max_writes: number; created_at: string }[];
  proposals: { id: string; payload: Record<string, unknown>; status: string; confirmed: boolean; created_at: string }[];
  handoff: { ats_job_id: string | null; early: boolean; early_reason: string | null; created_at: string; last_synced_version: number } | null;
};

export function RoleProfileDetail({ profileId, dealWon, onClose, onEdit, onChanged }: { profileId: string | null; dealWon: boolean; onClose: () => void; onEdit: (i: WizardInitial) => void; onChanged: () => void }) {
  const qc = useQueryClient();
  const get = useServerFn(getRoleProfile);
  const q = useQuery({ queryKey: ["role-profile", profileId], queryFn: () => get({ data: { id: profileId! } }) as Promise<Detail>, enabled: !!profileId });
  const fns = {
    status: useServerFn(setRoleProfileStatus),
    approve: useServerFn(approveRoleProfile),
    forward: useServerFn(forwardRoleProfile),
    sync: useServerFn(syncRoleProfileAts),
    template: useServerFn(saveRoleProfileTemplate),
    dup: useServerFn(createRoleProfile),
    archive: useServerFn(archiveRoleProfile),
    link: useServerFn(createRoleProfileShareLink),
    revoke: useServerFn(revokeRoleProfileShareLink),
    review: useServerFn(reviewRoleProfileProposal),
    upload: useServerFn(uploadRoleProfileAttachment),
    url: useServerFn(getRoleProfileAttachmentUrl),
    removeAtt: useServerFn(removeRoleProfileAttachment),
  };
  const [busy, setBusy] = useState<string | null>(null);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [earlyReason, setEarlyReason] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareFields, setShareFields] = useState<ClientField[]>(["role.responsibilities", "requirements.skills", "conditions.work_mode", "conditions.location"]);
  const [shareDays, setShareDays] = useState(7);
  const [newLink, setNewLink] = useState<string | null>(null);
  const [tplName, setTplName] = useState("");

  const refresh = () => { void qc.invalidateQueries({ queryKey: ["role-profile", profileId] }); onChanged(); };
  async function run(key: string, fn: () => Promise<unknown>, ok?: string) {
    setBusy(key);
    try {
      await fn();
      if (ok) toast.success(ok);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
      refresh();
    } finally {
      setBusy(null);
    }
  }

  const d = q.data;
  const p = d?.profile;
  const comp = p ? completeness({ ...p, seniority: p.seniority as never, data: p.data }) : null;

  return (
    <Sheet open={!!profileId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        {q.isLoading ? (
          <div className="space-y-3 pt-6" aria-busy="true">
            <div className="h-6 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-24 animate-pulse rounded bg-muted" />
          </div>
        ) : q.isError || !d || !p ? (
          <EmptyState icon={AlertTriangle} title="Não foi possível abrir o perfil" description={(q.error as Error)?.message ?? "Sem acesso."} action={<Button variant="outline" onClick={() => q.refetch()}>Tentar de novo</Button>} />
        ) : (
          <>
            <SheetHeader className="text-left">
              <div className="flex flex-wrap items-center gap-2">
                <RoleProfileStatusBadge status={p.status} />
                <Badge variant="outline">{MODALITY_LABEL[p.modality]}</Badge>
                {p.seniority ? <Badge variant="outline">{SENIORITY_LABEL[p.seniority as keyof typeof SENIORITY_LABEL] ?? p.seniority}</Badge> : null}
                <Badge variant="outline" className="tabular-nums">{p.quantity} {p.quantity === 1 ? "posição" : "posições"}</Badge>
                {d.approvedVersion ? <Badge variant="outline">v{d.approvedVersion} aprovada</Badge> : null}
              </div>
              <SheetTitle className="text-lg">{p.title}</SheetTitle>
              <SheetDescription>Perfil técnico compartilhado; condições comerciais separadas por modalidade.</SheetDescription>
              {comp ? (
                <div className="flex items-center gap-3 pt-1">
                  <Progress value={comp.total * 100} className="h-1.5 flex-1" aria-label="Completude" />
                  <span className="text-xs tabular-nums text-text-secondary">{Math.round(comp.total * 100)}% preenchido</span>
                </div>
              ) : null}
            </SheetHeader>

            {d.missing.length ? (
              <div className="mt-4 rounded-md border border-warning/30 bg-warning/5 p-3 text-xs text-text-secondary" role="status">
                <p className="font-medium text-text-primary">Para aprovar falta:</p>
                <p>{d.missing.join(" · ")}</p>
              </div>
            ) : null}
            {p.ats_job_id && p.ats_synced_version !== p.last_version ? (
              <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-xs" role="status">
                A requisição no TechHire está na versão {p.ats_synced_version}. {p.status === "forwarded" ? "Sincronize para enviar a versão aprovada mais recente." : "Aprove as alterações para poder sincronizar."}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {d.perms.update && p.status !== "forwarded" || (d.perms.update && p.status === "forwarded") ? (
                <Button size="sm" variant="outline" onClick={() => onEdit({ id: p.id, revision: p.revision, header: { title: p.title, quantity: p.quantity, modality: p.modality, priority: p.priority, seniority: (p.seniority as never) ?? null, contact_id: p.contact_id, assigned_to: p.assigned_to }, data: p.data, commercial: d.commercial })}>
                  Editar
                </Button>
              ) : null}
              {d.perms.update && (p.status === "draft" || p.status === "awaiting_info") ? (
                <Button size="sm" variant="outline" disabled={!!busy} onClick={() => run("val", () => fns.status({ data: { id: p.id, to: "in_validation", expectedRevision: p.revision } }), "Enviado para validação")}>Enviar para validação</Button>
              ) : null}
              {d.perms.update && (p.status === "draft" || p.status === "in_validation") ? (
                <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => run("info", () => fns.status({ data: { id: p.id, to: "awaiting_info", expectedRevision: p.revision } }), "Marcado como aguardando informações")}>Aguardando informações</Button>
              ) : null}
              {d.perms.approve && ["draft", "awaiting_info", "in_validation"].includes(p.status) ? (
                <Button size="sm" disabled={!!busy || d.missing.length > 0} title={d.missing.length ? "Complete os campos mínimos" : undefined} onClick={() => run("approve", () => fns.approve({ data: { id: p.id, expectedRevision: p.revision } }), "Versão aprovada")}>
                  {busy === "approve" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden /> : <CheckCircle2 className="mr-1 h-3.5 w-3.5" aria-hidden />}Aprovar
                </Button>
              ) : null}
              {d.perms.forward && p.status === "approved" && !p.ats_job_id ? (
                <Button size="sm" onClick={() => setForwardOpen(true)} disabled={!!busy}><Send className="mr-1 h-3.5 w-3.5" aria-hidden />Encaminhar ao recrutamento</Button>
              ) : null}
              {d.perms.forward && p.ats_job_id && p.status === "forwarded" && p.ats_synced_version !== p.last_version ? (
                <Button size="sm" disabled={!!busy} onClick={() => run("sync", () => fns.sync({ data: { id: p.id } }), "TechHire sincronizado")}><RefreshCw className="mr-1 h-3.5 w-3.5" aria-hidden />Sincronizar TechHire</Button>
              ) : null}
              {p.ats_job_id ? (
                <Button size="sm" variant="outline" asChild>
                  <Link to="/jobs/$id" params={{ id: p.ats_job_id }}><ExternalLink className="mr-1 h-3.5 w-3.5" aria-hidden />Abrir no TechHire</Link>
                </Button>
              ) : null}
              {d.perms.create ? (
                <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => run("dup", () => fns.dup({ data: { dealId: p.deal_id, header: { title: p.title, quantity: p.quantity, modality: p.modality, priority: p.priority }, duplicateOf: p.id } }), "Perfil duplicado como rascunho")}><Copy className="mr-1 h-3.5 w-3.5" aria-hidden />Duplicar</Button>
              ) : null}
              {d.perms.share ? (
                <Button size="sm" variant="ghost" onClick={() => { setNewLink(null); setShareOpen(true); }}><Share2 className="mr-1 h-3.5 w-3.5" aria-hidden />Link do cliente</Button>
              ) : null}
              {d.perms.update && !p.ats_job_id ? (
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={!!busy} onClick={async () => { if (await confirmDialog({ title: "Arquivar perfil?", description: "O histórico é preservado.", confirmLabel: "Arquivar", variant: "destructive" })) await run("arch", () => fns.archive({ data: { id: p.id } }).then(onClose), "Perfil arquivado"); }}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden />Arquivar
                </Button>
              ) : null}
            </div>

            <Tabs defaultValue="changes" className="mt-5">
              <TabsList className="flex-wrap">
                <TabsTrigger value="changes">Alterações</TabsTrigger>
                <TabsTrigger value="history">Histórico</TabsTrigger>
                <TabsTrigger value="client">Cliente ({d.proposals.filter((x) => x.status === "pending").length})</TabsTrigger>
                <TabsTrigger value="files">Anexos ({d.attachments.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="changes" className="mt-3 space-y-2">
                {!d.versions.length ? (
                  <p className="text-sm text-text-secondary">Ainda não há versão aprovada. Ao aprovar, a versão fica imutável e as próximas alterações aparecem aqui.</p>
                ) : d.diffSinceLastVersion.length === 0 ? (
                  <p className="text-sm text-text-secondary">Sem alterações desde a versão {d.versions[0].version}.</p>
                ) : (
                  <ul className="divide-y divide-product-divider rounded-md border border-border-subtle">
                    {d.diffSinceLastVersion.map((c) => (
                      <li key={c.label} className={`grid grid-cols-[140px_1fr] gap-2 px-3 py-2 text-xs ${c.important ? "bg-warning/5" : ""}`}>
                        <span className="font-medium text-text-primary">{c.label}{c.important ? " ●" : ""}</span>
                        <span><span className="text-text-tertiary line-through">{fmt(c.before)}</span> → <span className="text-text-primary">{fmt(c.after)}</span></span>
                      </li>
                    ))}
                  </ul>
                )}
                {d.versions.length ? (
                  <div className="pt-2">
                    <p className="mb-1 text-xs font-semibold text-text-primary">Versões aprovadas</p>
                    <ul className="space-y-1 text-xs text-text-secondary">
                      {d.versions.map((v) => <li key={v.id}>v{v.version} — {d.people[v.approved_by] ?? "Usuário"} em {new Date(v.approved_at).toLocaleString("pt-BR")}</li>)}
                    </ul>
                  </div>
                ) : null}
                {d.handoff ? (
                  <p className="pt-2 text-xs text-text-secondary">Encaminhado em {new Date(d.handoff.created_at).toLocaleString("pt-BR")}{d.handoff.early ? ` · antecipado: “${d.handoff.early_reason}”` : ""} · TechHire na v{d.handoff.last_synced_version}</p>
                ) : null}
                {d.perms.create ? (
                  <div className="flex gap-2 pt-3">
                    <Label htmlFor="rp-tpl" className="sr-only">Nome do modelo</Label>
                    <Input id="rp-tpl" className="h-8" placeholder="Nome do modelo reutilizável" value={tplName} onChange={(e) => setTplName(e.target.value)} />
                    <Button size="sm" variant="outline" disabled={!tplName.trim() || !!busy} onClick={() => run("tpl", () => fns.template({ data: { profileId: p.id, name: tplName } }).then(() => setTplName("")), "Modelo salvo (sem comercial, aprovação ou links)")}>Salvar como modelo</Button>
                  </div>
                ) : null}
              </TabsContent>

              <TabsContent value="history" className="mt-3">
                <ol className="space-y-2">
                  {d.events.map((e) => (
                    <li key={e.id} className="border-l-2 border-border-subtle pl-3 text-xs">
                      <p className="font-medium text-text-primary">{EVENT_LABEL[e.kind] ?? e.kind}{e.version ? ` · v${e.version}` : ""}</p>
                      <p className="text-text-tertiary">
                        {e.actor_kind === "client" ? "Cliente (link)" : e.actor_id ? (d.people[e.actor_id] ?? "Usuário") : "Sistema"} · {new Date(e.created_at).toLocaleString("pt-BR")}
                        {e.from_status && e.to_status ? ` · ${STATUS_LABEL[e.from_status as ProfileStatus] ?? e.from_status} → ${STATUS_LABEL[e.to_status as ProfileStatus] ?? e.to_status}` : ""}
                      </p>
                      {e.reason ? <p className="text-text-secondary">Motivo: {e.reason}</p> : null}
                    </li>
                  ))}
                </ol>
              </TabsContent>

              <TabsContent value="client" className="mt-3 space-y-4">
                {d.proposals.length === 0 ? <p className="text-sm text-text-secondary">Nenhuma resposta do cliente.</p> : null}
                {d.proposals.map((pr) => (
                  <div key={pr.id} className="rounded-md border border-border-subtle p-3 text-xs">
                    <div className="mb-2 flex items-center gap-2">
                      <Badge variant="outline">{pr.status === "pending" ? "Pendente" : pr.status === "applied" ? "Aplicada" : "Recusada"}</Badge>
                      {pr.confirmed ? <Badge variant="outline">Cliente validou</Badge> : null}
                      <span className="text-text-tertiary">{new Date(pr.created_at).toLocaleString("pt-BR")}</span>
                    </div>
                    <ul className="space-y-1">
                      {Object.entries(pr.payload).map(([k, v]) => (
                        <li key={k}><span className="text-text-tertiary">{CLIENT_FIELDS[k as ClientField] ?? k}:</span> {fmt(v)}</li>
                      ))}
                    </ul>
                    {pr.status === "pending" && d.perms.update ? (
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" disabled={!!busy} onClick={() => run("ap", () => fns.review({ data: { proposalId: pr.id, action: "apply", expectedRevision: p.revision } }), "Sugestão aplicada (perfil volta para validação se já aprovado)")}>Aplicar</Button>
                        <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => run("rj", () => fns.review({ data: { proposalId: pr.id, action: "reject", expectedRevision: p.revision } }), "Sugestão recusada")}>Recusar</Button>
                      </div>
                    ) : null}
                  </div>
                ))}
                {d.perms.share && d.links.length ? (
                  <div>
                    <p className="mb-1 text-xs font-semibold text-text-primary">Links gerados</p>
                    <ul className="space-y-1">
                      {d.links.map((l) => {
                        const active = !l.revoked_at && new Date(l.expires_at) > new Date();
                        return (
                          <li key={l.id} className="flex items-center gap-2 text-xs">
                            <Badge variant="outline">{l.revoked_at ? "Revogado" : active ? "Ativo" : "Expirado"}</Badge>
                            <span className="text-text-secondary">{l.allowed_fields.length} campos · acessos {l.read_count}/{l.max_reads} · envios {l.write_count}/{l.max_writes} · expira {new Date(l.expires_at).toLocaleDateString("pt-BR")}</span>
                            {active ? <Button size="sm" variant="link" className="h-auto p-0 text-destructive" onClick={() => run("rv", () => fns.revoke({ data: { linkId: l.id } }), "Link revogado")}>Revogar</Button> : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </TabsContent>

              <TabsContent value="files" className="mt-3 space-y-2">
                {d.perms.update ? (
                  <div>
                    <Label htmlFor="rp-att" className="text-xs">Adicionar anexo privado (PDF, DOCX, imagem até 10 MB)</Label>
                    <Input id="rp-att" type="file" accept=".pdf,.docx,.png,.jpg,.jpeg,.webp" disabled={busy === "up"} onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) await run("up", async () => fns.upload({ data: { id: p.id, filename: f.name, base64: await fileToB64(f) } }), "Anexo enviado"); }} />
                  </div>
                ) : null}
                {d.attachments.length === 0 ? <p className="text-sm text-text-secondary">Nenhum anexo.</p> : (
                  <ul className="space-y-1">
                    {d.attachments.map((a) => (
                      <li key={a.id} className="flex items-center gap-2 text-sm">
                        <Paperclip className="h-3.5 w-3.5 text-text-tertiary" aria-hidden />
                        <button type="button" className="truncate text-left text-primary hover:underline" onClick={() => run("url", async () => { const r = await fns.url({ data: { attachmentId: a.id } }); window.open(r.url, "_blank", "noopener"); })}>{a.filename}</button>
                        <span className="text-[11px] text-text-tertiary">{Math.ceil(a.size_bytes / 1024)} KB{a.uploaded_by_kind === "client" ? " · cliente" : ""}</span>
                        {d.perms.update ? <Button size="icon" variant="ghost" className="ml-auto h-7 w-7" aria-label={`Remover ${a.filename}`} onClick={() => run("rm", () => fns.removeAtt({ data: { attachmentId: a.id } }), "Anexo removido")}><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button> : null}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="flex items-center gap-1 text-[11px] text-text-tertiary"><FileText className="h-3 w-3" aria-hidden />Links de download valem 60 segundos.</p>
              </TabsContent>
            </Tabs>

            <Dialog open={forwardOpen} onOpenChange={setForwardOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Encaminhar ao recrutamento</DialogTitle>
                  <DialogDescription>Cria uma requisição em rascunho no TechHire com a versão aprovada v{d.approvedVersion}, {p.quantity} {p.quantity === 1 ? "posição" : "posições"}. Preço, custo, margem e honorários não são enviados. A fase do negócio não muda.</DialogDescription>
                </DialogHeader>
                {!dealWon ? (
                  <div className="space-y-2">
                    <p className="text-sm text-warning">O negócio ainda não foi ganho. Encaminhar agora exige autorização comercial antecipada{d.perms.early ? "" : ", que o seu perfil não possui"}.</p>
                    {d.perms.early ? (
                      <>
                        <Label htmlFor="rp-early">Motivo da autorização (registrado na auditoria)</Label>
                        <Textarea id="rp-early" rows={3} value={earlyReason} onChange={(e) => setEarlyReason(e.target.value)} />
                      </>
                    ) : null}
                  </div>
                ) : null}
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setForwardOpen(false)}>Cancelar</Button>
                  <Button disabled={!!busy || (!dealWon && (!d.perms.early || earlyReason.trim().length < 10))} onClick={() => run("fwd", async () => { const r = await fns.forward({ data: { id: p.id, early: !dealWon, reason: dealWon ? undefined : earlyReason } }); setForwardOpen(false); if (r.already) toast.info("Este perfil já tinha requisição; nenhuma duplicada foi criada."); }, "Requisição criada no TechHire")}>
                    {busy === "fwd" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden /> : null}Encaminhar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={shareOpen} onOpenChange={setShareOpen}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Link seguro para o cliente</DialogTitle>
                  <DialogDescription>O cliente vê e sugere somente os campos marcados. Custos, margem, honorários e observações nunca aparecem. Nada é enviado automaticamente: copie e compartilhe você mesmo.</DialogDescription>
                </DialogHeader>
                {newLink ? (
                  <div className="space-y-2">
                    <Label htmlFor="rp-newlink">Link (mostrado só agora)</Label>
                    <div className="flex gap-2">
                      <Input id="rp-newlink" readOnly value={newLink} onFocus={(e) => e.currentTarget.select()} />
                      <Button variant="outline" onClick={() => { void navigator.clipboard.writeText(newLink); toast.success("Link copiado"); }}>Copiar</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid max-h-64 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
                      {CLIENT_FIELD_KEYS.map((k) => (
                        <div key={k} className="flex items-center gap-2">
                          <Checkbox id={`sf-${k}`} checked={shareFields.includes(k)} onCheckedChange={(v) => setShareFields((s) => (v ? [...s, k] : s.filter((x) => x !== k)))} />
                          <Label htmlFor={`sf-${k}`} className="text-xs font-normal">{CLIENT_FIELDS[k]}</Label>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="rp-days" className="text-xs">Expira em (dias)</Label>
                      <Input id="rp-days" type="number" min={1} max={30} className="h-8 w-20" value={shareDays} onChange={(e) => setShareDays(Math.min(30, Math.max(1, Number(e.target.value) || 1)))} />
                    </div>
                  </>
                )}
                <DialogFooter>
                  {!newLink ? (
                    <Button disabled={!shareFields.length || !!busy} onClick={() => run("link", async () => { const r = await fns.link({ data: { id: p.id, allowedFields: shareFields, days: shareDays, maxWrites: 5 } }); setNewLink(`${window.location.origin}/role-profile/${r.token}`); }, "Link gerado")}>Gerar link</Button>
                  ) : (
                    <Button variant="ghost" onClick={() => setShareOpen(false)}>Fechar</Button>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
