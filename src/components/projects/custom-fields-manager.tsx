// Refinos Sprint E: gerenciamento de custom fields por lista.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, Settings2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listCustomFields,
  createCustomField,
  deleteCustomField,
} from "@/lib/project-list-extras.functions";

const TYPE_LABELS: Record<string, string> = {
  text: "Texto",
  number: "Número",
  date: "Data",
  select: "Seleção",
  checkbox: "Sim/Não",
  url: "URL",
};

export function CustomFieldsManagerButton({ listId }: { listId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="h-4 w-4 mr-2" /> Campos personalizados
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Campos personalizados</DialogTitle>
        </DialogHeader>
        {open && <CustomFieldsManagerBody listId={listId} />}
      </DialogContent>
    </Dialog>
  );
}

function CustomFieldsManagerBody({ listId }: { listId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listCustomFields);
  const createFn = useServerFn(createCustomField);
  const deleteFn = useServerFn(deleteCustomField);

  const { data: fields = [], isLoading } = useQuery({
    queryKey: ["project-list-custom-fields", listId],
    queryFn: () => listFn({ data: { listId } }),
  });

  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [type, setType] = useState<"text" | "number" | "date" | "select" | "checkbox" | "url">(
    "text",
  );
  const [optionsInput, setOptionsInput] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["project-list-custom-fields", listId] });
    qc.invalidateQueries({ queryKey: ["project-list", listId] });
  };

  const createM = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          listId,
          key: key.trim(),
          label: label.trim(),
          type,
          options:
            type === "select"
              ? optionsInput
                  .split(",")
                  .map((o) => o.trim())
                  .filter(Boolean)
              : null,
        },
      }),
    onSuccess: () => {
      toast.success("Campo criado");
      setLabel("");
      setKey("");
      setOptionsInput("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Campo removido");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Auto-slug do label para chave
  const suggestKey = (v: string) =>
    v
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="py-6 flex justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : (
        <div className="space-y-1.5">
          {fields.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum campo personalizado.</p>
          ) : (
            fields.map((f: any) => (
              <div
                key={f.id}
                className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{f.label}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {f.key} • {TYPE_LABELS[f.type] ?? f.type}
                  </div>
                </div>
                {f.type === "select" && f.options && (
                  <Badge variant="outline" className="text-[10px]">
                    {(f.options as string[]).length} opções
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => deleteM.mutate(f.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      )}

      <div className="rounded-md border p-3 space-y-2.5 bg-muted/20">
        <div className="text-xs font-medium">Novo campo</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Rótulo</label>
            <Input
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                if (!key || key === suggestKey(label)) setKey(suggestKey(e.target.value));
              }}
              placeholder="Ex.: Impacto"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Chave</label>
            <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="impacto" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Tipo</label>
            <Select value={type} onValueChange={(v) => setType(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {type === "select" && (
            <div>
              <label className="text-xs text-muted-foreground">Opções (vírgula)</label>
              <Input
                value={optionsInput}
                onChange={(e) => setOptionsInput(e.target.value)}
                placeholder="Baixo, Médio, Alto"
              />
            </div>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => createM.mutate()}
          disabled={!label.trim() || !key.trim() || createM.isPending}
        >
          <Plus className="h-4 w-4 mr-2" /> Adicionar
        </Button>
      </div>
    </div>
  );
}
