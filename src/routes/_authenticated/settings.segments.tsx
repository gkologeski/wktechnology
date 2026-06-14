import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Filter, Pencil, Plus, RefreshCw, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { FilterBuilderDialog } from "@/components/filter-builder-dialog";
import { EMPTY_FILTER, type FilterGroup } from "@/lib/filters";
import { formatDateTime } from "@/lib/crm";
import {
  SEGMENT_ENTITIES,
  type SegmentEntity,
  listSegments,
  upsertSegment,
  deleteSegment,
  listSegmentMembers,
  refreshSegmentNow,
  removeStaticMember,
} from "@/lib/segments.functions";

type SegmentRow = {
  id: string;
  name: string;
  entity: string;
  kind: "static" | "dynamic";
  filters: unknown;
  enabled: boolean;
  refresh_interval_minutes: number;
  member_count: number;
  last_refreshed_at: string | null;
  created_at: string;
};

const ENTITY_LABEL: Record<string, string> = {
  leads: "Leads",
  contacts: "Contatos",
  companies: "Empresas",
  deals: "Negócios",
};

const ENTITY_FIELDS: Record<
  SegmentEntity,
  { name: string; label: string; type?: string; options?: { value: string; label: string }[] }[]
> = {
  leads: [
    { name: "first_name", label: "Nome", type: "text" },
    { name: "last_name", label: "Sobrenome", type: "text" },
    { name: "email", label: "Email", type: "text" },
    { name: "phone", label: "Telefone", type: "text" },
    { name: "company", label: "Empresa", type: "text" },
    { name: "source", label: "Origem", type: "text" },
    { name: "score", label: "Score", type: "number" },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "new", label: "Novo" },
        { value: "contacted", label: "Contatado" },
        { value: "qualified", label: "Qualificado" },
        { value: "disqualified", label: "Desqualificado" },
      ],
    },
    { name: "created_at", label: "Criado em", type: "date" },
  ],
  contacts: [
    { name: "first_name", label: "Nome", type: "text" },
    { name: "last_name", label: "Sobrenome", type: "text" },
    { name: "email", label: "Email", type: "text" },
    { name: "phone", label: "Telefone", type: "text" },
    { name: "title", label: "Cargo", type: "text" },
    { name: "score", label: "Score", type: "number" },
    {
      name: "marketing_status",
      label: "Status de marketing",
      type: "select",
      options: [
        { value: "marketing", label: "Marketing" },
        { value: "non_marketing", label: "Não marketing" },
        { value: "unsubscribed", label: "Descadastrado" },
      ],
    },
    { name: "created_at", label: "Criado em", type: "date" },
  ],
  companies: [
    { name: "name", label: "Nome", type: "text" },
    { name: "domain", label: "Domínio", type: "text" },
    { name: "industry", label: "Setor", type: "text" },
    { name: "city", label: "Cidade", type: "text" },
    { name: "state", label: "UF", type: "text" },
    {
      name: "is_target_account",
      label: "Target account",
      type: "select",
      options: [
        { value: "true", label: "Sim" },
        { value: "false", label: "Não" },
      ],
    },
    { name: "created_at", label: "Criado em", type: "date" },
  ],
  deals: [
    { name: "name", label: "Nome", type: "text" },
    { name: "amount", label: "Valor", type: "number" },
    {
      name: "stage",
      label: "Etapa",
      type: "select",
      options: [
        { value: "new", label: "Novo" },
        { value: "qualified", label: "Qualificado" },
        { value: "proposal", label: "Proposta" },
        { value: "negotiation", label: "Negociação" },
        { value: "won", label: "Ganho" },
        { value: "lost", label: "Perdido" },
      ],
    },
    { name: "close_date", label: "Data de fechamento", type: "date" },
    { name: "created_at", label: "Criado em", type: "date" },
  ],
};

export const Route = createFileRoute("/_authenticated/settings/segments")({
  component: SegmentsPage,
});

