import { useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Sparkles,
  Linkedin,
  FileText,
  UserPlus,
  ArrowLeft,
  Loader2,
} from "lucide-react";

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
import { CvPdfUploadButton } from "@/components/ats/cv-pdf-upload-button";
import type { saveAtsCandidate } from "@/lib/ats/ats.functions";
import type { parseCv } from "@/lib/ats/cv-parse.functions";
import type { parseCvFromPdf } from "@/lib/ats/cv-parse-pdf.functions";
import type { previewLinkedinProfile } from "@/lib/ats/candidates-linkedin-preview.functions";

type CreateMode = "chooser" | "manual" | "linkedin" | "cv";

type FormState = {
  full_name: string;
  email: string;
  phone: string;
  linkedin_url: string;
  location: string;
  current_position: string;
  current_company: string;
  skills: string;
  notes: string;
  experiences: Array<{
    title: string;
    company: string;
    start: string;
    end: string;
    description: string;
  }>;
  education: Array<{ school: string; degree: string; start: string; end: string }>;
};

const EMPTY_FORM: FormState = {
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
};

const LINKEDIN_URL_RE = /^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\/[^/?#]+\/?/i;

export function CreateCandidateDialog({
  open,
  onOpenChange,
  save,
  parse,
  parsePdf,
  previewLinkedin,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  save: ReturnType<typeof import("@tanstack/react-start").useServerFn<typeof saveAtsCandidate>>;
  parse: ReturnType<typeof import("@tanstack/react-start").useServerFn<typeof parseCv>>;
  parsePdf: ReturnType<typeof import("@tanstack/react-start").useServerFn<typeof parseCvFromPdf>>;
  previewLinkedin: ReturnType<
    typeof import("@tanstack/react-start").useServerFn<typeof previewLinkedinProfile>
  >;
  onSaved: () => void;
}) {
  const [createMode, setCreateMode] = useState<CreateMode>("chooser");
  const [linkedinUrlInput, setLinkedinUrlInput] = useState("");
  const [linkedinLoading, setLinkedinLoading] = useState(false);
  const [linkedinError, setLinkedinError] = useState<string | null>(null);
  const [importedFromLinkedin, setImportedFromLinkedin] = useState(false);
  const [cvText, setCvText] = useState("");
  const [cvUrl, setCvUrl] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const resetForm = () => setForm(EMPTY_FORM);

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
      onOpenChange(false);
      resetCreateDialog();
      onSaved();
      toast.success("Candidato salvo");
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
      onOpenChange(false);
      resetCreateDialog();
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao processar CV");
    } finally {
      setParsing(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
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
              <Button onClick={handleImportLinkedin} disabled={!canSearchLinkedin || linkedinLoading}>
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
              <Button variant="outline" onClick={() => setCreateMode("chooser")} disabled={parsing}>
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
  );
}
