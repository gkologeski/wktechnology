import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  listWhatsAppTemplates,
  saveWhatsAppTemplates,
} from "@/lib/whatsapp.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Tpl = { name: string; body: string };

export function WhatsAppTemplatesEditor() {
  const qc = useQueryClient();
  const listFn = useServerFn(listWhatsAppTemplates);
  const saveFn = useServerFn(saveWhatsAppTemplates);
  const [items, setItems] = useState<Tpl[]>([]);
  const q = useQuery({ queryKey: ["wa", "templates"], queryFn: () => listFn() });
  useEffect(() => {
    if (q.data) setItems(q.data);
  }, [q.data]);

  const saveMut = useMutation({
    mutationFn: () => saveFn({ data: { templates: items } }),
    onSuccess: () => {
      toast.success("Templates salvos");
      qc.invalidateQueries({ queryKey: ["wa", "templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label>Templates</Label>
          <p className="text-xs text-muted-foreground">
            Use {`{{1}}`}, {`{{2}}`} para variáveis. Ex: "Olá {`{{1}}`}, sua reunião é {`{{2}}`}."
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setItems((prev) => [...prev, { name: "", body: "" }])}
        >
          <Plus className="mr-1 h-3 w-3" /> Novo
        </Button>
      </div>

      {items.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhum template ainda.</p>
      )}

      {items.map((t, i) => (
        <div key={i} className="space-y-2 rounded-md border p-2">
          <div className="flex items-center gap-2">
            <Input
              value={t.name}
              onChange={(e) =>
                setItems((prev) => prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
              }
              placeholder="Nome do template"
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <Textarea
            value={t.body}
            onChange={(e) =>
              setItems((prev) => prev.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))
            }
            placeholder="Olá {{1}}, ..."
            rows={3}
          />
        </div>
      ))}

      <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
        Salvar templates
      </Button>
    </div>
  );
}
