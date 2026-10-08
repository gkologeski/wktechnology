import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, BriefcaseBusiness, ExternalLink, LayoutTemplate, Plus, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState, SectionHeader } from "@/components/techhire/ui";
import { createRoleProfile, listDealRoleProfiles } from "@/lib/role-profiles/role-profiles.functions";
import { MODALITY_LABEL, PRIORITY_LABEL, SENIORITY_LABEL, emptyData, type ProfileStatus } from "@/lib/role-profiles/schema";
import { RoleProfileWizard, defaultHeader, type WizardInitial } from "./role-profile-wizard";
import { RoleProfileDetail } from "./role-profile-detail";
import { RoleProfileImportDialog } from "./role-profile-import-dialog";
import { RoleProfileStatusBadge } from "./role-profile-status-badge";

export const roleProfilesKey = (dealId: string) => ["deal-role-profiles", dealId] as const;
const WORK_MODE = { remote: "Remoto", hybrid: "Híbrido", onsite: "Presencial" } as const;

export function RoleProfilesTab({ dealId, openProfileId, onOpenProfile }: { dealId: string; openProfileId?: string; onOpenProfile: (id: string | undefined) => void }) {
  const qc = useQueryClient();
  const list = useServerFn(listDealRoleProfiles);
  const create = useServerFn(createRoleProfile);
  const q = useQuery({ queryKey: roleProfilesKey(dealId), queryFn: () => list({ data: { dealId } }) });
  const [wizard, setWizard] = useState<WizardInitial | null>(null);
  const [wizardKey, setWizardKey] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const reload = () => qc.invalidateQueries({ queryKey: roleProfilesKey(dealId) });
  const openWizard = (i: WizardInitial) => { setWizard(i); setWizardKey((k) => k + 1); };

  if (q.isLoading)
    return (
      <div className="space-y-2" aria-busy="true">
        {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />)}
      </div>
    );
  if (q.isError || !q.data)
    return <EmptyState icon={AlertTriangle} title="Não foi possível carregar os perfis" description={(q.error as Error)?.message} action={<Button variant="outline" onClick={() => q.refetch()}>Tentar de novo</Button>} />;

  const { perms, eligibility, profiles, totals, templates, deal } = q.data;
  const canCreate = perms.create && eligibility.eligible;

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Vagas e perfis"
        description={`${totals.profiles} ${totals.profiles === 1 ? "perfil" : "perfis"} · ${totals.positions} ${totals.positions === 1 ? "posição" : "posições"}`}
        action={
          perms.create ? (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={!canCreate} onClick={() => setImportOpen(true)}>
                <Sparkles className="mr-1 h-3.5 w-3.5" aria-hidden />Importar com IA
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" disabled={!canCreate}><Plus className="mr-1 h-3.5 w-3.5" aria-hidden />Novo perfil</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => openWizard({ header: defaultHeader(), data: emptyData() })}>Em branco</DropdownMenuItem>
                  {templates.length ? <DropdownMenuLabel className="text-xs text-text-tertiary">Modelos</DropdownMenuLabel> : null}
                  {templates.map((t) => (
                    <DropdownMenuItem
                      key={t.id}
                      onSelect={async () => {
                        try {
                          const r = await create({ data: { dealId, header: defaultHeader(), templateId: t.id } });
                          toast.success("Rascunho criado a partir do modelo");
                          await reload();
                          onOpenProfile(r.id);
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                    >
                      <LayoutTemplate className="mr-2 h-3.5 w-3.5" aria-hidden />{t.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null
        }
      />

      {!eligibility.eligible ? (
        <div role="status" className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-text-secondary">
          <p className="font-medium text-text-primary">Este negócio não tem serviço de Outsourcing ou Hunting.</p>
          <p className="mt-1 text-xs">Para criar perfis de vaga, um usuário com permissão de edição do negócio deve adicionar o serviço correspondente nos <span className="font-medium">Itens de linha</span> (painel à direita). Nada é alterado automaticamente.</p>
        </div>
      ) : (
        <p className="text-xs text-text-tertiary">Serviços elegíveis: {eligibility.services.join(", ")}</p>
      )}

      {profiles.length === 0 ? (
        <EmptyState icon={BriefcaseBusiness} title="Nenhum perfil de vaga" description="Cada perfil reúne posições iguais. Ex.: 2 Delphi Sênior e 3 Delphi Pleno são 2 perfis e 5 posições." compact />
      ) : (
        <ul className="divide-y divide-product-divider overflow-hidden rounded-lg border border-border-subtle bg-card">
          {profiles.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onOpenProfile(p.id)} className="grid w-full grid-cols-1 gap-2 px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium text-text-primary">{p.title}</span>
                    <Badge variant="outline" className="tabular-nums"><Users className="mr-1 h-3 w-3" aria-hidden />{p.quantity}</Badge>
                    <RoleProfileStatusBadge status={p.status as ProfileStatus} />
                    {p.atsOutdated ? <Badge variant="outline" className="border-warning/40 text-warning">TechHire desatualizado</Badge> : null}
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">
                    {MODALITY_LABEL[p.modality as keyof typeof MODALITY_LABEL]}
                    {p.seniority ? ` · ${SENIORITY_LABEL[p.seniority as keyof typeof SENIORITY_LABEL] ?? p.seniority}` : " · senioridade não informada"}
                    {p.workMode ? ` · ${WORK_MODE[p.workMode]}` : ""}
                    {` · prioridade ${PRIORITY_LABEL[p.priority as keyof typeof PRIORITY_LABEL].toLowerCase()}`}
                    {` · ${p.assignedName ?? "sem responsável"}`}
                    {p.lastVersion ? ` · v${p.lastVersion}` : ""}
                  </p>
                  {p.missing.length && p.status !== "forwarded" ? <p className="mt-0.5 text-[11px] text-text-tertiary">Falta para aprovar: {p.missing.slice(0, 4).join(", ")}{p.missing.length > 4 ? "…" : ""}</p> : null}
                </div>
                {p.atsJobId ? (
                  <Link to="/jobs/$id" params={{ id: p.atsJobId }} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 self-center text-xs font-medium text-primary hover:underline">
                    <ExternalLink className="h-3 w-3" aria-hidden />Requisição no TechHire
                  </Link>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}

      {wizard ? (
        <RoleProfileWizard
          key={wizardKey}
          open
          onOpenChange={(o) => { if (!o) setWizard(null); }}
          dealId={dealId}
          initial={wizard}
          canCommercial={perms.commercial}
          onSaved={() => { void reload(); void qc.invalidateQueries({ queryKey: ["role-profile"] }); }}
        />
      ) : null}
      <RoleProfileImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        dealId={dealId}
        onReview={(r) => openWizard({ header: { ...r.header, contact_id: null, assigned_to: null }, data: r.data, importId: r.importId, fieldStatus: r.fieldStatus })}
      />
      <RoleProfileDetail
        profileId={openProfileId ?? null}
        dealWon={deal.won}
        onClose={() => onOpenProfile(undefined)}
        onEdit={(i) => openWizard(i)}
        onChanged={() => void reload()}
      />
    </div>
  );
}
