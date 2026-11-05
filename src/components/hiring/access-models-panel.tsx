import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { loadHiringModels, saveHiringModel } from "@/lib/hiring/employment.functions";
import type { HiringAccessModel } from "@/lib/hiring/employment.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
const blank: HiringAccessModel = {
  id: "",
  name: "",
  role_id: null,
  revision: 0,
  active: false,
  allocation_only: true,
  permission_keys: [],
};
export function HiringAccessModelsPanel() {
  const { can } = usePermissions();
  const load = useServerFn(loadHiringModels),
    save = useServerFn(saveHiringModel);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<HiringAccessModel | null>(null),
    [search, setSearch] = useState(""),
    [busy, setBusy] = useState(false);
  const { data, error, isLoading } = useQuery({
    queryKey: ["hiring-access-models"],
    queryFn: () => load(),
    enabled: can("system.hiring_access.view.workspace"),
    retry: false,
    staleTime: 0,
  });
  if (!can("system.hiring_access.view.workspace")) return null;
  const commit = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await save({
        data: {
          id: editing.id || null,
          revision: editing.revision,
          roleId: editing.role_id,
          name: editing.name,
          keys: editing.permission_keys,
          allocationOnly: editing.allocation_only,
          active: editing.active,
        },
      });
      await qc.invalidateQueries({ queryKey: ["hiring-access-models"] });
      setEditing(null);
      toast.success("Nova versão do modelo salva. Vínculos existentes preservam sua versão.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>Modelos de acesso por cargo</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Versões de acesso para admissões. Ativar vale para novos vínculos; não altera concessões
            existentes.
          </p>
        </div>
        {can("system.hiring_access.manage.workspace") && (
          <Button
            variant="outline"
            onClick={() => {
              setEditing({ ...blank });
              setSearch("");
            }}
          >
            Novo modelo
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p>Carregando modelos…</p>
        ) : error ? (
          <p role="alert" className="text-destructive">
            {error.message}
          </p>
        ) : !data?.models.length ? (
          <p>Nenhum modelo configurado.</p>
        ) : (
          data.models.map((m) => (
            <div
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4"
            >
              <div>
                <p className="font-medium">{m.name}</p>
                <p className="text-sm text-muted-foreground">
                  {m.active ? "Ativo para novas admissões" : "Rascunho"} · revisão {m.revision} ·{" "}
                  {m.permission_keys.length} permissões ·{" "}
                  {m.allocation_only
                    ? "Somente projetos alocados"
                    : "Escopo configurado nas permissões"}
                </p>
                <p className="text-sm">
                  Cargo:{" "}
                  {data.roles.find((r) => r.id === m.role_id)?.name ?? "A definir antes de ativar"}
                </p>
              </div>
              {can("system.hiring_access.manage.workspace") && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditing({ ...m, permission_keys: [...m.permission_keys] });
                    setSearch("");
                  }}
                >
                  Revisar modelo
                </Button>
              )}
            </div>
          ))
        )}
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Modelo de acesso de contratação</DialogTitle>
              <DialogDescription>
                Apenas administrador com gestão de cargos pode salvar. Deny e membership ativo
                continuam prevalecendo. O cargo identifica o modelo; seus presets comerciais não são
                acrescentados.
              </DialogDescription>
            </DialogHeader>
            {editing && (
              <div className="space-y-4">
                <Label>
                  Nome
                  <Input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                </Label>
                <Label>Cargo</Label>
                <Select
                  value={editing.role_id ?? undefined}
                  onValueChange={(v) => setEditing({ ...editing, role_id: v })}
                >
                  <SelectTrigger aria-label="Cargo do modelo">
                    <SelectValue placeholder="Selecione o cargo" />
                  </SelectTrigger>
                  <SelectContent>
                    {data?.roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <label className="flex gap-2 items-center">
                  <Checkbox
                    checked={editing.allocation_only}
                    onCheckedChange={(v) => setEditing({ ...editing, allocation_only: v === true })}
                  />{" "}
                  Restringir a projetos alocados, horas próprias e dados próprios
                </label>
                <label className="flex gap-2 items-center">
                  <Checkbox
                    checked={editing.active}
                    onCheckedChange={(v) => setEditing({ ...editing, active: v === true })}
                  />{" "}
                  Ativo para novas admissões
                </label>
                <Input
                  aria-label="Buscar permissões do modelo"
                  placeholder="Buscar recurso, ação ou módulo…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <p className="text-sm">
                  {editing.permission_keys.length} selecionadas. A lista mostra até 100 resultados
                  por busca.
                </p>
                <div className="max-h-72 overflow-y-auto rounded-md border divide-y">
                  {data?.permissions
                    .filter((p) =>
                      `${p.key} ${p.label}`
                        .toLocaleLowerCase()
                        .includes(search.toLocaleLowerCase()),
                    )
                    .slice(0, 100)
                    .map((p) => (
                      <label key={p.key} className="flex gap-3 items-start p-3 text-sm">
                        <Checkbox
                          checked={editing.permission_keys.includes(p.key)}
                          onCheckedChange={(v) =>
                            setEditing({
                              ...editing,
                              permission_keys:
                                v === true
                                  ? [...editing.permission_keys, p.key]
                                  : editing.permission_keys.filter((k) => k !== p.key),
                            })
                          }
                        />
                        <span>
                          {p.label}
                          <span className="block text-xs text-muted-foreground break-all">
                            {p.key}
                          </span>
                        </span>
                      </label>
                    ))}
                </div>
                <details>
                  <summary>Permissões selecionadas</summary>
                  <ul className="text-xs space-y-1 mt-2">
                    {editing.permission_keys.map((k) => (
                      <li key={k} className="flex gap-2 items-center">
                        <button
                          type="button"
                          aria-label={`Remover ${k}`}
                          onClick={() =>
                            setEditing({
                              ...editing,
                              permission_keys: editing.permission_keys.filter((x) => x !== k),
                            })
                          }
                        >
                          Remover
                        </button>
                        {k}
                      </li>
                    ))}
                  </ul>
                </details>
                <Button disabled={busy} onClick={commit}>
                  {busy ? "Salvando…" : "Salvar nova versão"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
