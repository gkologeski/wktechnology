// Editor de perfil de acesso: permissões por objeto + ferramentas.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichHtmlEditor, htmlToPlain } from "@/components/rich-html-editor";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, Lock } from "lucide-react";
import { toast } from "sonner";
import { getAccessProfile, updateAccessProfile } from "@/lib/access-profiles.functions";
import { ACCESS_OBJECTS, ACCESS_TOOLS, SCOPE_LABELS } from "@/lib/access-profiles.constants";
import { TOOL_REQUIRED_ENTITLEMENT, PLAN_LABELS } from "@/lib/entitlements";
import { useEntitlements } from "@/lib/use-entitlements";

export const Route = createFileRoute("/_authenticated/settings/roles/$roleId")({
  component: EditRolePage,
});

type Scope = "none" | "own" | "team" | "all";
type Perm = {
  object_key: string;
  view_scope: Scope;
  edit_scope: Scope;
  delete_scope: Scope;
  create_enabled: boolean;
};
type Tool = { tool_key: string; enabled: boolean };

const CATEGORIES: Array<{
  key: "crm" | "sales" | "service" | "marketing" | "ats" | "account";
  label: string;
}> = [
  { key: "crm", label: "CRM" },
  { key: "sales", label: "Vendas" },
  { key: "service", label: "Atendimento" },
  { key: "marketing", label: "Marketing" },
  { key: "ats", label: "ATS / Recrutamento" },
  { key: "account", label: "Conta" },
];

