import { Link } from "@tanstack/react-router";
import { ArrowLeft, Download, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AtsPageHeader, StatusBadge } from "@/components/ats/ui";
import { MetaPill } from "@/components/techhire/ui";
import { STATUS_LABEL, STATUS_TO_BADGE } from "@/components/ats/jobs/job-labels";
import type { Candidate } from "@/components/ats/jobs/job-detail.types";

export function JobDetailHeader({
  title,
  status,
  metaItems,
  totalApps,
  addOpen,
  onAddOpenChange,
  onOpenAdd,
  candidates,
  selectedCand,
  onSelectedCandChange,
  onAdd,
  onExport,
}: {
  title: string;
  status: string;
  metaItems: Array<{ key: string; label: string }>;
  totalApps: number;
  addOpen: boolean;
  onAddOpenChange: (v: boolean) => void;
  onOpenAdd: () => void;
  candidates: Candidate[];
  selectedCand: string;
  onSelectedCandChange: (v: string) => void;
  onAdd: () => void;
  onExport: () => void;
}) {
  const statusVariant = STATUS_TO_BADGE[status] ?? "draft";
  return (
    <AtsPageHeader
      eyebrow="Vagas"
      title={title}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <Link
            to="/jobs"
            className="inline-flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="h-3 w-3" aria-hidden />
            Voltar
          </Link>
          <StatusBadge status={statusVariant} label={STATUS_LABEL[status] ?? status} />
          {metaItems.map((m) => (
            <MetaPill key={m.key}>{m.label}</MetaPill>
          ))}
          <span className="inline-flex items-center gap-1 text-xs text-text-tertiary">
            <Users className="h-3 w-3" aria-hidden />
            {totalApps} {totalApps === 1 ? "candidato" : "candidatos"}
          </span>
        </span>
      }
      secondaryActions={
        <Button variant="outline" onClick={onExport}>
          <Download className="h-4 w-4 mr-2" aria-hidden />
          CSV
        </Button>
      }
      primaryAction={
        <Dialog open={addOpen} onOpenChange={onAddOpenChange}>
          <DialogTrigger asChild>
            <Button onClick={onOpenAdd}>
              <Plus className="h-4 w-4 mr-2" aria-hidden />
              Adicionar candidato
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar candidato à vaga</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="job-detail-add-candidate">Candidato</Label>
              <Select value={selectedCand} onValueChange={onSelectedCandChange}>
                <SelectTrigger id="job-detail-add-candidate">
                  <SelectValue placeholder="Escolha um candidato cadastrado" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-text-tertiary">
                      Nenhum candidato cadastrado.
                    </div>
                  ) : (
                    candidates.map((c) => (
                      <SelectItem key={c.id} value={c.id as string}>
                        {c.full_name as string}
                        {c.email ? ` — ${c.email}` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onAddOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={onAdd} disabled={!selectedCand}>
                Adicionar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    />
  );
}
