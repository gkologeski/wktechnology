import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { History, Pencil, Database } from "lucide-react";
import { toast } from "sonner";
import { PropertyHistoryDrawer } from "@/components/property-history-drawer";
import {
  listCustomProperties, setCustomFieldValue, type CustomEntity,
} from "@/lib/custom-properties.functions";

export type PropDef = { key: string; label: string; primary?: boolean; type?: "text" | "email" | "tel" | "number" | "url" };

type CustomProp = Awaited<ReturnType<typeof listCustomProperties>>[number];

export function PropertiesPanel<T extends Record<string, unknown> & { id: string }>({
  entity, table, row, props, onSaved,
}: {
  entity: string;
  table: string;
  row: T;
  props: PropDef[];
  onSaved?: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState<string>("");
  const [showAll, setShowAll] = useState(false);
  const [showHist, setShowHist] = useState(false);
  const [showHs, setShowHs] = useState(false);
  const [customDefs, setCustomDefs] = useState<CustomProp[]>([]);
  const listCustomFn = useServerFn(listCustomProperties);
  const setCustomFn = useServerFn(setCustomFieldValue);
  const customEntity = entity as CustomEntity;
  const isCustomEntity = ["leads", "contacts", "companies", "deals"].includes(entity);
  const customValues = ((row as Record<string, unknown>).custom_fields ?? {}) as Record<string, unknown>;

  useEffect(() => {
    if (!isCustomEntity) return;
    listCustomFn({ data: { entity: customEntity } })
      .then((d) => setCustomDefs(d.filter((p) => p.enabled)))
      .catch(() => { /* ignore */ });
  }, [customEntity, isCustomEntity, listCustomFn]);

  const saveCustom = async (key: string, val: unknown) => {
    try {
      await setCustomFn({ data: { entity: customEntity, entity_id: row.id, key, value: val as never } });
      toast.success("Atualizado");
      onSaved?.();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  };

  const hsRaw = (row as Record<string, unknown>).hs_raw as { properties?: Record<string, unknown> } | null | undefined;
  const hsProps = hsRaw?.properties ?? null;
  const knownKeys = new Set(props.map((p) => p.key));
  const extraHsEntries = hsProps
    ? Object.entries(hsProps).filter(([k, v]) => !knownKeys.has(k) && v !== null && v !== "" && v !== undefined)
    : [];

  const primary = props.filter((p) => p.primary);
  const display = primary.length ? primary : props.slice(0, 8);

  const save = async (key: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from(table).update({ [key]: value || null }).eq("id", row.id);
    if (error) toast.error(error.message);
    else { toast.success("Atualizado"); setEditing(null); onSaved?.(); }
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Sobre</h3>
        <Button variant="ghost" size="sm" onClick={() => setShowHist(true)}>
          <History className="h-3.5 w-3.5 mr-1" /> Histórico
        </Button>
      </div>
      <div className="space-y-2">
        {display.map((p) => (
          <div key={p.key} className="text-sm group">
            <div className="text-xs text-muted-foreground">{p.label}</div>
            {editing === p.key ? (
              <div className="flex gap-1 mt-0.5">
                <Input autoFocus type={p.type ?? "text"} value={value} onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && save(p.key)} className="h-7" />
                <Button size="sm" className="h-7" onClick={() => save(p.key)}>OK</Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{String(row[p.key] ?? "—")}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100"
                  onClick={() => { setEditing(p.key); setValue(String(row[p.key] ?? "")); }}>
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog open={showAll} onOpenChange={setShowAll}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full">Ver todas as propriedades</Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Todas as propriedades</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            {props.map((p) => (
              <div key={p.key} className="space-y-1">
                <Label className="text-xs text-muted-foreground">{p.label}</Label>
                <Input
                  type={p.type ?? "text"}
                  defaultValue={String(row[p.key] ?? "")}
                  onBlur={async (e) => {
                    if (e.target.value === String(row[p.key] ?? "")) return;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const { error } = await (supabase as any).from(table).update({ [p.key]: e.target.value || null }).eq("id", row.id);
                    if (error) toast.error(error.message); else { toast.success("Atualizado"); onSaved?.(); }
                  }}
                />
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {hsProps && (
        <Dialog open={showHs} onOpenChange={setShowHs}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="w-full">
              <Database className="h-3.5 w-3.5 mr-1" />
              Mais campos (HubSpot) {extraHsEntries.length ? `· ${extraHsEntries.length}` : ""}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Campos do HubSpot</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground">
              Somente leitura. Dados originais recebidos do HubSpot na última importação.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              {Object.entries(hsProps).map(([k, v]) => (
                <div key={k} className="space-y-0.5 min-w-0">
                  <Label className="text-xs text-muted-foreground break-all">{k}</Label>
                  <div className="text-sm break-words border rounded px-2 py-1 bg-muted/40">
                    {v === null || v === "" || v === undefined ? "—" : String(v)}
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      <PropertyHistoryDrawer open={showHist} onOpenChange={setShowHist} entity={entity} entityId={row.id} />
    </div>
  );
}