function EditRolePage() {
  const { roleId } = Route.useParams();
  const navigate = useNavigate();
  const getFn = useServerFn(getAccessProfile);
  const updateFn = useServerFn(updateAccessProfile);
  const ents = useEntitlements();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [baseRole, setBaseRole] = useState<"admin" | "manager" | "member">("member");
  const [isSystem, setIsSystem] = useState(false);
  const [perms, setPerms] = useState<Record<string, Perm>>({});
  const [tools, setTools] = useState<Record<string, Tool>>({});
  const [category, setCategory] = useState<
    "crm" | "sales" | "service" | "marketing" | "ats" | "account"
  >("crm");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await getFn({ data: { id: roleId } });
        setName(res.profile.name);
        setDescription(res.profile.description ?? "");
        setBaseRole(res.profile.base_role);
        setIsSystem(res.profile.is_system);
        const pmap: Record<string, Perm> = {};
        for (const o of ACCESS_OBJECTS) {
          const found = res.permissions.find((p) => p.object_key === o.key);
          pmap[o.key] = found ?? {
            object_key: o.key,
            view_scope: "none",
            edit_scope: "none",
            delete_scope: "none",
            create_enabled: false,
          };
        }
        setPerms(pmap);
        const tmap: Record<string, Tool> = {};
        for (const t of ACCESS_TOOLS) {
          const found = res.tools.find((x) => x.tool_key === t.key);
          tmap[t.key] = found ?? { tool_key: t.key, enabled: false };
        }
        setTools(tmap);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao carregar perfil");
      } finally {
        setLoading(false);
      }
    })();
  }, [roleId, getFn]);

  const visibleObjects = useMemo(
    () => ACCESS_OBJECTS.filter((o) => o.category === category),
    [category],
  );
  const visibleTools = useMemo(
    () => ACCESS_TOOLS.filter((t) => t.category === category),
    [category],
  );

  const updatePerm = (key: string, patch: Partial<Perm>) =>
    setPerms((m) => ({ ...m, [key]: { ...m[key], ...patch } }));
  const updateTool = (key: string, enabled: boolean) =>
    setTools((m) => ({ ...m, [key]: { ...m[key], enabled } }));

  const handleSave = async () => {
    if (name.trim().length < 2) {
      toast.error("Nome muito curto");
      return;
    }
    setSaving(true);
    try {
      await updateFn({
        data: {
          id: roleId,
          name: isSystem ? undefined : name.trim(),
          description: htmlToPlain(description).trim() ? description : null,
          base_role: isSystem ? undefined : baseRole,
          permissions: Object.values(perms),
          tools: Object.values(tools),
        },
      });
      toast.success("Perfil atualizado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
        <p className="font-medium text-amber-700 dark:text-amber-400">Edição em tela legada</p>
        <p className="text-muted-foreground mt-1">
          Este editor pertence ao módulo legado de perfis. Para novas configurações prefira{" "}
          <Link to="/home/access" className="underline font-medium text-foreground">Controle de Acesso</Link>.
        </p>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/settings/roles">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Voltar
            </Button>
          </Link>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold truncate">Editando perfil: {name}</h2>
            {isSystem && (
              <Badge variant="secondary" className="mt-1">
                Sistema — nome e papel base bloqueados
              </Badge>
            )}
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-1.5" />
          {saving ? "Salvando…" : "Salvar"}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4 grid md:grid-cols-3 gap-3">
          <div className="md:col-span-1">
            <label className="text-xs font-medium">Nome</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={isSystem} />
          </div>
          <div className="md:col-span-1">
            <label className="text-xs font-medium">Papel base (compat. RLS)</label>
            <Select
              value={baseRole}
              onValueChange={(v) => setBaseRole(v as "admin" | "manager" | "member")}
              disabled={isSystem}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Gestor</SelectItem>
                <SelectItem value="member">Membro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-1">
            <label className="text-xs font-medium">Descrição</label>
            <RichHtmlEditor
              value={description}
              onChange={setDescription}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-[200px_1fr] gap-4">
        {/* sidebar de categorias */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Categorias</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 pt-0">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => setCategory(c.key)}
                className={`w-full text-left text-sm px-2 py-1.5 rounded ${category === c.key ? "bg-accent text-accent-foreground font-medium" : "hover:bg-accent/50"}`}
              >
                {c.label}
              </button>
            ))}
          </CardContent>
        </Card>

        {/* conteúdo */}
        <div className="space-y-4">
          {visibleObjects.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  Objetos — {CATEGORIES.find((c) => c.key === category)?.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {visibleObjects.map((o) => {
                  const p = perms[o.key];
                  if (!p) return null;
                  return (
                    <div key={o.key} className="border rounded-md p-3 space-y-2">
                      <div className="font-medium text-sm">{o.label}</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <ScopeSelect
                          label="Visualizar"
                          value={p.view_scope}
                          onChange={(v) => updatePerm(o.key, { view_scope: v })}
                        />
                        <ScopeSelect
                          label="Editar"
                          value={p.edit_scope}
                          onChange={(v) => updatePerm(o.key, { edit_scope: v })}
                        />
                        <ScopeSelect
                          label="Excluir"
                          value={p.delete_scope}
                          onChange={(v) => updatePerm(o.key, { delete_scope: v })}
                        />
                        <div>
                          <label className="text-xs font-medium block mb-1">Criar</label>
                          <div className="flex items-center h-9">
                            <Switch
                              checked={p.create_enabled}
                              onCheckedChange={(v) => updatePerm(o.key, { create_enabled: v })}
                            />
                            <span className="ml-2 text-xs text-muted-foreground">
                              {p.create_enabled ? "Permitido" : "Bloqueado"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {visibleTools.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  Ferramentas — {CATEGORIES.find((c) => c.key === category)?.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {visibleTools.map((t) => {
                  const v = tools[t.key];
                  if (!v) return null;
                  const reqKey = TOOL_REQUIRED_ENTITLEMENT[t.key];
                  const locked = !!reqKey && !ents.loading && !ents.isEnabled(reqKey);
                  const effectiveEnabled = locked ? false : v.enabled;
                  return (
                    <div
                      key={t.key}
                      className={`flex items-center justify-between border rounded-md p-3 ${locked ? "bg-muted/30" : ""}`}
                    >
                      <div className="min-w-0 pr-3">
                        <div className="text-sm font-medium flex items-center gap-2">
                          {t.label}
                          {locked && (
                            <Badge variant="outline" className="gap-1 text-[10px] font-normal">
                              <Lock className="h-3 w-3" />
                              Requer plano superior
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t.description}
                          {locked && (
                            <>
                              {" "}
                              <Link to="/settings/billing" className="underline underline-offset-2">
                                Fazer upgrade do plano {PLAN_LABELS[ents.plan]}
                              </Link>
                              .
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {effectiveEnabled ? "Ligado" : "Desligado"}
                        </span>
                        <Switch
                          checked={effectiveEnabled}
                          disabled={locked}
                          onCheckedChange={(val) => updateTool(t.key, val)}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {visibleObjects.length === 0 && visibleTools.length === 0 && (
            <Card>
              <CardContent className="pt-6 text-sm text-muted-foreground">
                Nada para configurar nesta categoria.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-1.5" />
          {saving ? "Salvando…" : "Salvar"}
        </Button>
      </div>

      <button
        type="button"
        className="hidden"
        onClick={() => navigate({ to: "/settings/roles" })}
      />
    </div>
  );
}

function ScopeSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Scope;
  onChange: (v: Scope) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1">{label}</label>
      <Select value={value} onValueChange={(v) => onChange(v as Scope)}>
        <SelectTrigger className="h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(SCOPE_LABELS) as Scope[]).map((k) => (
            <SelectItem key={k} value={k}>
              {SCOPE_LABELS[k]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
