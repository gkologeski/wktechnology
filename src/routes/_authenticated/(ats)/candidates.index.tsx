import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";
import {
  Plus,
  Trash2,
  Sparkles,
  Download,
  Users,
  MapPin,
  Mail,
  Briefcase,
  LayoutGrid,
  Rows3,
  Columns3,
  ExternalLink,
  Linkedin,
  FileText,
  UserPlus,
  ArrowLeft,
  Loader2,
  Target,
  Flame,
} from "lucide-react";

import { toast } from "sonner";
import { AssigneeFilter, useAssigneeFilter } from "@/components/entity/assignee-filter";
import { AssigneeCell } from "@/components/entity/assignee-cell";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listAtsCandidates,
  saveAtsCandidate,
  deleteAtsCandidate,
  setCandidateArchived,
} from "@/lib/ats/ats.functions";
import { AssociateCandidateJobDialog } from "@/components/ats/associate-candidate-job-dialog";

import { parseCv } from "@/lib/ats/cv-parse.functions";
import { parseCvFromPdf } from "@/lib/ats/cv-parse-pdf.functions";
import { previewLinkedinProfile } from "@/lib/ats/candidates-linkedin-preview.functions";
import { exportAtsCandidatesCsv } from "@/lib/ats/export.functions";
import {
  getCandidateStatuses,
  DERIVED_STATUS_LABELS,
  type DerivedCandidateStatus,
} from "@/lib/ats/candidate-status.functions";
import { CvPdfUploadButton } from "@/components/ats/cv-pdf-upload-button";
import { AtsPageHeader, FilterBar, EmptyState, Skeletons, SourceBadge } from "@/components/ats/ui";
import { MetaPill } from "@/components/techhire/ui";
import { KanbanScrollContainer } from "@/components/kanban/kanban-scroll-container";
import { cn } from "@/lib/utils";
import { computeCandidateSignals } from "@/lib/kanban/candidates-signals";
import { KanbanSignalIcons, kanbanBorderStyle } from "@/components/kanban/kanban-signal-indicator";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useGridSelection } from "@/components/grid/use-grid-selection";
import { GridBulkBar } from "@/components/grid/grid-bulk-bar";
import { usePermissions } from "@/lib/access-control/use-permissions";

export const Route = createFileRoute("/_authenticated/(ats)/candidates/")({
  component: CandidatesPage,
});

type Cand = Awaited<ReturnType<typeof listAtsCandidates>>[number];

const STATUS_ORDER: DerivedCandidateStatus[] = [
  "new",
  "in_process",
  "interview",
  "offer",
  "hired",
  "archived",
];

const STATUS_CLS: Record<DerivedCandidateStatus, string> = {
  new: "border-border-subtle bg-surface-sunken text-text-secondary",
  in_process: "border-stage-screen/30 bg-stage-screen/10 text-stage-screen",
  interview: "border-stage-interview/30 bg-stage-interview/10 text-stage-interview",
  offer: "border-stage-offer/30 bg-stage-offer/10 text-stage-offer",
  hired: "border-stage-hired/30 bg-stage-hired/10 text-stage-hired",
  archived: "border-stage-rejected/30 bg-stage-rejected/10 text-stage-rejected",
};

