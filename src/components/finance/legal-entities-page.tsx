import { useFinanceBusinessCapabilities } from "@/lib/access-control/use-finance-business-capabilities";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Star, Trash2, Pencil, Wand2, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LegalEntityCnpjFillDialog } from "@/components/finance/legal-entity-cnpj-fill-dialog";
import { formatCnpj } from "@/lib/cnpj";
import {
  listLegalEntitiesSummary,
  upsertLegalEntity,
  setDefaultLegalEntity,
  deleteLegalEntity,
  getLegalEntity,
  getLegalEntityUsage,
  setLegalEntityActive,
} from "@/lib/legal-entities.functions";

type LE = {
  id: string;
  code: string | null;
  name: string;
  cnpj: string | null;
  is_default: boolean;
  active: boolean;
  totals: { receivable: number; payable: number; count: number };
};

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function LegalEntitiesPage() {
  const financePermissions = usePermissions();
  const qc = useQueryClient();
  const list = useServerFn(listLegalEntitiesSummary);
  const upsert = useServerFn(upsertLegalEntity);
  const setDefault = useServerFn(setDefaultLegalEntity);
  const del = useServerFn(deleteLegalEntity);
  const getEntity = useServerFn(getLegalEntity);
  const getUsage = useServerFn(getLegalEntityUsage);
  const setActive = useServerFn(setLegalEntityActive);
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("all");
  const [search, setSearch] = useState("");

  const {
    data: allRows = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["legal-entities", financePermissions.workspaceId],
    queryFn: () => list() as Promise<LE[]>,
  });
  const term = search.trim().toLowerCase();
  const digits = term.replace(/\D/g, "");
  const rows = allRows.filter((r) => {
    if (statusFilter === "active" && !r.active) return false;
    if (statusFilter === "inactive" && r.active) return false;
    if (!term) return true;
    return (
      r.name.toLowerCase().includes(term) ||
      (r.code ?? "").toLowerCase().includes(term) ||
      (!!digits && (r.cnpj ?? "").includes(digits))
    );
  });

  const recordAccess = useFinanceBusinessCapabilities(
    "legal_entities",
    rows.map((r) => r.id),
  );
  const canCreate = financePermissions.canAny([
    "techfinance.legal_entities.create.workspace",
    "techfinance.legal_entities.create.own",
  ]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cnpjFillOpen, setCnpjFillOpen] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState<string | null>(null);
  const [form, setForm] = useState<{
    id?: string;
    code: string;
    name: string;
    trade_name: string;
    cnpj: string;
    ie: string;
    im: string;
    active: boolean;
  }>({ code: "", name: "", trade_name: "", cnpj: "", ie: "", im: "", active: true });

  function openCreate() {
    setForm({ code: "", name: "", trade_name: "", cnpj: "", ie: "", im: "", active: true });
    setOpen(true);
  }

  // Carrega a empresa completa: o resumo da grid não traz trade_name/ie/im e
  // salvar com esses campos vazios apagava os dados.
  async function openEdit(row: LE) {
    setLoadingEdit(row.id);
    try {
      const full = await getEntity({ data: { id: row.id } });
      setForm({
        id: full.id,
        code: full.code ?? "",
        name: full.name,
        trade_name: full.trade_name ?? "",
        cnpj: formatCnpj(full.cnpj),
        ie: full.ie ?? "",
        im: full.im ?? "",
        active: full.active,
      });
      setOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar empresa");
    } finally {
      setLoadingEdit(null);
    }
  }

  async function submit() {
    if (saving) return;
    if (!form.name.trim()) {
      toast.error("Informe o nome");
      return;
    }
    setSaving(true);
    try {
      await upsert({
        data: {
          id: form.id,
          code: form.code.trim() || null,
          name: form.name.trim(),
          trade_name: form.trade_name.trim() || null,
          cnpj: form.cnpj.trim() || null,
          ie: form.ie.trim() || null,
          im: form.im.trim() || null,
          active: form.active,
        },
      });
      toast.success(form.id ? "Empresa atualizada" : "Empresa criada");
      qc.invalidateQueries({ queryKey: ["legal-entities", financePermissions.workspaceId] });
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      setSaving(false);
    }
  }

  async function makeDefault(id: string) {
    try {
      await setDefault({ data: { id } });
      toast.success("Empresa padrão definida");
      qc.invalidateQueries({ queryKey: ["legal-entities", financePermissions.workspaceId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }

  async function toggleActive(row: LE) {
    if (row.active && row.is_default) {
      toast.error("Defina outra empresa como padrão antes de desativar esta.");
      return;
    }
    const ok = await confirmDialog(
      row.active
        ? `Desativar ${row.name}? Lançamentos e registros vinculados são mantidos; a empresa só deixa de aparecer em novos cadastros.`
        : `Reativar ${row.name}?`,
    );
    if (!ok) return;
    try {
      await setActive({ data: { id: row.id, active: !row.active } });
      toast.success(row.active ? "Empresa desativada" : "Empresa reativada");
      qc.invalidateQueries({ queryKey: ["legal-entities", financePermissions.workspaceId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }

  async function remove(row: LE) {
    if (row.is_default) {
      toast.error("Defina outra empresa como padrão antes de excluir esta.");
      return;
    }
    let usage: Record<string, number> = {};
    try {
      usage = await getUsage({ data: { id: row.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao verificar vínculos");
      return;
    }
    const linked = Object.entries(usage);
    if (linked.length > 0) {
      const detail = linked.map(([k, v]) => `${k}: ${v}`).join("; ");
      if (
        row.active &&
        (await confirmDialog(
          `${row.name} não pode ser excluída porque tem registros vinculados (${detail}). Deseja desativá-la em vez disso? Nada será apagado.`,
        ))
      ) {
        try {
          await setActive({ data: { id: row.id, active: false } });
          toast.success("Empresa desativada");
          qc.invalidateQueries({ queryKey: ["legal-entities", financePermissions.workspaceId] });
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Falha");
        }
      } else if (!row.active) {
        toast.error(`Não é possível excluir: ${detail}.`);
      }
      return;
    }
    if (!(await confirmDialog(`Excluir ${row.name} definitivamente? Não há registros vinculados.`)))
      return;
    try {
      await del({ data: { id: row.id } });
      toast.success("Excluída");
      qc.invalidateQueries({ queryKey: ["legal-entities", financePermissions.workspaceId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Empresas (CNPJs)"
        description="Gerencie os CNPJs (entidades legais) associados a este workspace. Contas, categorias e lançamentos podem ser atribuídos a uma empresa específica."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!financePermissions.can("techfinance.legal_entities.update.workspace")}
              onClick={() => setCnpjFillOpen(true)}
            >
              <Wand2 className="h-4 w-4 mr-1" /> Preencher CNPJs
            </Button>
            <Button disabled={!canCreate} onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Nova empresa
            </Button>
          </div>
        }
      />

      {cnpjFillOpen && <LegalEntityCnpjFillDialog onOpenChange={setCnpjFillOpen} />}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Buscar empresa"
          placeholder="Buscar por nome, código ou CNPJ"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div role="group" aria-label="Filtrar por status" className="flex gap-1">
          {(
            [
              ["all", "Todas"],
              ["active", "Ativas"],
              ["inactive", "Inativas"],
            ] as const
          ).map(([v, l]) => (
            <Button
              key={v}
              size="sm"
              variant={statusFilter === v ? "secondary" : "ghost"}
              aria-pressed={statusFilter === v}
              onClick={() => setStatusFilter(v)}
            >
              {l}
            </Button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Empresa</th>
              <th className="text-left px-4 py-2 font-medium">CNPJ</th>
              <th className="text-right px-4 py-2 font-medium">Lançamentos</th>
              <th className="text-right px-4 py-2 font-medium">A receber</th>
              <th className="text-right px-4 py-2 font-medium">A pagar</th>
              <th className="text-right px-4 py-2 font-medium w-40">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-destructive">
                  Não foi possível carregar as empresas.{" "}
                  <Button size="sm" variant="link" onClick={() => void refetch()}>
                    Tentar novamente
                  </Button>
                </td>
              </tr>
            )}
            {!isLoading && !isError && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  {allRows.length === 0
                    ? "Nenhuma empresa cadastrada."
                    : "Nenhuma empresa encontrada com esses filtros."}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    {r.code && (
                      <span className="font-mono text-xs text-muted-foreground">{r.code}</span>
                    )}
                    <span className="font-medium">{r.name}</span>
                    {r.is_default && (
                      <Badge variant="outline" className="border-warning text-warning">
                        Padrão
                      </Badge>
                    )}
                    {!r.active && <Badge variant="secondary">Inativa</Badge>}
                  </div>
                </td>
                <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                  {r.cnpj ? formatCnpj(r.cnpj) : "—"}
                </td>

                <td className="px-4 py-2 text-right tabular-nums">{r.totals.count}</td>
                <td className="px-4 py-2 text-right tabular-nums text-success">
                  {fmt(r.totals.receivable)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-destructive">
                  {fmt(r.totals.payable)}
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-1">
                    {!r.is_default && r.active && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!recordAccess.for(r.id).can_update}
                        onClick={() => makeDefault(r.id)}
                        title="Definir como padrão"
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void openEdit(r)}
                      disabled={loadingEdit === r.id || !recordAccess.for(r.id).can_update}
                      aria-label={`Editar ${r.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!recordAccess.for(r.id).can_update || (r.active && r.is_default)}
                      onClick={() => void toggleActive(r)}
                      aria-label={r.active ? `Desativar ${r.name}` : `Reativar ${r.name}`}
                      title={r.active ? "Desativar" : "Reativar"}
                    >
                      {r.active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!recordAccess.for(r.id).can_delete || r.is_default}
                      onClick={() => void remove(r)}
                      aria-label={`Excluir ${r.name}`}
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar empresa" : "Nova empresa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="le-code">Código</Label>
                <Input
                  id="le-code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="Ex: WK"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="le-name">Razão social *</Label>
                <Input
                  id="le-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="le-trade">Nome fantasia</Label>
              <Input
                id="le-trade"
                value={form.trade_name}
                onChange={(e) => setForm({ ...form, trade_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="le-cnpj">CNPJ</Label>
                <Input
                  id="le-cnpj"
                  value={form.cnpj}
                  placeholder="00.000.000/0000-00"
                  inputMode="numeric"
                  onChange={(e) => setForm({ ...form, cnpj: formatCnpj(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="le-ie">IE</Label>
                <Input
                  id="le-ie"
                  value={form.ie}
                  onChange={(e) => setForm({ ...form, ie: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="le-im">IM</Label>
                <Input
                  id="le-im"
                  value={form.im}
                  onChange={(e) => setForm({ ...form, im: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="le-active"
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
              <Label htmlFor="le-active">Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={saving || (form.id ? !recordAccess.for(form.id).can_update : !canCreate)}
              onClick={submit}
            >
              {saving ? "Salvando…" : form.id ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
