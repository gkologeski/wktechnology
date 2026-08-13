import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmailInput } from "@/components/ui/email-input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { deniedIfUnaffected } from "@/lib/access-control/rls-denied";

import { isEmail } from "@/lib/validators";

export type BulkField = {
  name: string;
  label: string;
  type?: "text" | "email" | "tel" | "number" | "date" | "textarea" | "select";
  options?: { value: string; label: string }[];
};

export function BulkEditDialog({
  open,
  setOpen,
  table,
  ids,
  fields,
  onDone,
}: {
  open: boolean;
  setOpen: (b: boolean) => void;
  table: string;
  ids: string[];
  fields: BulkField[];
  onDone: () => void;
}) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      if (!enabled[f.name]) continue;
      let v = values[f.name];
      if (v === "" || v === undefined) v = null;
      if (f.type === "number" && v != null) v = Number(v);
      if (f.type === "email" && v != null) {
        const s = String(v).trim();
        if (!isEmail(s)) {
          toast.error(`${f.label}: email inválido.`);
          return;
        }
        v = s;
      }
      payload[f.name] = v;
    }
    if (Object.keys(payload).length === 0) {
      toast.error("Marque ao menos um campo para alterar");
      return;
    }
    setBusy(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: affected, error } = await (supabase as any)
      .from(table)
      .update(payload)
      .in("id", ids)
      .select("id");
    setBusy(false);
    if (error) return toast.error(error.message);
    if (deniedIfUnaffected(affected)) return;
    const changed = (affected as unknown[]).length;
    if (changed < ids.length) {
      toast.warning(`${changed} de ${ids.length} atualizado(s). Verifique suas permissões.`);
    } else {
      toast.success(`${ids.length} registro(s) atualizado(s)`);
    }

    setOpen(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar {ids.length} registro(s)</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">
          Marque apenas os campos que deseja sobrescrever em todos os selecionados.
        </p>
        <div className="space-y-3 mt-3">
          {fields.map((f) => (
            <div key={f.name} className="rounded-md border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`en-${f.name}`}
                  checked={!!enabled[f.name]}
                  onCheckedChange={(v) => setEnabled((s) => ({ ...s, [f.name]: !!v }))}
                />
                <Label htmlFor={`en-${f.name}`} className="cursor-pointer">
                  {f.label}
                </Label>
              </div>
              {enabled[f.name] &&
                (f.type === "textarea" ? (
                  <Textarea
                    rows={3}
                    value={String(values[f.name] ?? "")}
                    onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.value }))}
                  />
                ) : f.type === "select" ? (
                  <select
                    className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                    value={String(values[f.name] ?? "")}
                    onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.value }))}
                  >
                    <option value="">— (limpar)</option>
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : f.type === "email" ? (
                  <EmailInput
                    value={String(values[f.name] ?? "")}
                    onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))}
                  />
                ) : (
                  <Input
                    type={f.type ?? "text"}
                    value={String(values[f.name] ?? "")}
                    onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.value }))}
                  />
                ))}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Salvando..." : "Aplicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
