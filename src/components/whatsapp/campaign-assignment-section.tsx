import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ASSIGNMENT_MODES, ASSIGNMENT_MODE_LABELS, type AssignmentMode } from "@/lib/whatsapp/campaign-assignment";

const HELP: Record<AssignmentMode, string> = {
  auto: "Quando o cliente responder, a regra ativa da Central de Distribuição escolhe o responsável.",
  member: "Todas as conversas desta campanha vão para a pessoa escolhida.",
  round_robin: "As conversas são divididas em rodízio, igualmente, entre os membros marcados.",
  unassigned: "As conversas entram na Inbox sem responsável, para quem assumir.",
};

type Member = { user_id: string; full_name: string | null };

export function CampaignAssignmentSection({
  mode,
  memberIds,
  members,
  disabled,
  onChange,
}: {
  mode: AssignmentMode;
  memberIds: string[];
  members: Member[];
  disabled?: boolean;
  onChange: (mode: AssignmentMode, memberIds: string[]) => void;
}) {
  const label = (m: Member) => m.full_name?.trim() || "Sem nome";
  return (
    <div className="space-y-3">
      <RadioGroup
        value={mode}
        onValueChange={(v) => onChange(v as AssignmentMode, v === "member" ? memberIds.slice(0, 1) : memberIds)}
        disabled={disabled}
        aria-label="Distribuição das conversas"
      >
        {ASSIGNMENT_MODES.map((m) => (
          <label key={m} htmlFor={`assign-${m}`} className="flex items-center gap-2 text-sm">
            <RadioGroupItem id={`assign-${m}`} value={m} />
            {ASSIGNMENT_MODE_LABELS[m]}
          </label>
        ))}
      </RadioGroup>
      <p className="text-xs text-muted-foreground">{HELP[mode]}</p>

      {mode === "member" && (
        <div>
          <label htmlFor="assign-member" className="text-xs text-muted-foreground">
            Membro responsável
          </label>
          <Select
            value={memberIds[0] ?? ""}
            onValueChange={(v) => onChange("member", [v])}
            disabled={disabled}
          >
            <SelectTrigger id="assign-member">
              <SelectValue placeholder="Escolha um membro" />
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {label(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {mode === "round_robin" && (
        <fieldset className="space-y-1" disabled={disabled}>
          <legend className="text-xs text-muted-foreground">
            Membros da equipe ({memberIds.length} selecionados, mínimo 2)
          </legend>
          <div className="grid max-h-48 gap-1 overflow-y-auto rounded-md border border-border p-2 sm:grid-cols-2">
            {members.map((m) => {
              const checked = memberIds.includes(m.user_id);
              return (
                <label key={m.user_id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) =>
                      onChange(
                        "round_robin",
                        v ? [...memberIds, m.user_id] : memberIds.filter((id) => id !== m.user_id),
                      )
                    }
                  />
                  {label(m)}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
    </div>
  );
}
