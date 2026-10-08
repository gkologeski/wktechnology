// Quadro "Vagas e perfis" da coluna direita do negócio. Só aparece quando um
// serviço do catálogo associado ao negócio contém Hunting ou Outsourcing
// (ou quando já existem perfis históricos, mostrados sem novas operações).
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  LayoutTemplate,
  ListPlus,
  Loader2,
  Pencil,
  RotateCw,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  createRoleProfile,
  createRoleProfilesFromLines,
  decideRoleProfileApproval,
  listDealRoleProfiles,
  listRoleProfileApprovals,
  retryRoleProfileApprovalDelivery,
} from "@/lib/role-profiles/role-profiles.functions";
import { SENIORITY_LABEL, type Modality, type ProfileHeader } from "@/lib/role-profiles/schema";
import { modalityFor } from "@/lib/role-profiles/eligibility";
import { defaultHeader, type WizardInitial } from "./profile-fields";
import { RoleProfileDetail } from "./role-profile-detail";
import { RoleProfileImportDialog } from "./role-profile-import-dialog";
import { RoleProfileStatusBadge } from "./role-profile-status-badge";
import { RoleProfilesEditor, type EditorRow } from "./role-profiles-editor";

export const roleProfilesKey = (dealId: string) => ["deal-role-profiles", dealId] as const;
const approvalsKey = (dealId: string) => ["deal-role-profile-approvals", dealId] as const;

type ListData = Awaited<ReturnType<typeof listDealRoleProfiles>>;
type ProfileItem = ListData["profiles"][number];

function rowOf(p: ProfileItem): EditorRow {
  return {
    key: p.id,
    id: p.id,
    revision: p.revision,
    status: p.status,
    header: {
      title: p.title,
      quantity: p.quantity,
      modality: p.modality as Modality,
      priority: p.priority as ProfileHeader["priority"],
      seniority: (p.seniority as ProfileHeader["seniority"]) ?? null,
      contact_id: p.contactId,
      assigned_to: p.assignedTo,
    },
    data: p.data,
    links: { jobProfileId: p.jobProfileId, presetId: p.presetId },
    dirty: false,
  };
}

const DELIVERY_LABEL: Record<string, string> = {
  pending: "pendente",
  sending: "enviando",
  sent: "enviado",
  failed: "falhou",
  suppressed: "bloqueado pelo destinatário",
};

