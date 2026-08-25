// Diálogo reutilizável para associar um candidato a uma vaga.
// Usado a partir de /candidates/$id, /jobs/$id e do Quick Create global.
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { addApplication, listAtsCandidates, listAtsJobs } from "@/lib/ats/ats.functions";

type Candidate = { id: string; full_name: string; email: string | null };
type Job = {
  id: string;
  title: string;
  status: string;
  seniority: string | null;
  location: string | null;
};

const SOURCES = [
  { value: "manual", label: "Manual" },
  { value: "referral", label: "Indicação" },
  { value: "linkedin_easy_apply", label: "LinkedIn" },
  { value: "career_page", label: "Página de carreiras" },
  { value: "import", label: "Importação" },
] as const;

type Source = (typeof SOURCES)[number]["value"];

export interface AssociateCandidateJobDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  presetCandidateId?: string;
  presetCandidateName?: string;
  presetJobId?: string;
  presetJobTitle?: string;
  onSuccess?: (result: { applicationId: string; candidateId: string; jobId: string }) => void;
}

export function AssociateCandidateJobDialog({
  open,
  onOpenChange,
  presetCandidateId,
  presetCandidateName,
  presetJobId,
  presetJobTitle,
  onSuccess,
}: AssociateCandidateJobDialogProps) {
  const listCands = useServerFn(listAtsCandidates);
  const listJobs = useServerFn(listAtsJobs);
  const addApp = useServerFn(addApplication);

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [candidateId, setCandidateId] = useState<string>(presetCandidateId ?? "");
  const [jobId, setJobId] = useState<string>(presetJobId ?? "");
  const [source, setSource] = useState<Source>("manual");
  const [submitting, setSubmitting] = useState(false);
  const [candQuery, setCandQuery] = useState("");
  const [jobQuery, setJobQuery] = useState("");

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setCandidateId(presetCandidateId ?? "");
    setJobId(presetJobId ?? "");
    setSource("manual");
    setCandQuery("");
    setJobQuery("");
  }, [open, presetCandidateId, presetJobId]);

  // Load lists
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingLists(true);
    (async () => {
      try {
        const needCands = !presetCandidateId;
        const needJobs = !presetJobId;
        const [c, j] = await Promise.all([
          needCands ? listCands({ data: {} }) : Promise.resolve([]),
          needJobs ? listJobs({ data: { status: "published" } }) : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setCandidates(
          (c as Array<{ id: string; full_name: string; email: string | null }>).map((x) => ({
            id: x.id,
            full_name: x.full_name,
            email: x.email,
          })),
        );
        setJobs(j as Job[]);
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Falha ao carregar listas");
      } finally {
        if (!cancelled) setLoadingLists(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, presetCandidateId, presetJobId, listCands, listJobs]);

  const filteredCands = useMemo(() => {
    const q = candQuery.trim().toLowerCase();
    if (!q) return candidates.slice(0, 50);
    return candidates
      .filter(
        (c) => c.full_name.toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [candidates, candQuery]);

  const filteredJobs = useMemo(() => {
    const q = jobQuery.trim().toLowerCase();
    const base = jobs;
    if (!q) return base.slice(0, 50);
    return base.filter((j) => j.title.toLowerCase().includes(q)).slice(0, 50);
  }, [jobs, jobQuery]);

  const canSubmit = !!candidateId && !!jobId && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const r = await addApp({
        data: { candidateId, jobId, source },
      });
      const applicationId = (r as { id: string }).id;
      toast.success("Candidato associado à vaga");
      onSuccess?.({ applicationId, candidateId, jobId });
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao associar";
      // erro de unique constraint do Postgres → mensagem amigável
      if (/duplicate key|unique/i.test(msg)) {
        toast.error("Este candidato já está nessa vaga.");
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Associar candidato à vaga</DialogTitle>
          <DialogDescription>
            Cria uma candidatura no estágio inicial do pipeline.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Candidato */}
          {presetCandidateId ? (
            <div className="rounded-md border border-border-subtle bg-surface-sunken px-3 py-2 text-sm">
              <div className="text-xs text-text-tertiary">Candidato</div>
              <div className="font-medium text-text-primary">
                {presetCandidateName ?? "Selecionado"}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Candidato</Label>
              <div className="rounded-md border border-border-subtle">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Buscar por nome ou e-mail"
                    value={candQuery}
                    onValueChange={setCandQuery}
                  />
                  <CommandList className="max-h-48">
                    {loadingLists ? (
                      <div className="flex items-center justify-center py-4 text-xs text-text-tertiary">
                        <Loader2 className="h-3 w-3 animate-spin mr-2" /> Carregando…
                      </div>
                    ) : (
                      <>
                        <CommandEmpty>Nenhum candidato encontrado.</CommandEmpty>
                        <CommandGroup>
                          {filteredCands.map((c) => (
                            <CommandItem
                              key={c.id}
                              value={c.id}
                              onSelect={() => setCandidateId(c.id)}
                              className={candidateId === c.id ? "bg-surface-sunken" : undefined}
                            >
                              <div className="flex flex-col min-w-0">
                                <span className="text-sm truncate">{c.full_name}</span>
                                {c.email && (
                                  <span className="text-xs text-text-tertiary truncate">
                                    {c.email}
                                  </span>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </>
                    )}
                  </CommandList>
                </Command>
              </div>
            </div>
          )}

          {/* Vaga */}
          {presetJobId ? (
            <div className="rounded-md border border-border-subtle bg-surface-sunken px-3 py-2 text-sm">
              <div className="text-xs text-text-tertiary">Vaga</div>
              <div className="font-medium text-text-primary">{presetJobTitle ?? "Selecionada"}</div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Vaga</Label>
              <div className="rounded-md border border-border-subtle">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Buscar vaga aberta"
                    value={jobQuery}
                    onValueChange={setJobQuery}
                  />
                  <CommandList className="max-h-48">
                    {loadingLists ? (
                      <div className="flex items-center justify-center py-4 text-xs text-text-tertiary">
                        <Loader2 className="h-3 w-3 animate-spin mr-2" /> Carregando…
                      </div>
                    ) : (
                      <>
                        <CommandEmpty>Nenhuma vaga publicada encontrada.</CommandEmpty>
                        <CommandGroup>
                          {filteredJobs.map((j) => (
                            <CommandItem
                              key={j.id}
                              value={j.id}
                              onSelect={() => setJobId(j.id)}
                              className={jobId === j.id ? "bg-surface-sunken" : undefined}
                            >
                              <div className="flex flex-col min-w-0">
                                <span className="text-sm truncate">{j.title}</span>
                                <span className="text-xs text-text-tertiary truncate">
                                  {[j.seniority, j.location].filter(Boolean).join(" · ") ||
                                    j.status}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </>
                    )}
                  </CommandList>
                </Command>
              </div>
            </div>
          )}

          {/* Origem */}
          <div className="space-y-2">
            <Label htmlFor="associate-source">Origem</Label>
            <Select value={source} onValueChange={(v) => setSource(v as Source)}>
              <SelectTrigger id="associate-source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Associando…
              </>
            ) : (
              "Associar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
