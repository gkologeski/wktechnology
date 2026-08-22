// Checkbox de seleção exibido nos cards das visões Quadro/Kanban.
// Fica discreto (aparece no hover/foco) e sempre visível quando marcado.
import { Checkbox } from "@/components/ui/checkbox";

export function BoardCardCheckbox({
  selected,
  label,
  onToggle,
}: {
  selected: boolean;
  label: string;
  onToggle: (shift: boolean) => void;
}) {
  return (
    <span
      className={`shrink-0 transition-opacity ${
        selected ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
      }`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <Checkbox
        checked={selected}
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          onToggle((e as unknown as MouseEvent).shiftKey === true);
        }}
      />
    </span>
  );
}
