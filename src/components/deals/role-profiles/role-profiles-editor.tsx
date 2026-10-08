// Editor único de vários perfis de vaga (substitui o wizard em etapas).
// Lista de perfis com resumo, seções expansíveis, adicionar vários cargos,
// duplicar, aplicar campos comuns, salvar em lote e solicitar validação.
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ChevronDown, Copy, Loader2, Save, Send, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  archiveRoleProfile,
  createRoleProfile,
  requestRoleProfileValidation,
  resolveRoleProfileApprover,
  saveRoleProfilesBatch,
} from "@/lib/role-profiles/role-profiles.functions";
import {
  SECTION_LABEL,
  SENIORITY_LABEL,
  approvalMissing,
  emptyData,
  type Modality,
  type ProfileData,
  type ProfileHeader,
  type SectionKey,
} from "@/lib/role-profiles/schema";
import { normalizeSeniority } from "@/lib/role-profiles/eligibility";
import { ProfileSection, defaultHeader, type FieldStatus } from "./profile-fields";
import { RoleProfileStatusBadge } from "./role-profile-status-badge";
import {
  AddTitlesPicker,
  RoleProfileTitlePicker,
  type TitleOption,
} from "./role-profile-title-picker";
import { COMMON_GROUPS, applyCommon, overwrittenBy, type CommonGroup } from "./apply-common";

const SECTIONS: SectionKey[] = [
  "need",
  "role",
  "requirements",
  "conditions",
  "commercial",
  "selection",
];
const EDITABLE = new Set(["draft", "awaiting_info", "in_validation", "approved", "forwarded"]);

export type EditorRow = {
  key: string;
  id?: string;
  revision: number;
  status: string;
  header: ProfileHeader;
  data: ProfileData;
  links: { jobProfileId: string | null; presetId: string | null };
  fieldStatus?: FieldStatus;
  importId?: string;
  dirty: boolean;
  error?: string;
};

let seq = 0;
const newKey = () => `new-${Date.now()}-${seq++}`;

export function rowFromTitle(o: TitleOption, modality: Modality): EditorRow {
  return {
    key: newKey(),
    revision: 0,
    status: "draft",
    header: {
      ...defaultHeader(),
      title: o.name,
      modality,
      seniority: normalizeSeniority(o.seniority),
    },
    data: emptyData(),
    links: {
      jobProfileId: o.jobProfileId,
      presetId: o.kind === "preset" ? o.id : null,
    },
    dirty: true,
  };
}