function SegmentsPage() {
  const list = useServerFn(listSegments);
  const remove = useServerFn(deleteSegment);
  const refresh = useServerFn(refreshSegmentNow);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["segments"],
    queryFn: async () => (await list()).segments as SegmentRow[],
  });

  const [editing, setEditing] = useState<SegmentRow | null>(null);
  const [open, setOpen] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const removeMut = useMutation({
    mutationFn: async (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Lista removida");
      qc.invalidateQueries({ queryKey: ["segments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const refreshMut = useMutation({
    mutationFn: async (id: string) => refresh({ data: { id } }),
    onSuccess: (r) => {
      toast.success(`Lista atualizada: ${r.count} membros`);
      qc.invalidateQueries({ queryKey: ["segments"] });
      qc.invalidateQueries({ queryKey: ["segment-members"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Listas"
        description="Listas estáticas (manuais) e dinâmicas (atualizadas automaticamente por filtros)."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" /> Nova lista
          </Button>
        }
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Entidade</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Membros</TableHead>
              <TableHead>Atualizada</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-44 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                  Carregando…
                </TableCell>
              </TableRow>
            )}
            {q.data && q.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                  Nenhuma lista criada ainda.
                </TableCell>
              </TableRow>
            )}
            {q.data?.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{ENTITY_LABEL[s.entity] ?? s.entity}</TableCell>
                <TableCell>
                  <Badge variant={s.kind === "dynamic" ? "default" : "secondary"}>
                    {s.kind === "dynamic" ? "Dinâmica" : "Estática"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{s.member_count}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDateTime(s.last_refreshed_at)}
                </TableCell>
                <TableCell>
                  <Badge variant={s.enabled ? "outline" : "secondary"}>
                    {s.enabled ? "Ativa" : "Pausada"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => setViewingId(s.id)}
                      title="Ver membros"
                    >
                      <Users className="h-4 w-4" />
                    </Button>
                    {s.kind === "dynamic" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        disabled={refreshMut.isPending}
                        onClick={() => refreshMut.mutate(s.id)}
                        title="Atualizar agora"
                      >
                        <RefreshCw
                          className={`h-4 w-4 ${refreshMut.isPending ? "animate-spin" : ""}`}
                        />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditing(s);
                        setOpen(true);
                      }}
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => removeMut.mutate(s.id)}
                      title="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <SegmentDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["segments"] })}
      />

      <MembersSheet segmentId={viewingId} onClose={() => setViewingId(null)} />
    </div>
  );
}

function normalizeFiltersForBuilder(raw: unknown): FilterGroup {
  if (!raw || typeof raw !== "object") return EMPTY_FILTER;
  const r = raw as Record<string, unknown>;
  if (r.type === "group") return raw as FilterGroup;
  if (Array.isArray(r.conditions)) {
    return {
      type: "group",
      op: (r.op as "and" | "or") ?? "and",
      conditions: (r.conditions as Record<string, unknown>[]).map((c) =>
        c.type ? (c as never) : ({ type: "condition", ...c } as never),
      ),
    };
  }
  return EMPTY_FILTER;
}

function SegmentDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: SegmentRow | null;
  onSaved: () => void;
}) {
  const upsert = useServerFn(upsertSegment);
  const [name, setName] = useState(editing?.name ?? "");
  const [entity, setEntity] = useState<SegmentEntity>(
    (editing?.entity as SegmentEntity) ?? "contacts",
  );
  const [kind, setKind] = useState<"static" | "dynamic">(editing?.kind ?? "dynamic");
  const [enabled, setEnabled] = useState(editing?.enabled ?? true);
  const [interval, setInterval] = useState(editing?.refresh_interval_minutes ?? 60);
  const [filters, setFilters] = useState<FilterGroup>(normalizeFiltersForBuilder(editing?.filters));
  const [filterOpen, setFilterOpen] = useState(false);

  // Reset on editing change
  useMemo(() => {
    setName(editing?.name ?? "");
    setEntity((editing?.entity as SegmentEntity) ?? "contacts");
    setKind(editing?.kind ?? "dynamic");
    setEnabled(editing?.enabled ?? true);
    setInterval(editing?.refresh_interval_minutes ?? 60);
    setFilters(normalizeFiltersForBuilder(editing?.filters));
  }, [editing]);

  const save = useMutation({
    mutationFn: async () =>
      upsert({
        data: {
          id: editing?.id,
          name: name.trim(),
          entity,
          kind,
          filters,
          enabled,
          refresh_interval_minutes: interval,
        },
      }),
    onSuccess: () => {
      toast.success(editing ? "Lista atualizada" : "Lista criada");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar lista" : "Nova lista"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Leads quentes SP"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Entidade</Label>
                <Select value={entity} onValueChange={(v) => setEntity(v as SegmentEntity)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEGMENT_ENTITIES.map((e) => (
                      <SelectItem key={e} value={e}>
                        {ENTITY_LABEL[e]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={kind} onValueChange={(v) => setKind(v as "static" | "dynamic")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dynamic">Dinâmica (filtros)</SelectItem>
                    <SelectItem value="static">Estática (manual)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {kind === "dynamic" && (
              <>
                <div>
                  <Label>Filtros</Label>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setFilterOpen(true)}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    {filters.conditions.length === 0
                      ? "Definir filtros…"
                      : `${filters.conditions.length} condição(ões) — ${filters.op.toUpperCase()}`}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Atualizar a cada (min)</Label>
                    <Input
                      type="number"
                      min={5}
                      max={1440}
                      value={interval}
                      onChange={(e) => setInterval(Number(e.target.value))}
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <Switch checked={enabled} onCheckedChange={setEnabled} id="enabled" />
                    <Label htmlFor="enabled" className="mb-2">
                      Ativa
                    </Label>
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !name.trim()}>
              {save.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FilterBuilderDialog
        open={filterOpen}
        setOpen={setFilterOpen}
        fields={ENTITY_FIELDS[entity]}
        value={filters}
        onApply={(g) => setFilters(g)}
      />
    </>
  );
}

function MembersSheet({ segmentId, onClose }: { segmentId: string | null; onClose: () => void }) {
  const listMembers = useServerFn(listSegmentMembers);
  const removeMember = useServerFn(removeStaticMember);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["segment-members", segmentId],
    enabled: !!segmentId,
    queryFn: async () => listMembers({ data: { segmentId: segmentId!, limit: 200 } }),
  });

  const removeMut = useMutation({
    mutationFn: async (entityId: string) =>
      removeMember({ data: { segmentId: segmentId!, entityId } }),
    onSuccess: () => {
      toast.success("Membro removido");
      qc.invalidateQueries({ queryKey: ["segment-members", segmentId] });
      qc.invalidateQueries({ queryKey: ["segments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Sheet open={!!segmentId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[520px] sm:max-w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Membros da lista</SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          {q.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {q.data && q.data.rows.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum membro nesta lista.</p>
          )}
          {q.data && q.data.rows.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Registro</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(q.data.rows as unknown as Record<string, unknown>[]).map((row) => {
                    const label =
                      (row.name as string) ||
                      [row.first_name, row.last_name].filter(Boolean).join(" ") ||
                      (row.email as string) ||
                      (row.id as string);
                    return (
                      <TableRow key={row.id as string}>
                        <TableCell>
                          <div className="font-medium">{String(label ?? "")}</div>
                          {row.email ? (
                            <div className="text-xs text-muted-foreground">{String(row.email)}</div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            onClick={() => removeMut.mutate(row.id as string)}
                            title="Remover desta lista"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
