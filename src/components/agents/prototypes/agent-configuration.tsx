import { useState } from "react";
import { toast } from "sonner";
import { Plus, Calendar, FileText, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useDemo } from "./state";
import { HOSTS } from "./model";
import { Field } from "./wizard-navigation";
import { Choice } from "./wizard-navigation";

export function Agenda() {
  const { agent, patch } = useDemo();
  return (
    <div className="space-y-6">
      <Choice
        label="Anfitrião da agenda"
        value={agent.host}
        options={HOSTS}
        onChange={(host) => patch({ host })}
      />
      <div className="rounded-md bg-product-panel-muted p-5">
        <div className="flex gap-3">
          <Calendar className="text-primary" size={20} />
          <div>
            <p className="text-sm font-semibold">{agent.host}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Conversa de alinhamento · 30 minutos
            </p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-5 gap-2">
          {["SEG", "TER", "QUA", "QUI", "SEX"].map((d, i) => (
            <div key={d} className="rounded-md bg-product-panel p-2 text-center">
              <p className="text-[9px] text-muted-foreground">{d}</p>
              <p className="my-2 text-sm font-medium">{12 + i}</p>
              <span className="mx-auto block size-1 rounded-full bg-primary" />
            </div>
          ))}
        </div>
        <p className="mt-4 text-[10px] text-muted-foreground">
          Disponibilidade demonstrativa · sem reserva real
        </p>
      </div>
      <div className="space-y-3 text-sm">
        {[
          "Consultar conhecimento",
          "Transferir para equipe humana",
          "Oferecer agenda selecionada",
        ].map((t) => (
          <div key={t} className="flex items-center justify-between">
            <Label htmlFor={t}>{t}</Label>
            <Switch id={t} defaultChecked />
          </div>
        ))}
      </div>
    </div>
  );
}

export function Knowledge() {
  const { agent, patch } = useDemo();
  const [open, setOpen] = useState(false),
    [title, setTitle] = useState(""),
    [text, setText] = useState(""),
    [sourceType, setSourceType] = useState("Texto"),
    [editing, setEditing] = useState<string | null>(null);
  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Fontes de conhecimento</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {agent.sources.length} fontes · escopo controlado
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setEditing(null);
            setTitle("");
            setText("");
            setOpen(true);
          }}
        >
          <Plus />
          Fonte
        </Button>
      </div>
      {agent.sources.map((s) => (
        <div key={s.id} className="ap-source-row">
          <span className="rounded-md bg-accent p-3 text-primary">
            <FileText size={18} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{s.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {s.type} · {s.scope}
            </p>
            <p className="mt-2 text-[10px] text-success">
              {s.ready ? "Processado · trechos de demonstração" : "Aguardando processamento"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Editar fonte ${s.name}`}
            onClick={() => {
              setEditing(s.id);
              setTitle(s.name);
              setText(s.text);
              setSourceType(s.type);
              setOpen(true);
            }}
          >
            <ChevronRight />
          </Button>
        </div>
      ))}
      <div className="mt-6 text-xs text-muted-foreground">
        Perguntas sem resposta <span className="ml-2 text-foreground">0 neste teste</span>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>{editing ? "Editar fonte" : "Nova fonte"}</DialogTitle>
          <DialogDescription>
            Conteúdo demonstrativo. PDF e URL são referências locais, sem ingestão externa.
          </DialogDescription>
          <Field label="Nome da fonte" value={title} onChange={setTitle} />
          <Choice
            label="Tipo da fonte"
            value={sourceType}
            options={["Texto", "PDF", "URL"]}
            onChange={setSourceType}
          />
          <Field label="Trecho de demonstração" value={text} onChange={setText} multiline />
          <DialogFooter>
            <Button
              disabled={!title.trim() || !text.trim()}
              onClick={() => {
                const s = {
                  id: editing ?? crypto.randomUUID(),
                  name: title,
                  text,
                  type: sourceType,
                  scope: "Só este agente",
                  ready: true,
                };
                patch({
                  sources: editing
                    ? agent.sources.map((x) => (x.id === editing ? s : x))
                    : [...agent.sources, s],
                });
                setOpen(false);
                toast.success("Fonte atualizada neste protótipo");
              }}
            >
              Salvar fonte local
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
