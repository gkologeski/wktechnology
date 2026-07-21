// Dialog "Contratar candidato" — promove um candidato do ATS a pessoa no TechPeople.
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  promoteCandidateToPerson,
  PEOPLE_EMPLOYMENT_TYPES,
  PEOPLE_EMPLOYMENT_LABELS,
  type PeopleEmploymentType,
} from "@/lib/people/people.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  candidateId: string;
  candidateName: string;
  suggestedRole?: string | null;
};

export function HireCandidateDialog({
  open,
  onOpenChange,
  candidateId,
  candidateName,
  suggestedRole,
}: Props) {
  const navigate = useNavigate();
  const promote = useServerFn(promoteCandidateToPerson);

  const [employment, setEmployment] = useState<PeopleEmploymentType>("pj");
  const [roleTitle, setRoleTitle] = useState(suggestedRole ?? "");
  const [hireDate, setHireDate] = useState(new Date().toISOString().slice(0, 10));
  const [costHour, setCostHour] = useState("");

  const mut = useMutation({
    mutationFn: () =>
      promote({
        data: {
          candidate_id: candidateId,
          employment_type: employment,
          role_title: roleTitle || null,
          hire_date: hireDate || null,
          cost_hour: costHour ? Number(costHour) : null,
        },
      }),
    onSuccess: (res) => {
      onOpenChange(false);
      toast.success(res.existed ? "Candidato já era uma pessoa" : "Candidato contratado");
      navigate({ to: "/people/$id", params: { id: res.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Contratar {candidateName}</DialogTitle>
          <DialogDescription>
            Cria uma pessoa no TechPeople a partir deste candidato. Você poderá editar a ficha
            depois.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label>Vínculo</Label>
            <Select
              value={employment}
              onValueChange={(v) => setEmployment(v as PeopleEmploymentType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PEOPLE_EMPLOYMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {PEOPLE_EMPLOYMENT_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Cargo</Label>
            <Input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data de início</Label>
              <Input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Custo/hora (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={costHour}
                onChange={(e) => setCostHour(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={mut.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            <UserPlus className="h-4 w-4 mr-2" />
            {mut.isPending ? "Contratando..." : "Contratar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