function CandidateStatusPill({ status }: { status: DerivedCandidateStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none whitespace-nowrap",
        STATUS_CLS[status],
      )}
    >
      {DERIVED_STATUS_LABELS[status]}
    </span>
  );
}

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
  const previewLinkedin = useServerFn(previewLinkedinProfile);
  const exportCsv = useServerFn(exportAtsCandidatesCsv);
  const getStatuses = useServerFn(getCandidateStatuses);
  const archiveCandidate = useServerFn(setCandidateArchived);
  const queryClient = useQueryClient();
  useRealtimeInvalidate([{ table: "ats_candidates", queryKeys: [["ats-candidates"]] }]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<DerivedCandidateStatus | null>(null);
  const [associateState, setAssociateState] = useState<{
    open: boolean;
    candidateId?: string;
    candidateName?: string;
  }>({ open: false });

  const [view, setView] = useState<"cards" | "table" | "kanban">(() =>
    typeof window !== "undefined"
      ? ((localStorage.getItem("candidates:view") as "cards" | "table" | "kanban") ?? "cards")
      : "cards",
  );

  const [statusFilter, setStatusFilter] = useState<DerivedCandidateStatus | "all">("all");
  const [cvText, setCvText] = useState("");
  const [cvUrl, setCvUrl] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [open, setOpen] = useState(false);
  const [createMode, setCreateMode] = useState<"chooser" | "manual" | "linkedin" | "cv">("chooser");
  const [linkedinUrlInput, setLinkedinUrlInput] = useState("");
  const [linkedinLoading, setLinkedinLoading] = useState(false);
  const [linkedinError, setLinkedinError] = useState<string | null>(null);
  const [importedFromLinkedin, setImportedFromLinkedin] = useState(false);
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
    experiences: [] as Array<{
      title: string;
      company: string;
      start: string;
      end: string;
      description: string;
    }>,
    education: [] as Array<{ school: string; degree: string; start: string; end: string }>,
  });

  const resetForm = () =>
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
      experiences: [],
      education: [],
    });

  const resetCreateDialog = () => {
    setCreateMode("chooser");
    setLinkedinUrlInput("");
    setLinkedinError(null);
    setLinkedinLoading(false);
    setImportedFromLinkedin(false);
    setCvText("");
    setCvUrl(null);
    setParsing(false);
    resetForm();
  };

  const LINKEDIN_URL_RE = /^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\/[^/?#]+\/?/i;
  const canSearchLinkedin = LINKEDIN_URL_RE.test(linkedinUrlInput.trim());

  const handleImportLinkedin = async () => {
    const url = linkedinUrlInput.trim();
    if (!LINKEDIN_URL_RE.test(url)) {
      setLinkedinError("URL inválida. Use o formato https://linkedin.com/in/usuario");
      return;
    }
    setLinkedinLoading(true);
    setLinkedinError(null);
    try {
      const res = await previewLinkedin({ data: { url } });
      if (!res.ok) {
        setLinkedinError(res.message);
        if (res.code === "unipile_not_connected") {
          toast.error(res.message, {
            action: {
              label: "Conectar",
              onClick: () => {
                window.location.href = "/settings/integrations/linkedin";
              },
            },
          });
        } else {
          toast.error(res.message);
        }
        return;
      }
      const d = res.data;
      setForm({
        full_name: d.full_name || "",
        email: d.email || "",
        phone: d.phone || "",
        linkedin_url: d.linkedin_url || url,
        location: d.location || "",
        current_position: d.current_position || d.headline || "",
        current_company: d.current_company || "",
        skills: (d.skills ?? []).join(", "),
        notes: "",
        experiences: (d.experiences ?? []).map((e) => ({
          title: e.title || "",
          company: e.company || "",
          start: e.start || "",
          end: e.end || "",
          description: e.description || "",
        })),
        education: (d.education ?? []).map((e) => ({
          school: e.school || "",
          degree: e.degree || "",
          start: e.start || "",
          end: e.end || "",
        })),
      });
      setImportedFromLinkedin(true);
      setCreateMode("manual");
      toast.success("Perfil importado do LinkedIn — revise os dados e salve");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao buscar perfil";
      setLinkedinError(msg);
      toast.error(msg);
    } finally {
      setLinkedinLoading(false);
    }
  };

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

  const { assignee, setAssignee, filterRows } = useAssigneeFilter();
  const loading = q.isLoading;
  const error = q.error ? (q.error instanceof Error ? q.error.message : "Falha ao listar") : null;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["ats-candidates"] });

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("candidates:view", view);
  }, [view]);

  const ids = useMemo(() => rows.map((r) => r.id as string), [rows]);
  const idsKey = ids.join(",");
  const statusQ = useQuery({
    queryKey: ["ats-candidate-statuses", idsKey],
    queryFn: () => getStatuses({ data: { ids } }),
    enabled: ids.length > 0,
    staleTime: 30_000,
  });
  const statuses: Record<string, DerivedCandidateStatus> = statusQ.data ?? {};

  const byStatusRows = useMemo(() => {
    if (statusFilter === "all") return rows;
    return rows.filter((r) => (statuses[r.id as string] ?? "new") === statusFilter);
  }, [rows, statuses, statusFilter]);
  const visibleRows = filterRows(byStatusRows);

  const { canAny } = usePermissions();
  const selection = useGridSelection(visibleRows as Array<Cand & { id: string }>);
  const selectAllFiltered = () =>
    selection.setSelectedIds(new Set(visibleRows.map((r) => r.id as string)));



  const statusCounts = useMemo(() => {
    const c: Record<DerivedCandidateStatus, number> = {
      new: 0,
      in_process: 0,
      interview: 0,
      offer: 0,
      hired: 0,
      archived: 0,
    };
    for (const r of rows) c[statuses[r.id as string] ?? "new"]++;
    return c;
  }, [rows, statuses]);

  const CAND_FOCUS_KEY = "candidates:focusMode";
  const [focusMode, setFocusMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(CAND_FOCUS_KEY) === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(CAND_FOCUS_KEY, focusMode ? "1" : "0");
    } catch {
      /* noop */
    }
  }, [focusMode]);

  const candSignals = useMemo(
    () =>
      computeCandidateSignals(
        rows.map((r) => ({
          id: r.id as string,
          updated_at: (r as { updated_at?: string | null }).updated_at ?? null,
          created_at: (r as { created_at?: string | null }).created_at ?? null,
        })),
        (c) => statuses[c.id] ?? "new",
      ),
    [rows, statuses],
  );

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
            ? form.skills
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
                .slice(0, 100)
            : [],
          experiences: form.experiences
            .map((e) => ({
              title: e.title.trim(),
              company: e.company.trim(),
              start: e.start.trim(),
              end: e.end.trim(),
              description: e.description.trim(),
            }))
            .filter((e) => e.title || e.company || e.description)
            .slice(0, 20),
          education: form.education
            .map((e) => ({
              school: e.school.trim(),
              degree: e.degree.trim(),
              start: e.start.trim(),
              end: e.end.trim(),
            }))
            .filter((e) => e.school || e.degree)
            .slice(0, 20),
          source: "manual",
          notes: form.notes || null,
        },
      });
      setOpen(false);
      resetCreateDialog();
      refresh();
      toast.success("Candidato salvo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmDialog("Excluir este candidato?"))) return;
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
      toast.success(
        `Candidato criado a partir do CV${res.parsed.full_name ? `: ${res.parsed.full_name}` : ""}`,
      );
      setOpen(false);
      resetCreateDialog();
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
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" aria-hidden="true" />
            CSV
          </Button>
        }
        primaryAction={
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) resetCreateDialog();
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                Novo candidato
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {createMode === "chooser"
                    ? "Como deseja cadastrar o candidato?"
                    : createMode === "linkedin"
                      ? "Importar do LinkedIn"
                      : createMode === "cv"
                        ? "Extrair de um currículo (PDF)"
                        : "Novo candidato"}
                </DialogTitle>
              </DialogHeader>

              {createMode === "chooser" && (
                <div className="grid gap-3 sm:grid-cols-3 py-2">
                  <button
                    type="button"
                    onClick={() => setCreateMode("manual")}
                    className="group flex flex-col items-start gap-2 rounded-lg border border-border-subtle bg-surface-1 p-4 text-left transition-all hover:border-border-strong hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-surface-sunken text-text-secondary group-hover:text-text-primary">
                      <UserPlus className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-text-primary">
                        Preencher manualmente
                      </div>
                      <p className="mt-1 text-xs text-text-secondary">
                        Formulário rápido com nome, contatos e cargo.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreateMode("linkedin")}
                    className="group flex flex-col items-start gap-2 rounded-lg border border-border-subtle bg-surface-1 p-4 text-left transition-all hover:border-border-strong hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-surface-sunken text-text-secondary group-hover:text-text-primary">
                      <Linkedin className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-text-primary">
                        Importar do LinkedIn
                      </div>
                      <p className="mt-1 text-xs text-text-secondary">
                        Cole a URL do perfil e o ATS baixa via Unipile.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreateMode("cv")}
                    className="group flex flex-col items-start gap-2 rounded-lg border border-border-subtle bg-surface-1 p-4 text-left transition-all hover:border-border-strong hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-surface-sunken text-text-secondary group-hover:text-text-primary">
                      <FileText className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-text-primary">
                        Extrair de um CV (PDF)
                      </div>
                      <p className="mt-1 text-xs text-text-secondary">
                        A IA lê o currículo e cria o candidato.
                      </p>
                    </div>
                  </button>
                </div>
              )}

              {createMode === "linkedin" && (
                <div className="space-y-3 py-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="li-url">URL do perfil no LinkedIn</Label>
                    <Input
                      id="li-url"
                      value={linkedinUrlInput}
                      onChange={(e) => {
                        setLinkedinUrlInput(e.target.value);
                        setLinkedinError(null);
                      }}
                      placeholder="https://www.linkedin.com/in/usuario"
                      autoFocus
                      disabled={linkedinLoading}
                    />
                    <p className="text-xs text-text-tertiary">
                      Requer conexão LinkedIn ativa em Integrações. Nada é salvo até você revisar.
                    </p>
                    {linkedinError && (
                      <p className="text-xs text-destructive" role="alert">
                        {linkedinError}
                      </p>
                    )}
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setCreateMode("chooser")}
                      disabled={linkedinLoading}
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
                      Voltar
                    </Button>
                    <Button
                      onClick={handleImportLinkedin}
                      disabled={!canSearchLinkedin || linkedinLoading}
                    >
                      {linkedinLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                          Baixando perfil…
                        </>
                      ) : (
                        <>
                          <Linkedin className="h-4 w-4 mr-2" aria-hidden="true" />
                          Buscar perfil
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </div>
              )}

              {createMode === "cv" && (
                <div className="space-y-2 py-2">
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
                    A IA extrai nome, contatos, skills, experiência e formação, e cria um novo
                    candidato.
                  </p>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setCreateMode("chooser")}
                      disabled={parsing}
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
                      Voltar
                    </Button>
                    <Button onClick={handleParseCv} disabled={parsing}>
                      {parsing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                          Processando…
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" aria-hidden="true" />
                          Extrair e salvar
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </div>
              )}

              {createMode === "manual" && (
                <>
                  {importedFromLinkedin && (
                    <div className="mb-2 inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-surface-sunken px-2 py-1 text-[11px] text-text-secondary">
                      <Linkedin className="h-3 w-3" aria-hidden="true" />
                      Importado do LinkedIn — revise e salve
                    </div>
                  )}
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
                    <div className="col-span-2 rounded-md border border-border-subtle p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                          Experiência ({form.experiences.length})
                        </Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setForm({
                              ...form,
                              experiences: [
                                ...form.experiences,
                                { title: "", company: "", start: "", end: "", description: "" },
                              ],
                            })
                          }
                        >
                          + Adicionar
                        </Button>
                      </div>
                      {form.experiences.length === 0 ? (
                        <p className="text-xs text-text-secondary">
                          Nenhuma experiência adicionada.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {form.experiences.map((exp, idx) => (
                            <div
                              key={idx}
                              className="rounded-md border border-border-subtle bg-surface-sunken p-3 space-y-2"
                            >
                              <div className="grid grid-cols-2 gap-2">
                                <Input
                                  placeholder="Cargo"
                                  value={exp.title}
                                  onChange={(e) => {
                                    const next = [...form.experiences];
                                    next[idx] = { ...next[idx], title: e.target.value };
                                    setForm({ ...form, experiences: next });
                                  }}
                                />
                                <Input
                                  placeholder="Empresa"
                                  value={exp.company}
                                  onChange={(e) => {
                                    const next = [...form.experiences];
                                    next[idx] = { ...next[idx], company: e.target.value };
                                    setForm({ ...form, experiences: next });
                                  }}
                                />
                                <Input
                                  placeholder="Início (ex.: 2020)"
                                  value={exp.start}
                                  onChange={(e) => {
                                    const next = [...form.experiences];
                                    next[idx] = { ...next[idx], start: e.target.value };
                                    setForm({ ...form, experiences: next });
                                  }}
                                />
                                <Input
                                  placeholder="Fim (ex.: 2023 ou atual)"
                                  value={exp.end}
                                  onChange={(e) => {
                                    const next = [...form.experiences];
                                    next[idx] = { ...next[idx], end: e.target.value };
                                    setForm({ ...form, experiences: next });
                                  }}
                                />
                              </div>
                              <Textarea
                                rows={2}
                                placeholder="Descrição / responsabilidades"
                                value={exp.description}
                                onChange={(e) => {
                                  const next = [...form.experiences];
                                  next[idx] = { ...next[idx], description: e.target.value };
                                  setForm({ ...form, experiences: next });
                                }}
                              />
                              <div className="flex justify-end">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setForm({
                                      ...form,
                                      experiences: form.experiences.filter((_, i) => i !== idx),
                                    })
                                  }
                                >
                                  Remover
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="col-span-2 rounded-md border border-border-subtle p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                          Formação ({form.education.length})
                        </Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setForm({
                              ...form,
                              education: [
                                ...form.education,
                                { school: "", degree: "", start: "", end: "" },
                              ],
                            })
                          }
                        >
                          + Adicionar
                        </Button>
                      </div>
                      {form.education.length === 0 ? (
                        <p className="text-xs text-text-secondary">Nenhuma formação adicionada.</p>
                      ) : (
                        <div className="space-y-3">
                          {form.education.map((edu, idx) => (
                            <div
                              key={idx}
                              className="rounded-md border border-border-subtle bg-surface-sunken p-3 space-y-2"
                            >
                              <div className="grid grid-cols-2 gap-2">
                                <Input
                                  placeholder="Instituição"
                                  value={edu.school}
                                  onChange={(e) => {
                                    const next = [...form.education];
                                    next[idx] = { ...next[idx], school: e.target.value };
                                    setForm({ ...form, education: next });
                                  }}
                                />
                                <Input
                                  placeholder="Curso / grau"
                                  value={edu.degree}
                                  onChange={(e) => {
                                    const next = [...form.education];
                                    next[idx] = { ...next[idx], degree: e.target.value };
                                    setForm({ ...form, education: next });
                                  }}
                                />
                                <Input
                                  placeholder="Início"
                                  value={edu.start}
                                  onChange={(e) => {
                                    const next = [...form.education];
                                    next[idx] = { ...next[idx], start: e.target.value };
                                    setForm({ ...form, education: next });
                                  }}
                                />
                                <Input
                                  placeholder="Fim"
                                  value={edu.end}
                                  onChange={(e) => {
                                    const next = [...form.education];
                                    next[idx] = { ...next[idx], end: e.target.value };
                                    setForm({ ...form, education: next });
                                  }}
                                />
                              </div>
                              <div className="flex justify-end">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setForm({
                                      ...form,
                                      education: form.education.filter((_, i) => i !== idx),
                                    })
                                  }
                                >
                                  Remover
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
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
                    <Button variant="outline" onClick={() => setCreateMode("chooser")}>
                      <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
                      Voltar
                    </Button>
                    <Button onClick={handleCreate}>Salvar</Button>
                  </DialogFooter>
                </>
              )}
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
        chips={
          <>
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium",
                statusFilter === "all"
                  ? "border-border-strong bg-surface-1 text-text-primary"
                  : "border-border-subtle bg-surface-sunken text-text-secondary hover:text-text-primary",
              )}
            >
              Todos <span className="tabular-nums opacity-70">{rows.length}</span>
            </button>
            {STATUS_ORDER.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium",
                  statusFilter === s
                    ? "border-border-strong bg-surface-1 text-text-primary"
                    : "border-border-subtle bg-surface-sunken text-text-secondary hover:text-text-primary",
                )}
              >
                {DERIVED_STATUS_LABELS[s]}{" "}
                <span className="tabular-nums opacity-70">{statusCounts[s]}</span>
              </button>
            ))}
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <AssigneeFilter value={assignee} onChange={setAssignee} className="h-8 w-44 text-xs" />
            <Tabs value={view} onValueChange={(v) => setView(v as "cards" | "table" | "kanban")}>
              <TabsList className="h-8">
                <TabsTrigger value="cards" className="h-7 px-2 text-xs gap-1">
                  <LayoutGrid className="h-3.5 w-3.5" aria-hidden /> Cards
                </TabsTrigger>
                <TabsTrigger value="table" className="h-7 px-2 text-xs gap-1">
                  <Rows3 className="h-3.5 w-3.5" aria-hidden /> Tabela
                </TabsTrigger>
                <TabsTrigger value="kanban" className="h-7 px-2 text-xs gap-1">
                  <Columns3 className="h-3.5 w-3.5" aria-hidden /> Kanban
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        }
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
      ) : visibleRows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={
            search || statusFilter !== "all"
              ? "Nenhum candidato encontrado"
              : "Nenhum candidato cadastrado"
          }
          description={
            search || statusFilter !== "all"
              ? "Tente outros termos ou limpe o filtro."
              : "Cadastre um candidato manualmente ou use o parsing de CV (IA) para importar a partir de um currículo."
          }
          action={
            search || statusFilter !== "all" ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                }}
              >
                Limpar filtros
              </Button>
            ) : (
              <Button onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                Novo candidato
              </Button>
            )
          }
        />
      ) : view === "cards" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleRows.map((c) => {
            const skills = Array.isArray(c.skills) ? (c.skills as string[]) : [];
            const status = statuses[c.id as string] ?? "new";
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
                    <Link
                      to="/candidates/$id"
                      params={{ id: c.id as string }}
                      className="text-sm font-semibold text-text-primary truncate block hover:underline"
                    >
                      {c.full_name as string}
                    </Link>
                    {c.current_position ? (
                      <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-text-secondary">
                        <Briefcase
                          className="h-3 w-3 shrink-0 text-text-tertiary"
                          aria-hidden="true"
                        />
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
                    {skills.length > 6 ? <MetaPill>+{skills.length - 6}</MetaPill> : null}
                  </div>
                ) : null}

                <div className="mt-3 pt-3 border-t border-border-subtle flex items-center justify-between gap-2">
                  <CandidateStatusPill status={status} />
                  {c.source ? <SourceBadge source={c.source as string} /> : <span />}
                </div>
              </article>
            );
          })}
        </div>
      ) : view === "table" ? (
        <>
          {selection.hasSelection && (
            <GridBulkBar
              table="ats_candidates"
              ids={selection.ids}
              rows={selection.selectedRows}
              entityLabel="candidato(s)"
              onClear={selection.clear}
              onDone={refresh}
              totalMatching={visibleRows.length}
              onSelectAll={selectAllFiltered}
              canUpdate={canAny(["techhire.candidates.update.workspace"])}
              canDelete={canAny(["techhire.candidates.delete.workspace"])}
              bulkEditFields={[
                { name: "location", label: "Localização", type: "text" },
                { name: "current_position", label: "Cargo atual", type: "text" },
                { name: "current_company", label: "Empresa atual", type: "text" },
                { name: "source", label: "Origem", type: "text" },
              ]}
            />
          )}
          <div className="rounded-lg border border-border-subtle bg-surface-1 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      aria-label="Selecionar todos os candidatos exibidos"
                      checked={
                        selection.allOnPageSelected
                          ? true
                          : selection.someOnPageSelected
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={selection.toggleAllOnPage}
                    />
                  </TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((c) => {
                  const status = statuses[c.id as string] ?? "new";
                  return (
                    <TableRow
                      key={c.id as string}
                      className="group"
                      data-state={selection.isSelected(c.id as string) ? "selected" : undefined}
                    >
                      <TableCell>
                        <Checkbox
                          aria-label={`Selecionar candidato ${c.full_name}`}
                          checked={selection.isSelected(c.id as string)}
                          onCheckedChange={() => selection.toggleOne(c.id as string)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link
                          to="/candidates/$id"
                          params={{ id: c.id as string }}
                          className="text-text-primary hover:underline inline-flex items-center gap-1"
                        >
                          {c.full_name as string}
                          <ExternalLink
                            className="h-3 w-3 opacity-0 group-hover:opacity-60"
                            aria-hidden
                          />
                        </Link>
                        {c.email ? (
                          <div className="text-xs text-text-tertiary truncate max-w-[240px]">
                            {c.email as string}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-text-secondary">
                        {c.current_position ? (
                          <span className="text-sm">
                            {c.current_position}
                            {c.current_company ? (
                              <span className="text-text-tertiary"> @ {c.current_company}</span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="text-text-tertiary">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-text-secondary">
                        {c.location ? (
                          (c.location as string)
                        ) : (
                          <span className="text-text-tertiary">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <CandidateStatusPill status={status} />
                      </TableCell>
                      <TableCell>
                        <AssigneeCell
                          assignedTo={(c as { assigned_to?: string | null }).assigned_to}
                        />
                      </TableCell>
                      <TableCell>
                        {c.source ? (
                          <SourceBadge source={c.source as string} />
                        ) : (
                          <span className="text-text-tertiary">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100"
                          aria-label={`Excluir candidato ${c.full_name}`}
                          onClick={() => handleDelete(c.id as string)}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>

      ) : (
        <>
          <div className="mb-2 flex justify-end">
            <Button
              size="sm"
              variant={focusMode ? "default" : "outline"}
              onClick={() => setFocusMode(!focusMode)}
              aria-pressed={focusMode}
              title="Reordena por estagnação por estágio e esmaece candidatos em movimento"
              className="h-8"
            >
              <Target className="h-4 w-4 mr-1" />
              Modo de foco
            </Button>
          </div>
          <KanbanScrollContainer ariaLabel="Quadro de candidatos">
            <div className="flex gap-2 pb-4">
              {STATUS_ORDER.map((s) => {
                const rawCol = rows.filter((r) => (statuses[r.id as string] ?? "new") === s);
                const colRows = focusMode
                  ? [...rawCol].sort(
                      (a, b) =>
                        (candSignals.get(b.id as string)?.score ?? 0) -
                        (candSignals.get(a.id as string)?.score ?? 0),
                    )
                  : rawCol;
                const hotCount = colRows.reduce(
                  (n, r) => n + (candSignals.get(r.id as string)?.isHot ? 1 : 0),
                  0,
                );
                const isOver = dragOverCol === s;

                const handleDrop = async (jobId: string) => {
                  const candidateId = jobId; // dataTransfer carrega o id do candidato
                  const candidate = rows.find((r) => r.id === candidateId);
                  if (!candidate) return;
                  const from = (statuses[candidateId] ?? "new") as DerivedCandidateStatus;
                  if (from === s) return;

                  // *  →  archived  → mutação segura
                  if (s === "archived") {
                    try {
                      await archiveCandidate({ data: { id: candidateId, archived: true } });
                      toast.success(`${candidate.full_name as string} arquivado`);
                      void queryClient.invalidateQueries({ queryKey: ["ats-candidate-statuses"] });
                      void queryClient.invalidateQueries({ queryKey: ["ats-candidates"] });
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Falha ao arquivar");
                    }
                    return;
                  }
                  // archived → new  → desarquivar
                  if (from === "archived" && s === "new") {
                    try {
                      await archiveCandidate({ data: { id: candidateId, archived: false } });
                      toast.success(`${candidate.full_name as string} desarquivado`);
                      void queryClient.invalidateQueries({ queryKey: ["ats-candidate-statuses"] });
                      void queryClient.invalidateQueries({ queryKey: ["ats-candidates"] });
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Falha ao desarquivar");
                    }
                    return;
                  }
                  // new → in_process  → exige associação a uma vaga (abre diálogo)
                  if (from === "new" && s === "in_process") {
                    setAssociateState({
                      open: true,
                      candidateId,
                      candidateName: candidate.full_name as string,
                    });
                    toast.message("Associe o candidato a uma vaga para movê-lo para 'Em processo'");
                    return;
                  }
                  // demais transições — não há mutação direta segura
                  toast.warning(
                    `Transição "${DERIVED_STATUS_LABELS[from]}" → "${DERIVED_STATUS_LABELS[s]}" precisa ser feita pelo fluxo da vaga (entrevista, oferta, etc.).`,
                  );
                };
                return (
                  <div
                    key={s}
                    data-kanban-column-root={s}
                    onDragOver={(e) => {
                      if (!draggingId) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (dragOverCol !== s) setDragOverCol(s);
                    }}
                    onDragLeave={(e) => {
                      if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node))
                        setDragOverCol((c) => (c === s ? null : c));
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData("text/plain") || draggingId;
                      setDragOverCol(null);
                      setDraggingId(null);
                      if (id) void handleDrop(id);
                    }}
                    className={cn(
                      "flex w-[280px] shrink-0 flex-col rounded-md border bg-surface-sunken transition-colors",
                      isOver ? "border-primary/60 ring-1 ring-primary/30" : "border-border-subtle",
                    )}
                  >
                    <div className="sticky top-0 z-10 rounded-t-md border-b border-border-subtle bg-surface-sunken px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <CandidateStatusPill status={s} />
                        <span className="flex items-center gap-1 text-[11px] tabular-nums text-text-tertiary">
                          {hotCount > 0 && (
                            <span
                              className="inline-flex items-center gap-0.5"
                              title={`${hotCount} parado(s)`}
                              style={{ color: "var(--hs-orange)" }}
                            >
                              <Flame className="h-3 w-3" aria-hidden />
                              {hotCount}
                            </span>
                          )}
                          <span>{colRows.length}</span>
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 space-y-1.5 p-2 min-h-[200px]">
                      {colRows.map((c) => {
                        const skills = Array.isArray(c.skills) ? (c.skills as string[]) : [];
                        const cid = c.id as string;
                        const sig = candSignals.get(cid);
                        const dim = focusMode && sig?.klass === "cold";
                        return (
                          <Link
                            key={cid}
                            to="/candidates/$id"
                            params={{ id: cid }}
                            data-kanban-card
                            data-kanban-column={s}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData("text/plain", cid);
                              setDraggingId(cid);
                            }}
                            onDragEnd={() => {
                              setDraggingId(null);
                              setDragOverCol(null);
                            }}
                            style={kanbanBorderStyle(sig)}
                            className={cn(
                              "block rounded-md border border-border-subtle bg-surface-1 p-2.5",
                              "transition-all hover:border-border-strong hover:shadow-sm",
                              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              "cursor-grab active:cursor-grabbing",
                              draggingId === cid && "opacity-50",
                              dim && "opacity-60",
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="truncate text-sm font-medium text-text-primary">
                                {c.full_name as string}
                              </div>
                              <KanbanSignalIcons signals={sig} />
                            </div>

                            {c.current_position ? (
                              <div className="mt-0.5 flex items-center gap-1 text-xs text-text-secondary">
                                <Briefcase
                                  className="h-3 w-3 shrink-0 text-text-tertiary"
                                  aria-hidden
                                />
                                <span className="truncate">
                                  {c.current_position}
                                  {c.current_company ? ` @ ${c.current_company}` : ""}
                                </span>
                              </div>
                            ) : null}
                            {c.location ? (
                              <div className="mt-0.5 flex items-center gap-1 text-xs text-text-tertiary">
                                <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                                <span className="truncate">{c.location as string}</span>
                              </div>
                            ) : null}
                            {skills.length > 0 ? (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {skills.slice(0, 3).map((sk) => (
                                  <MetaPill key={sk}>{sk}</MetaPill>
                                ))}
                                {skills.length > 3 ? (
                                  <MetaPill>+{skills.length - 3}</MetaPill>
                                ) : null}
                              </div>
                            ) : null}
                            {c.source ? (
                              <div className="mt-2 border-t border-border-subtle pt-2">
                                <SourceBadge source={c.source as string} />
                              </div>
                            ) : null}
                          </Link>
                        );
                      })}
                      {colRows.length === 0 ? (
                        <p className="px-2 py-6 text-center text-xs text-text-tertiary">
                          {isOver ? "Solte aqui" : "Vazio"}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </KanbanScrollContainer>
        </>
      )}

      <AssociateCandidateJobDialog
        open={associateState.open}
        onOpenChange={(v) => setAssociateState((s) => ({ ...s, open: v }))}
        presetCandidateId={associateState.candidateId}
        presetCandidateName={associateState.candidateName}
        onSuccess={() => {
          void queryClient.invalidateQueries({ queryKey: ["ats-candidate-statuses"] });
          void queryClient.invalidateQueries({ queryKey: ["ats-candidates"] });
        }}
      />
    </div>
  );
}