export function RoleProfilesCard({
  dealId,
  openProfileId,
  approvalId,
  onOpenProfile,
}: {
  dealId: string;
  openProfileId?: string;
  approvalId?: string;
  onOpenProfile: (id: string | undefined) => void;
}) {
  const qc = useQueryClient();
  const list = useServerFn(listDealRoleProfiles);
  const listAppr = useServerFn(listRoleProfileApprovals);
  const fromLines = useServerFn(createRoleProfilesFromLines);
  const create = useServerFn(createRoleProfile);
  const decide = useServerFn(decideRoleProfileApproval);
  const retry = useServerFn(retryRoleProfileApprovalDelivery);

  const q = useQuery({
    queryKey: roleProfilesKey(dealId),
    queryFn: () => list({ data: { dealId } }),
  });
  const appr = useQuery({
    queryKey: approvalsKey(dealId),
    queryFn: () => listAppr({ data: { dealId } }),
    enabled: !!q.data && (q.data.profiles.length > 0 || q.data.eligibility.eligible),
  });
  const reload = () => {
    void qc.invalidateQueries({ queryKey: roleProfilesKey(dealId) });
    void qc.invalidateQueries({ queryKey: approvalsKey(dealId) });
    void qc.invalidateQueries({ queryKey: ["role-profile"] });
  };

  // Mudou serviço/itens de linha → reavalia elegibilidade e sugestões na hora.
  useEffect(
    () =>
      qc.getQueryCache().subscribe((e) => {
        const k = e.query.queryKey;
        if (
          e.type === "updated" &&
          k[0] === "deal_line_items" &&
          k[1] === dealId &&
          (e.action.type === "success" || e.action.type === "setState")
        )
          void qc.invalidateQueries({ queryKey: roleProfilesKey(dealId) });
      }),
    [qc, dealId],
  );

  const [editor, setEditor] = useState<{ rows: EditorRow[]; focus?: string } | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [pickedLines, setPickedLines] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});

  const data = q.data;
  const suggestions = data?.suggestions ?? [];
  useEffect(
    () => setPickedLines(new Set(suggestions.map((s) => s.lineItemId))),
    [suggestions.length],
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const pendingForMe = useMemo(
    () =>
      (appr.data ?? []).filter((r) => r.isApprover && r.items.some((i) => i.status === "pending")),
    [appr.data],
  );

  if (q.isLoading)
    return (
      <Card aria-busy="true">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Vagas e perfis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="h-10 animate-pulse rounded bg-muted" />
          <div className="h-10 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  if (q.isError || !data) {
    const msg = (q.error as Error | null)?.message ?? "";
    if (/permiss/i.test(msg)) return null; // sem acesso ao recurso: não exibe o quadro
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Vagas e perfis</CardTitle>
        </CardHeader>
        <CardContent>
          <p role="alert" className="text-sm text-destructive">
            Não foi possível carregar os perfis. {msg}
          </p>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => q.refetch()}>
            Tentar de novo
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { perms, eligibility, profiles, totals, templates, deal } = data;
  if (!eligibility.eligible && profiles.length === 0) return null;
  const canCreate = perms.create && eligibility.eligible;
  const defaultModality = modalityFor(eligibility.kinds);
  const openEditor = (focus?: string, extra: EditorRow[] = []) => {
    setEditor({ rows: [...profiles.map(rowOf), ...extra], focus });
    setEditorKey((k) => k + 1);
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">
          Vagas e perfis{" "}
          <span className="text-sm font-normal text-text-secondary">
            ({totals.profiles} · {totals.positions}{" "}
            {totals.positions === 1 ? "posição" : "posições"})
          </span>
        </CardTitle>
        {perms.create || perms.update ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="link" size="sm" className="h-auto p-0">
                Ações
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {perms.update ? (
                <DropdownMenuItem onSelect={() => openEditor()}>
                  <Pencil className="mr-2 h-3.5 w-3.5" aria-hidden /> Editar perfis
                </DropdownMenuItem>
              ) : null}
              {canCreate ? (
                <DropdownMenuItem onSelect={() => setImportOpen(true)}>
                  <Sparkles className="mr-2 h-3.5 w-3.5" aria-hidden /> Importar com IA
                </DropdownMenuItem>
              ) : null}
              {canCreate && templates.length ? (
                <>
                  <DropdownMenuLabel className="text-xs text-text-tertiary">
                    Modelos
                  </DropdownMenuLabel>
                  {templates.map((t) => (
                    <DropdownMenuItem
                      key={t.id}
                      onSelect={async () => {
                        try {
                          await create({
                            data: { dealId, header: defaultHeader(), templateId: t.id },
                          });
                          toast.success("Rascunho criado a partir do modelo");
                          reload();
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                    >
                      <LayoutTemplate className="mr-2 h-3.5 w-3.5" aria-hidden />
                      {t.name}
                    </DropdownMenuItem>
                  ))}
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {!eligibility.eligible ? (
          <p
            role="status"
            className="rounded-md border border-warning/30 bg-warning/5 p-2 text-xs text-text-secondary"
          >
            Nenhum serviço de Hunting ou Outsourcing está associado agora. Perfis existentes ficam
            disponíveis para consulta; novas criações e validações estão bloqueadas.
          </p>
        ) : null}

        {pendingForMe.length ? (
          <section
            aria-label="Aprovações pendentes"
            className={`space-y-2 rounded-md border p-3 ${approvalId ? "border-primary" : "border-border-subtle"}`}
          >
            <p className="text-sm font-medium text-text-primary">Aguardando sua aprovação</p>
            {pendingForMe.map((r) => (
              <div key={r.id} className="space-y-2">
                <p className="text-xs text-text-secondary">
                  Pedido por {r.requesterName} em {new Date(r.createdAt).toLocaleString("pt-BR")}
                </p>
                {r.items
                  .filter((i) => i.status === "pending")
                  .map((i) => {
                    const p = profiles.find((x) => x.id === i.profile_id);
                    return (
                      <div
                        key={i.id}
                        className="space-y-1.5 rounded border border-border-subtle p-2"
                      >
                        <button
                          type="button"
                          className="text-left text-sm font-medium text-primary hover:underline"
                          onClick={() => onOpenProfile(i.profile_id)}
                        >
                          {p?.title ?? "Perfil"} · {p?.quantity ?? 0}
                        </button>
                        <Textarea
                          aria-label={`Comentário para ${p?.title ?? "perfil"}`}
                          rows={2}
                          placeholder="Ajustes necessários (obrigatório para pedir ajustes)"
                          value={comments[i.id] ?? ""}
                          onChange={(e) => setComments((c) => ({ ...c, [i.id]: e.target.value }))}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            disabled={!!busy}
                            onClick={async () => {
                              setBusy(i.id);
                              try {
                                await decide({
                                  data: {
                                    itemId: i.id,
                                    decision: "approve",
                                    comment: comments[i.id],
                                  },
                                });
                                toast.success("Perfil aprovado");
                                reload();
                              } catch (e) {
                                toast.error((e as Error).message);
                                reload();
                              } finally {
                                setBusy(null);
                              }
                            }}
                          >
                            {busy === i.id ? (
                              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" aria-hidden />
                            )}
                            Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!!busy || !(comments[i.id] ?? "").trim()}
                            onClick={async () => {
                              setBusy(i.id);
                              try {
                                await decide({
                                  data: {
                                    itemId: i.id,
                                    decision: "request_changes",
                                    comment: comments[i.id],
                                  },
                                });
                                toast.success("Ajustes solicitados");
                                reload();
                              } catch (e) {
                                toast.error((e as Error).message);
                              } finally {
                                setBusy(null);
                              }
                            }}
                          >
                            Solicitar ajustes
                          </Button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ))}
          </section>
        ) : null}

        {canCreate && suggestions.length ? (
          <section aria-label="Sugestões dos itens de linha" className="space-y-2">
            <p className="text-xs font-medium text-text-secondary">
              Cargos nos itens de linha ainda sem perfil
            </p>
            <ul className="space-y-1.5">
              {suggestions.map((s) => (
                <li key={s.lineItemId} className="flex items-start gap-2 text-sm">
                  <Checkbox
                    className="mt-0.5"
                    id={`sug-${s.lineItemId}`}
                    checked={pickedLines.has(s.lineItemId)}
                    onCheckedChange={(v) =>
                      setPickedLines((p) => {
                        const n = new Set(p);
                        if (v) n.add(s.lineItemId);
                        else n.delete(s.lineItemId);
                        return n;
                      })
                    }
                  />
                  <label htmlFor={`sug-${s.lineItemId}`} className="min-w-0 flex-1">
                    <span className="font-medium text-text-primary">{s.title}</span>{" "}
                    <span className="tabular-nums text-text-secondary">· {s.quantity}</span>
                    <span className="block text-[11px] text-text-tertiary">
                      Título: {s.origin.title} · Qtd.: {s.origin.quantity} · Senioridade:{" "}
                      {s.seniority
                        ? `${SENIORITY_LABEL[s.seniority]} (${s.origin.seniority})`
                        : "falta"}
                      {s.gaps.length ? ` · lacunas: ${s.gaps.join(", ")}` : ""}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={!pickedLines.size || busy === "lines"}
              onClick={async () => {
                setBusy("lines");
                try {
                  const r = await fromLines({ data: { dealId, lineItemIds: [...pickedLines] } });
                  const ok = r.filter((x) => x.id && !x.already).length;
                  const errs = r.filter((x) => x.error);
                  if (ok) toast.success(`${ok} perfil(is) criado(s) a partir dos itens de linha`);
                  if (errs.length) toast.error(errs.map((e) => e.error).join(" "));
                  reload();
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setBusy(null);
                }
              }}
            >
              <ListPlus className="mr-1 h-3.5 w-3.5" aria-hidden />
              Criar {pickedLines.size} perfil(is)
            </Button>
          </section>
        ) : null}

        {profiles.length === 0 ? (
          <p className="text-sm text-text-secondary">
            Nenhum perfil de vaga. Ex.: 2 Delphi Sênior + 3 React Pleno = 2 perfis e 5 posições.
          </p>
        ) : (
          <ul className="divide-y divide-product-divider">
            {profiles.map((p) => (
              <li key={p.id} className="py-2 first:pt-0 last:pb-0">
                <button
                  type="button"
                  onClick={() => onOpenProfile(p.id)}
                  className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="min-w-0 truncate text-sm font-medium text-text-primary">
                      {p.title}
                    </span>
                    <Badge variant="outline" className="h-5 tabular-nums">
                      <Users className="mr-1 h-3 w-3" aria-hidden />
                      {p.quantity}
                    </Badge>
                    <RoleProfileStatusBadge status={p.status as never} />
                  </div>
                  <p className="mt-0.5 text-[11px] text-text-tertiary">
                    {p.seniority
                      ? (SENIORITY_LABEL[p.seniority as keyof typeof SENIORITY_LABEL] ??
                        p.seniority)
                      : "Senioridade não informada"}
                    {p.lastVersion ? ` · v${p.lastVersion}` : ""}
                    {p.missing.length && p.status !== "forwarded"
                      ? ` · faltam ${p.missing.length} campo(s)`
                      : ""}
                  </p>
                  {p.divergence.length ? (
                    <p className="mt-0.5 text-[11px] text-warning">
                      Difere do item de linha: {p.divergence.join(", ")} (não alterado
                      automaticamente)
                    </p>
                  ) : null}
                  {p.sourceMissing ? (
                    <p className="mt-0.5 text-[11px] text-text-tertiary">
                      Item de linha de origem removido
                    </p>
                  ) : null}
                </button>
                {p.atsJobId ? (
                  <Link
                    to="/jobs/$id"
                    params={{ id: p.atsJobId }}
                    className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" aria-hidden />
                    TechHire{p.atsOutdated ? " (desatualizado)" : ""}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {(appr.data ?? []).slice(0, 3).map((r) => {
          const failed = r.deliveries.filter(
            (d) => d.status === "failed" || d.status === "pending",
          );
          return (
            <div
              key={r.id}
              className="rounded-md border border-border-subtle p-2 text-[11px] text-text-secondary"
            >
              <p>
                Validação para{" "}
                <span className="font-medium text-text-primary">{r.approverName}</span> ·{" "}
                {r.items.filter((i) => i.status === "pending").length} pendente(s) de{" "}
                {r.items.length}
              </p>
              <p>
                {r.deliveries
                  .map(
                    (d) =>
                      `${d.channel === "email" ? "E-mail" : "Notificação"}: ${DELIVERY_LABEL[d.status] ?? d.status}`,
                  )
                  .join(" · ")}
              </p>
              {r.deliveries
                .filter((d) => d.last_error)
                .map((d) => (
                  <p key={d.id} className="text-destructive">
                    {d.last_error}
                  </p>
                ))}
              {failed.length && perms.update ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-1 h-7 px-2"
                  disabled={busy === r.id}
                  onClick={async () => {
                    setBusy(r.id);
                    try {
                      await retry({ data: { requestId: r.id } });
                      reload();
                    } catch (e) {
                      toast.error((e as Error).message);
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  <RotateCw className="mr-1 h-3 w-3" aria-hidden /> Reenviar avisos
                </Button>
              ) : null}
            </div>
          );
        })}

        {perms.update && profiles.length ? (
          <Button size="sm" className="w-full" onClick={() => openEditor()}>
            <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden /> Editar e solicitar validação
          </Button>
        ) : canCreate ? (
          <Button size="sm" className="w-full" onClick={() => openEditor()}>
            Adicionar perfis
          </Button>
        ) : null}
        {appr.isError ? (
          <p className="flex items-center gap-1 text-[11px] text-destructive">
            <AlertTriangle className="h-3 w-3" aria-hidden /> Não foi possível carregar as
            aprovações.
          </p>
        ) : null}
      </CardContent>

      {editor ? (
        <RoleProfilesEditor
          key={editorKey}
          open
          onOpenChange={(o) => {
            if (!o) setEditor(null);
          }}
          dealId={dealId}
          initialRows={editor.rows}
          focusKey={editor.focus}
          defaultModality={defaultModality}
          onSaved={reload}
        />
      ) : null}
      <RoleProfileImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        dealId={dealId}
        onReview={(r) =>
          openEditor(undefined, [
            {
              key: `import-${r.importId}`,
              revision: 0,
              status: "draft",
              header: { ...r.header, contact_id: null, assigned_to: null },
              data: r.data,
              links: { jobProfileId: null, presetId: null },
              importId: r.importId,
              fieldStatus: r.fieldStatus,
              dirty: true,
            },
          ])
        }
      />
      <RoleProfileDetail
        profileId={openProfileId ?? null}
        dealWon={deal.won}
        onClose={() => onOpenProfile(undefined)}
        onEdit={(i: WizardInitial) => {
          onOpenProfile(undefined);
          openEditor(i.id);
        }}
        onChanged={reload}
      />
    </Card>
  );
}
