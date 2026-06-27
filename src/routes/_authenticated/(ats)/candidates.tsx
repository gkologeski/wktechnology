import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  Sparkles,
  Download,
  Users,
  MapPin,
  Mail,
  Briefcase,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { parseCvFromPdf } from "@/lib/ats/cv-parse-pdf.functions";
import { exportAtsCandidatesCsv } from "@/lib/ats/export.functions";
import { CvPdfUploadButton } from "@/components/ats/cv-pdf-upload-button";
import {
  AtsPageHeader,
  FilterBar,
  EmptyState,
  Skeletons,
  SourceBadge,
} from "@/components/ats/ui";
import { MetaPill } from "@/components/techhire/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/(ats)/candidates")({
  component: CandidatesPage,
});

type Cand = Awaited<ReturnType<typeof listAtsCandidates>>[number];

function CandidatesGridSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeletons.Card key={i} lines={3} />
      ))}
    </div>
  );
}

function CandidatesPage() {
  const list = useServerFn(listAtsCandidates);
  const save = useServerFn(saveAtsCandidate);
  const del = useServerFn(deleteAtsCandidate);
  const parse = useServerFn(parseCv);
  const parsePdf = useServerFn(parseCvFromPdf);
  const exportCsv = useServerFn(exportAtsCandidatesCsv);
  const queryClient = useQueryClient();
  const [parseOpen, setParseOpen] = useState(false);
  const [cvText, setCvText] = useState("");
  const [cvUrl, setCvUrl] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
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

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const q = useQuery({
    queryKey: ["ats-candidates", debouncedSearch],
    queryFn: () => list({ data: { search: debouncedSearch } }),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });

  const rows: Cand[] = q.data ?? [];
  const loading = q.isLoading;
  const error = q.error ? (q.error instanceof Error ? q.error.message : "Falha ao listar") : null;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["ats-candidates"] });

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
    const hasText = cvText.trim().length >= 40;
    if (!hasText && !cvUrl) {
      toast.error("Envie um PDF ou cole o texto do currículo (mínimo 40 caracteres)");
      return;
    }
    setParsing(true);
    try {
      const res = cvUrl
        ? await parsePdf({ data: { cv_url: cvUrl, apply: true } })
        : await parse({ data: { cv_text: cvText, apply: true } });
      const newId = (res.saved as { id?: string } | null | undefined)?.id;
      if (cvUrl && newId && !("cv_url" in (res.parsed as object))) {
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

  const handleExport = async () => {
    try {
      const r = await exportCsv();
      const blob = new Blob([r.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = r.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar");
    }
  };

  const total = rows.length;
  const descriptionText = loading
    ? "Carregando candidatos…"
    : `${total} ${total === 1 ? "candidato" : "candidatos"}`;

  return (
    <div className="flex flex-col gap-6">
      <AtsPageHeader
        eyebrow="Talentos"
        title="Candidatos"
        description={descriptionText}
        descriptionLive
        secondaryActions={
          <>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" aria-hidden="true" />
              CSV
            </Button>
            <Dialog open={parseOpen} onOpenChange={setParseOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Sparkles className="h-4 w-4 mr-2" aria-hidden="true" />
                  Parsing de CV (IA)
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Extrair dados de currículo com IA</DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="cv-text">Cole o texto do currículo</Label>
                    <CvPdfUploadButton
                      disabled={parsing}
                      onExtracted={({ text, cvUrl: url }) => {
                        if (text) setCvText(text);
                        if (url) setCvUrl(url);
                      }}
                    />
                  </div>
                  <Textarea
                    id="cv-text"
                    rows={12}
                    value={cvText}
                    onChange={(e) => setCvText(e.target.value)}
                    placeholder="Cole aqui o conteúdo do CV — ou clique em 'Enviar PDF' para extrair automaticamente."
                  />
                  {cvUrl && (
                    <p className="text-xs text-text-tertiary">
                      PDF anexado e armazenado em segurança. Será vinculado ao candidato.
                    </p>
                  )}
                  <p className="text-xs text-text-tertiary">
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
          </>
        }
        primaryAction={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                Novo candidato
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Novo candidato</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label htmlFor="cand-name">Nome *</Label>
                  <Input
                    id="cand-name"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="cand-email">Email</Label>
                  <Input
                    id="cand-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="cand-phone">Telefone</Label>
                  <Input
                    id="cand-phone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="cand-linkedin">LinkedIn</Label>
                  <Input
                    id="cand-linkedin"
                    value={form.linkedin_url}
                    onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })}
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>
                <div>
                  <Label htmlFor="cand-location">Localização</Label>
                  <Input
                    id="cand-location"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="cand-position">Cargo atual</Label>
                  <Input
                    id="cand-position"
                    value={form.current_position}
                    onChange={(e) => setForm({ ...form, current_position: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="cand-company">Empresa atual</Label>
                  <Input
                    id="cand-company"
                    value={form.current_company}
                    onChange={(e) => setForm({ ...form, current_company: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="cand-skills">Skills (separadas por vírgula)</Label>
                  <Input
                    id="cand-skills"
                    value={form.skills}
                    onChange={(e) => setForm({ ...form, skills: e.target.value })}
                    placeholder="React, Node.js, PostgreSQL"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="cand-notes">Notas</Label>
                  <Textarea
                    id="cand-notes"
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreate}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <FilterBar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Buscar por nome, email, cargo ou skill…",
        }}
      />

      {loading ? (
        <CandidatesGridSkeleton />
      ) : error ? (
        <EmptyState
          icon={Users}
          title="Não foi possível carregar os candidatos"
          description={error}
          action={<Button onClick={refresh}>Tentar novamente</Button>}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? "Nenhum candidato encontrado" : "Nenhum candidato cadastrado"}
          description={
            search
              ? "Tente outros termos ou limpe o filtro de busca."
              : "Cadastre um candidato manualmente ou use o parsing de CV (IA) para importar a partir de um currículo."
          }
          action={
            search ? (
              <Button variant="outline" onClick={() => setSearch("")}>
                Limpar busca
              </Button>
            ) : (
              <Button onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                Novo candidato
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => {
            const skills = Array.isArray(c.skills) ? (c.skills as string[]) : [];
            return (
              <article
                key={c.id as string}
                className={cn(
                  "group relative rounded-lg border border-border-subtle bg-surface-1",
                  "p-4 shadow-xs transition-all min-w-0 overflow-hidden",
                  "hover:border-border-strong hover:shadow-sm",
                  "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-text-primary truncate">
                      {c.full_name as string}
                    </h3>
                    {c.current_position ? (
                      <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-text-secondary">
                        <Briefcase className="h-3 w-3 shrink-0 text-text-tertiary" aria-hidden="true" />
                        <span className="truncate">
                          {c.current_position}
                          {c.current_company ? ` @ ${c.current_company}` : ""}
                        </span>
                      </p>
                    ) : null}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    aria-label={`Excluir candidato ${c.full_name}`}
                    onClick={() => handleDelete(c.id as string)}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>

                <div className="mt-2 space-y-1 text-xs text-text-tertiary">
                  {c.email ? (
                    <div className="flex min-w-0 items-center gap-1">
                      <Mail className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{c.email as string}</span>
                    </div>
                  ) : null}
                  {c.location ? (
                    <div className="flex min-w-0 items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{c.location as string}</span>
                    </div>
                  ) : null}
                </div>


                {skills.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {skills.slice(0, 6).map((s) => (
                      <MetaPill key={s}>{s}</MetaPill>
                    ))}
                    {skills.length > 6 ? (
                      <MetaPill>+{skills.length - 6}</MetaPill>
                    ) : null}
                  </div>
                ) : null}

                {c.source ? (
                  <div className="mt-3 pt-3 border-t border-border-subtle">
                    <SourceBadge source={c.source as string} />
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
