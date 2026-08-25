import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Star, Trash2, Pencil, Wand2 } from "lucide-react";
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
  const qc = useQueryClient();
  const list = useServerFn(listLegalEntitiesSummary);
  const upsert = useServerFn(upsertLegalEntity);
  const setDefault = useServerFn(setDefaultLegalEntity);
  const del = useServerFn(deleteLegalEntity);
  const getEntity = useServerFn(getLegalEntity);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["legal-entities"],
    queryFn: () => list() as Promise<LE[]>,
  });

  const [open, setOpen] = useState(false);
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
    if (!form.name.trim()) {
      toast.error("Informe o nome");
      return;
    }
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
      qc.invalidateQueries({ queryKey: ["legal-entities"] });
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }

  async function makeDefault(id: string) {
    try {
      await setDefault({ data: { id } });
      toast.success("Empresa padrão definida");
      qc.invalidateQueries({ queryKey: ["legal-entities"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }

  async function remove(row: LE) {
    if (row.totals.count > 0) {
      toast.error(
        `Existem ${row.totals.count} lançamentos vinculados. Desative em vez de excluir.`,
      );
      return;
    }
    if (!(await confirmDialog(`Excluir ${row.name}?`))) return;
    try {
      await del({ data: { id: row.id } });
      toast.success("Excluída");
      qc.invalidateQueries({ queryKey: ["legal-entities"] });
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
            <Button variant="outline" onClick={() => setCnpjFillOpen(true)}>
              <Wand2 className="h-4 w-4 mr-1" /> Preencher CNPJs
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Nova empresa
            </Button>
          </div>
        }
      />

      {cnpjFillOpen && <LegalEntityCnpjFillDialog onOpenChange={setCnpjFillOpen} />}

      <div className="rounded-lg border bg-card">
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
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhuma empresa cadastrada.
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
                      <Badge variant="outline" className="border-amber-500 text-amber-600">
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
                <td className="px-4 py-2 text-right tabular-nums text-emerald-600">
                  {fmt(r.totals.receivable)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-rose-600">
                  {fmt(r.totals.payable)}
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-1">
                    {!r.is_default && (
                      <Button
                        size="sm"
                        variant="ghost"
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
                      disabled={loadingEdit === r.id}
                      aria-label={`Editar ${r.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>

                    <Button size="sm" variant="ghost" onClick={() => remove(r)}>
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
                <Label>Código</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="Ex: WK"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Razão social *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nome fantasia</Label>
              <Input
                value={form.trade_name}
                onChange={(e) => setForm({ ...form, trade_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input
                  value={form.cnpj}
                  placeholder="00.000.000/0000-00"
                  inputMode="numeric"
                  onChange={(e) => setForm({ ...form, cnpj: formatCnpj(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>IE</Label>
                <Input value={form.ie} onChange={(e) => setForm({ ...form, ie: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>IM</Label>
                <Input value={form.im} onChange={(e) => setForm({ ...form, im: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
              <Label>Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit}>{form.id ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
