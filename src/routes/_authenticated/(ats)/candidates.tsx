import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Plus, Search, Trash2, Sparkles, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  listAtsCandidates,
  saveAtsCandidate,
  deleteAtsCandidate,
} from "@/lib/ats/ats.functions";
import { parseCv } from "@/lib/ats/cv-parse.functions";
import { exportAtsCandidatesCsv } from "@/lib/ats/export.functions";
import { CvPdfUploadButton } from "@/components/ats/cv-pdf-upload-button";

export const Route = createFileRoute("/_authenticated/(ats)/candidates")({
  component: CandidatesPage,
});

type Cand = Awaited<ReturnType<typeof listAtsCandidates>>[number];

function CandidatesPage() {
  const list = useServerFn(listAtsCandidates);
  const save = useServerFn(saveAtsCandidate);
  const del = useServerFn(deleteAtsCandidate);
  const parse = useServerFn(parseCv);
  const exportCsv = useServerFn(exportAtsCandidatesCsv);
  const [parseOpen, setParseOpen] = useState(false);
  const [cvText, setCvText] = useState("");
  const [cvUrl, setCvUrl] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<Cand[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    linkedin_url: "",
    location: "",
    current_position: "",
    current_company: "",
    skills: "",
    notes: "",
  });

  const refresh = async () => {
    try {
      const r = await list({ data: { search } });
      setRows(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao listar");
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async () => {
    if (!form.full_name.trim()) {
      toast.error("Informe o nome");
      return;
    }
    try {
      await save({
        data: {
          full_name: form.full_name.trim(),
          email: form.email || null,
          phone: form.phone || null,
          linkedin_url: form.linkedin_url || null,
          location: form.location || null,
          current_position: form.current_position || null,
          current_company: form.current_company || null,
          skills: form.skills
            ? form.skills.split(",").map((s) => s.trim()).filter(Boolean)
            : [],
          source: "manual",
          notes: form.notes || null,
        },
      });
      setOpen(false);
      setForm({
        full_name: "",
        email: "",
        phone: "",
        linkedin_url: "",
        location: "",
        current_position: "",
        current_company: "",
        skills: "",
        notes: "",
      });
      refresh();
      toast.success("Candidato salvo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este candidato?")) return;
    try {
      await del({ data: { id } });
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  };

  const handleParseCv = async () => {
    if (cvText.trim().length < 40) {
      toast.error("Cole o texto do currículo ou faça upload de um PDF (mínimo 40 caracteres)");
      return;
    }
    setParsing(true);
    try {
      const res = await parse({ data: { cv_text: cvText, apply: true } });
      const newId = (res.saved as { id?: string } | null | undefined)?.id;
      if (cvUrl && newId) {
        const { supabase } = await import("@/integrations/supabase/client");
        await supabase.from("ats_candidates").update({ cv_url: cvUrl }).eq("id", newId);
      }
      toast.success(`Candidato criado a partir do CV${res.parsed.full_name ? `: ${res.parsed.full_name}` : ""}`);
      setParseOpen(false);
      setCvText("");
      setCvUrl(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao processar CV");
    } finally {
      setParsing(false);
    }
  };


  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar candidato…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && refresh()}
            className="pl-9"
          />
        </div>
        <Dialog open={parseOpen} onOpenChange={setParseOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Sparkles className="h-4 w-4 mr-2" />Parsing de CV (IA)
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Extrair dados de currículo com IA</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Cole o texto do currículo</Label>
                <CvPdfUploadButton
                  disabled={parsing}
                  onExtracted={({ text, cvUrl: url }) => {
                    if (text) setCvText(text);
                    if (url) setCvUrl(url);
                  }}
                />
              </div>
              <Textarea
                rows={12}
                value={cvText}
                onChange={(e) => setCvText(e.target.value)}
                placeholder="Cole aqui o conteúdo do CV — ou clique em 'Enviar PDF' para extrair automaticamente."
              />
              {cvUrl && (
                <p className="text-xs text-muted-foreground">
                  PDF anexado e armazenado em segurança. Será vinculado ao candidato.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                A IA extrai nome, contatos, skills, experiência e formação, e cria um novo candidato.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setParseOpen(false)} disabled={parsing}>
                Cancelar
              </Button>
              <Button onClick={handleParseCv} disabled={parsing}>
                {parsing ? "Processando…" : "Extrair e salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Novo candidato</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Novo candidato</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Nome *</Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div><Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div><Label>Telefone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="col-span-2"><Label>LinkedIn</Label>
                <Input value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} placeholder="https://linkedin.com/in/..." />
              </div>
              <div><Label>Localização</Label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
              <div><Label>Cargo atual</Label>
                <Input value={form.current_position} onChange={(e) => setForm({ ...form, current_position: e.target.value })} />
              </div>
              <div className="col-span-2"><Label>Empresa atual</Label>
                <Input value={form.current_company} onChange={(e) => setForm({ ...form, current_company: e.target.value })} />
              </div>
              <div className="col-span-2"><Label>Skills (separadas por vírgula)</Label>
                <Input value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="React, Node.js, PostgreSQL" />
              </div>
              <div className="col-span-2"><Label>Notas</Label>
                <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {rows.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          Nenhum candidato cadastrado.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => (
            <Card key={c.id} className="hover:border-primary/40">
              <CardContent className="pt-4 text-sm space-y-1">
                <div className="flex justify-between items-start gap-2">
                  <div className="font-medium">{c.full_name as string}</div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleDelete(c.id as string)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {c.current_position && (
                  <div className="text-muted-foreground text-xs">
                    {c.current_position}{c.current_company ? ` @ ${c.current_company}` : ""}
                  </div>
                )}
                {c.email && <div className="text-muted-foreground text-xs">{c.email}</div>}
                {c.location && <div className="text-muted-foreground text-xs">{c.location}</div>}
                {Array.isArray(c.skills) && c.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-2">
                    {(c.skills as string[]).slice(0, 6).map((s) => (
                      <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
                    ))}
                  </div>
                )}
                <div className="pt-1"><Badge variant="secondary" className="text-[10px]">{c.source as string}</Badge></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