export function RoleProfilesEditor({
  open,
  onOpenChange,
  dealId,
  initialRows,
  focusKey,
  defaultModality,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  dealId: string;
  initialRows: EditorRow[];
  focusKey?: string;
  defaultModality: Modality;
  onSaved: () => void;
}) {
  const members = useWorkspaceMembers();
  const create = useServerFn(createRoleProfile);
  const saveBatch = useServerFn(saveRoleProfilesBatch);
  const resolve = useServerFn(resolveRoleProfileApprover);
  const request = useServerFn(requestRoleProfileValidation);
  const archive = useServerFn(archiveRoleProfile);

  const [rows, setRows] = useState<EditorRow[]>(initialRows);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(focusKey ? [focusKey] : initialRows.length === 1 ? [initialRows[0]!.key] : []),
  );
  const [saving, setSaving] = useState(false);
  const [commonOpen, setCommonOpen] = useState(false);
  const [validateOpen, setValidateOpen] = useState(false);

  useEffect(() => {
    if (focusKey)
      document.getElementById(`rp-card-${focusKey}`)?.scrollIntoView({ block: "start" });
  }, [focusKey]);

  const update = (key: string, fn: (r: EditorRow) => EditorRow) =>
    setRows((xs) =>
      xs.map((r) => (r.key === key ? { ...fn(r), dirty: true, error: undefined } : r)),
    );
  const toggleSel = (key: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  const toggleExp = (key: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  const totals = useMemo(
    () => ({
      profiles: rows.length,
      positions: rows.reduce((a, r) => a + (r.header.quantity || 0), 0),
    }),
    [rows],
  );
  const dirtyCount = rows.filter((r) => r.dirty).length;
  const selRows = rows.filter((r) => selected.has(r.key));

  /** Salva as linhas indicadas; retorna as linhas atualizadas (com ids/revisões). */
  async function saveRows(keys: Set<string>): Promise<EditorRow[] | null> {
    const target = rows.filter((r) => keys.has(r.key) && r.dirty);
    const invalid = target.filter((r) => !r.header.title.trim() || !(r.header.quantity >= 1));
    if (invalid.length) {
      setRows((xs) =>
        xs.map((r) =>
          invalid.some((i) => i.key === r.key)
            ? { ...r, error: "Selecione o cargo e informe a quantidade (mínimo 1)." }
            : r,
        ),
      );
      setExpanded((s) => new Set([...s, ...invalid.map((i) => i.key)]));
      toast.error(`${invalid.length} perfil(is) com campos obrigatórios faltando.`);
      return null;
    }
    if (!target.length) return rows;
    setSaving(true);
    const next = new Map(rows.map((r) => [r.key, r] as const));
    try {
      // Novos: criação individual (idempotente por item de linha quando houver).
      for (const r of target.filter((x) => !x.id)) {
        try {
          const res = await create({
            data: {
              dealId,
              header: r.header,
              data: r.data,
              importId: r.importId,
              links: {
                jobProfileId: r.links.jobProfileId ?? undefined,
                presetId: r.links.presetId ?? undefined,
              },
            },
          });
          next.set(r.key, {
            ...r,
            id: res.id,
            revision: 1,
            dirty: false,
            error: undefined,
            importId: undefined,
          });
        } catch (e) {
          next.set(r.key, { ...r, error: (e as Error).message });
        }
      }
      const existing = target.filter((x) => x.id);
      if (existing.length) {
        const res = await saveBatch({
          data: {
            items: existing.map((r) => ({
              id: r.id!,
              expectedRevision: r.revision,
              header: r.header,
              data: r.data,
              links: r.links,
            })),
          },
        });
        for (const out of res) {
          const r = existing.find((x) => x.id === out.id)!;
          next.set(
            r.key,
            out.error
              ? { ...r, error: out.error }
              : {
                  ...r,
                  revision: out.revision!,
                  status: out.status ?? r.status,
                  dirty: false,
                  error: undefined,
                },
          );
        }
      }
    } finally {
      setSaving(false);
    }
    const list = rows.map((r) => next.get(r.key)!);
    setRows(list);
    const failed = list.filter((r) => keys.has(r.key) && r.error);
    if (failed.length) {
      const savedCount = keys.size - failed.length;
      toast.error(
        failed.length === 1
          ? `Perfil "${failed[0].header.title || "sem título"}" não foi salvo.`
          : `${failed.length} perfis não foram salvos.`,
        {
          description: `${failed[0].error ?? ""}${savedCount > 0 ? ` Os outros ${savedCount} foram salvos.` : ""}`,
        },
      );
      setExpanded((s) => new Set([...s, ...failed.map((f) => f.key)]));
    } else toast.success("Rascunhos salvos. Nada foi enviado para aprovação.");
    onSaved();
    return failed.length ? null : list;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-4xl">
        <SheetHeader className="border-b border-product-divider px-4 py-4 text-left sm:px-6">
          <SheetTitle>Vagas e perfis do negócio</SheetTitle>
          <SheetDescription>
            {totals.profiles} {totals.profiles === 1 ? "perfil" : "perfis"} · {totals.positions}{" "}
            {totals.positions === 1 ? "posição" : "posições"}. Salvar não aprova nem encaminha.
          </SheetDescription>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 pr-1">
              <Checkbox
                id="rp-sel-all"
                checked={rows.length > 0 && selected.size === rows.length}
                onCheckedChange={(v) =>
                  setSelected(v ? new Set(rows.map((r) => r.key)) : new Set())
                }
              />
              <Label htmlFor="rp-sel-all" className="text-xs text-text-secondary">
                Todos
              </Label>
            </div>
            <AddTitlesPicker
              onAdd={(xs) => {
                const add = xs.map((o) => rowFromTitle(o, defaultModality));
                setRows((r) => [...r, ...add]);
                setExpanded((s) => new Set([...s, ...add.map((a) => a.key)]));
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!selRows.length}
              onClick={() => {
                const copies = selRows.map((r) => ({
                  ...r,
                  key: newKey(),
                  id: undefined,
                  revision: 0,
                  status: "draft",
                  importId: undefined,
                  header: { ...r.header, title: r.header.title },
                  data: structuredClone(r.data),
                  dirty: true,
                  error: undefined,
                }));
                setRows((xs) => [...xs, ...copies]);
                toast.success(`${copies.length} perfil(is) duplicado(s). Salve para manter.`);
              }}
            >
              <Copy className="mr-1 h-3.5 w-3.5" aria-hidden /> Duplicar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={selRows.length < 2}
              title={selRows.length < 2 ? "Selecione ao menos 2 perfis" : undefined}
              onClick={() => setCommonOpen(true)}
            >
              Aplicar campos comuns
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-6">
          {rows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border-subtle p-6 text-center text-sm text-text-secondary">
              Nenhum perfil ainda. Use <span className="font-medium">Adicionar cargos</span> para
              escolher um ou mais cargos/presets.
            </p>
          ) : null}
          {rows.map((r) => {
            const isOpen = expanded.has(r.key);
            const missing = approvalMissing({ ...r.header, data: r.data });
            const locked = !EDITABLE.has(r.status);
            const p = `rp-${r.key}`;
            return (
              <Collapsible
                key={r.key}
                open={isOpen}
                onOpenChange={() => toggleExp(r.key)}
                className={cn(
                  "rounded-lg border bg-card",
                  r.error ? "border-destructive/50" : "border-border-subtle",
                )}
              >
                <div id={`rp-card-${r.key}`} className="flex items-start gap-3 px-3 py-3 sm:px-4">
                  <Checkbox
                    className="mt-1"
                    aria-label={`Selecionar ${r.header.title || "perfil"}`}
                    checked={selected.has(r.key)}
                    onCheckedChange={() => toggleSel(r.key)}
                  />
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium text-text-primary">
                          {r.header.title || "Sem cargo selecionado"}
                        </span>
                        <Badge variant="outline" className="tabular-nums">
                          <Users className="mr-1 h-3 w-3" aria-hidden />
                          {r.header.quantity}
                        </Badge>
                        <RoleProfileStatusBadge status={r.status as never} />
                        {!r.id ? <Badge variant="outline">Novo</Badge> : null}
                        {r.dirty && r.id ? (
                          <Badge variant="outline" className="border-warning/40 text-warning">
                            Não salvo
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-text-secondary">
                        {r.header.seniority
                          ? SENIORITY_LABEL[r.header.seniority]
                          : "Senioridade não informada"}
                        {missing.length
                          ? ` · falta para aprovar: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? "…" : ""}`
                          : " · pronto para validação"}
                      </p>
                      {r.error ? (
                        <p role="alert" className="mt-1 text-xs text-destructive">
                          {r.error}
                        </p>
                      ) : null}
                    </button>
                  </CollapsibleTrigger>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={r.id ? "Excluir perfil" : "Remover perfil não salvo"}
                    title={r.id ? "Excluir perfil" : "Remover perfil não salvo"}
                    onClick={async () => {
                      if (!r.id) {
                        setRows((xs) => xs.filter((x) => x.key !== r.key));
                        return;
                      }
                      const ok = await confirmDialog({
                        title: "Excluir perfil?",
                        description:
                          "O perfil sai do negócio. Histórico e versões aprovadas ficam guardados.",
                        confirmLabel: "Excluir",
                        variant: "destructive",
                      });
                      if (!ok) return;
                      try {
                        await archive({ data: { id: r.id } });
                        setRows((xs) => xs.filter((x) => x.key !== r.key));
                        toast.success("Perfil excluído");
                        onSaved();
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Falha ao excluir");
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                  <ChevronDown
                    className={cn(
                      "mt-1 h-4 w-4 text-text-tertiary transition-transform",
                      isOpen && "rotate-180",
                    )}
                    aria-hidden
                  />
                </div>
                <CollapsibleContent className="border-t border-product-divider px-3 pb-4 sm:px-4">
                  <fieldset disabled={locked || saving} className="space-y-1">
                    {SECTIONS.map((sec) => (
                      <ProfileSection
                        key={sec}
                        section={sec}
                        idPrefix={p}
                        h={r.header}
                        setH={(h) => update(r.key, (x) => ({ ...x, header: h }))}
                        d={r.data}
                        setD={(d) => update(r.key, (x) => ({ ...x, data: d }))}
                        fs={r.fieldStatus}
                        members={members.data ?? []}
                        titleSlot={
                          <RoleProfileTitlePicker
                            id={`${p}-title`}
                            title={r.header.title}
                            jobProfileId={r.links.jobProfileId}
                            presetId={r.links.presetId}
                            onPick={(o) =>
                              update(r.key, (x) => ({
                                ...x,
                                header: {
                                  ...x.header,
                                  title: o.name,
                                  seniority: x.header.seniority ?? normalizeSeniority(o.seniority),
                                },
                                links: {
                                  jobProfileId: o.jobProfileId,
                                  presetId: o.kind === "preset" ? o.id : null,
                                },
                              }))
                            }
                          />
                        }
                      />
                    ))}
                  </fieldset>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>

        <footer className="flex flex-wrap items-center gap-2 border-t border-product-divider px-4 py-3 sm:px-6">
          <span className="text-xs text-text-tertiary">
            {selected.size} selecionado(s) · {dirtyCount} com alterações
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving || !dirtyCount}
              onClick={() => void saveRows(new Set(rows.map((r) => r.key)))}
            >
              {saving ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Save className="mr-1 h-4 w-4" aria-hidden />
              )}
              Salvar rascunhos
            </Button>
            <Button
              type="button"
              disabled={saving || !selRows.length}
              onClick={async () => {
                const saved = await saveRows(new Set(selRows.map((r) => r.key)));
                if (saved) setValidateOpen(true);
              }}
            >
              <Send className="mr-1 h-4 w-4" aria-hidden />
              Solicitar validação ({selRows.length})
            </Button>
          </div>
        </footer>

        {commonOpen ? (
          <ApplyCommonDialog
            rows={selRows}
            onClose={() => setCommonOpen(false)}
            onApply={(sourceKey, groups) => {
              const src = rows.find((r) => r.key === sourceKey)!;
              setRows((xs) =>
                xs.map((r) =>
                  selected.has(r.key) && r.key !== sourceKey && EDITABLE.has(r.status)
                    ? { ...r, data: applyCommon(src.data, r.data, groups), dirty: true }
                    : r,
                ),
              );
              setCommonOpen(false);
              toast.success("Campos aplicados. Revise e salve os rascunhos.");
            }}
          />
        ) : null}
        {validateOpen ? (
          <ValidateDialog
            dealId={dealId}
            rows={rows.filter((r) => selected.has(r.key) && r.id)}
            resolve={(dealId) => resolve({ data: { dealId } })}
            send={(expected, key) => request({ data: { dealId, expected, key } })}
            onClose={() => setValidateOpen(false)}
            onDone={(ids) => {
              setRows((xs) =>
                xs.map((r) =>
                  r.id && ids.includes(r.id)
                    ? { ...r, status: "in_validation", revision: r.revision + 1 }
                    : r,
                ),
              );
              setSelected(new Set());
              setValidateOpen(false);
              onSaved();
            }}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function ApplyCommonDialog({
  rows,
  onClose,
  onApply,
}: {
  rows: EditorRow[];
  onClose: () => void;
  onApply: (sourceKey: string, groups: CommonGroup[]) => void;
}) {
  const [source, setSource] = useState(rows[0]?.key ?? "");
  const [groups, setGroups] = useState<CommonGroup[]>([]);
  const src = rows.find((r) => r.key === source);
  const affected = src
    ? rows
        .filter((r) => r.key !== source)
        .map((r) => ({ r, fields: overwrittenBy(src.data, r.data, groups) }))
        .filter((x) => x.fields.length)
    : [];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Aplicar campos comuns</DialogTitle>
          <DialogDescription>
            Copia as seções escolhidas do perfil de origem para os demais selecionados.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-text-secondary">Perfil de origem</Label>
            <div className="flex flex-wrap gap-1.5">
              {rows.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  aria-pressed={r.key === source}
                  onClick={() => setSource(r.key)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    r.key === source
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border-subtle text-text-secondary hover:bg-muted",
                  )}
                >
                  {r.header.title || "Sem cargo"}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-text-secondary">Seções</Label>
            {COMMON_GROUPS.map((g) => (
              <div key={g.key} className="flex items-center gap-2">
                <Checkbox
                  id={`cg-${g.key}`}
                  checked={groups.includes(g.key)}
                  onCheckedChange={(v) =>
                    setGroups((xs) => (v ? [...xs, g.key] : xs.filter((x) => x !== g.key)))
                  }
                />
                <Label htmlFor={`cg-${g.key}`} className="text-sm">
                  {g.label}
                </Label>
              </div>
            ))}
          </div>
          {affected.length ? (
            <div
              role="alert"
              className="rounded-md border border-warning/30 bg-warning/5 p-3 text-xs"
            >
              <p className="flex items-center gap-1 font-medium text-text-primary">
                <AlertTriangle className="h-3.5 w-3.5 text-warning" aria-hidden /> Vai sobrescrever
                valores já preenchidos:
              </p>
              <ul className="mt-1 list-disc pl-5 text-text-secondary">
                {affected.map(({ r, fields }) => (
                  <li key={r.key}>
                    {r.header.title || "Sem cargo"}: {fields.join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!groups.length || !src} onClick={() => onApply(source, groups)}>
            {affected.length ? "Sobrescrever e aplicar" : "Aplicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Resolved = Awaited<ReturnType<typeof resolveRoleProfileApprover>>;

function ValidateDialog({
  dealId,
  rows,
  resolve,
  send,
  onClose,
  onDone,
}: {
  dealId: string;
  rows: EditorRow[];
  resolve: (dealId: string) => Promise<Resolved>;
  send: (
    expected: Record<string, number>,
    key: string,
  ) => Promise<{
    requestId: string;
    already: boolean;
    deliveries: { status: string; error?: string }[];
  }>;
  onClose: () => void;
  onDone: (ids: string[]) => void;
}) {
  const [info, setInfo] = useState<Resolved | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const keyRef = useRef(crypto.randomUUID());
  useEffect(() => {
    resolve(dealId).then(setInfo, (e: Error) => setErr(e.message));
  }, [dealId, resolve]);
  const blocked = rows.filter(
    (r) => !["draft", "awaiting_info", "in_validation"].includes(r.status),
  );
  const ok = info?.status === "ok" && !blocked.length && rows.length > 0;
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Solicitar validação</DialogTitle>
          <DialogDescription>
            Uma única solicitação agrupada é enviada ao líder da equipe do responsável pelo negócio,
            com decisão por perfil.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <ul className="space-y-1 rounded-md border border-border-subtle p-3">
            {rows.map((r) => (
              <li key={r.key} className="flex justify-between gap-2">
                <span className="truncate">{r.header.title}</span>
                <span className="tabular-nums text-text-secondary">{r.header.quantity}</span>
              </li>
            ))}
          </ul>
          {blocked.length ? (
            <p role="alert" className="text-xs text-destructive">
              Já aprovados/encaminhados não entram: {blocked.map((b) => b.header.title).join(", ")}.
              Edite-os para gerar nova versão.
            </p>
          ) : null}
          {err ? (
            <p role="alert" className="text-destructive">
              {err}
            </p>
          ) : !info ? (
            <p className="flex items-center gap-2 text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Identificando aprovador…
            </p>
          ) : info.status === "ok" ? (
            <div className="rounded-md border border-border-subtle bg-muted/40 p-3">
              <p className="text-xs text-text-secondary">Aprovador</p>
              <p className="font-medium text-text-primary">{info.leaderName}</p>
              <p className="text-xs text-text-tertiary">
                Líder de {info.groups.map((g) => g.name).join(", ")} · responsável do negócio:{" "}
                {info.ownerName}
              </p>
              <p className="mt-1 text-xs text-text-tertiary">
                Recebe e-mail e notificação interna com link para aprovar ou pedir ajustes.
              </p>
            </div>
          ) : (
            <div role="alert" className="rounded-md border border-warning/30 bg-warning/5 p-3">
              <p className="font-medium text-text-primary">Correção necessária antes de enviar</p>
              <p className="mt-1 text-xs text-text-secondary">{info.problem}</p>
              {info.candidates.length > 1 ? (
                <p className="mt-1 text-xs text-text-tertiary">
                  Líderes encontrados: {info.candidates.map((c) => c.name).join(", ")}
                </p>
              ) : null}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            disabled={!ok || busy}
            onClick={async () => {
              setBusy(true);
              try {
                const expected = Object.fromEntries(rows.map((r) => [r.id!, r.revision]));
                const r = await send(expected, keyRef.current);
                const failed = r.deliveries.filter((d) => d.status === "failed");
                if (failed.length)
                  toast.warning(
                    `Solicitação registrada, mas ${failed.length} aviso(s) falharam: ${failed[0]?.error ?? ""}. Reenvie pelo quadro.`,
                  );
                else toast.success(`Validação solicitada a ${info?.leaderName}.`);
                onDone(rows.map((x) => x.id!));
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden /> : null}
            Enviar ao líder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
