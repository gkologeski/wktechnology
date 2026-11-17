import { useSharedAction } from "@/lib/access-control/use-shared-action";
import type { WorkspaceLayout } from "@/lib/branding/tokens";

const OPTIONS: Array<{ id: WorkspaceLayout; name: string; description: string }> = [
  {
    id: "classic",
    name: "Clássico · atual",
    description: "Painéis delimitados, faixas e divisões da interface tradicional.",
  },
  {
    id: "attio",
    name: "Essencial · inspirado no Attio",
    description:
      "Canvas aberto, controles discretos e menos caixas. Timeline no centro e associações à direita.",
  },
];

export function LayoutSelector({
  value,
  onChange,
  disabled,
  colorMode,
  onColorModeChange,
}: {
  value: WorkspaceLayout;
  onChange: (value: WorkspaceLayout) => void;
  disabled?: boolean;
  colorMode: "light" | "dark";
  onColorModeChange: (mode: "light" | "dark") => void;
}) {
  const canView = useSharedAction("system.branding", "view");
  if (!canView) return null;
  return (
    <fieldset disabled={disabled} className="space-y-3">
      <legend className="mb-3 text-sm font-semibold">Layout do workspace</legend>
      <p className="text-xs text-muted-foreground">
        A escolha vale para os módulos do workspace. Logotipo, cores, fontes e permissões são
        preservados. Você pode voltar ao Clássico a qualquer momento.
      </p>
      {OPTIONS.map((option) => (
        <label
          key={option.id}
          className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 has-[:checked]:border-primary has-[:checked]:bg-accent/30"
        >
          <input
            type="radio"
            name="workspace-layout"
            value={option.id}
            checked={value === option.id}
            onChange={() => onChange(option.id)}
            className="mt-1 accent-primary"
          />
          <span>
            <span className="block text-sm font-medium">{option.name}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{option.description}</span>
          </span>
        </label>
      ))}
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-semibold">Aparência do workspace</legend>
        <div className="flex gap-4">
          {(
            [
              { id: "light", label: "Claro" },
              { id: "dark", label: "Escuro" },
            ] as const
          ).map((mode) => (
            <label key={mode.id} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="workspace-color-mode"
                value={mode.id}
                checked={colorMode === mode.id}
                onChange={() => onColorModeChange(mode.id)}
                className="accent-primary"
              />
              {mode.label}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Aplica a paleta clara ou escura já configurada no White Label após salvar.
        </p>
      </fieldset>
      <p className="text-xs text-muted-foreground">
        Confira a prévia e clique em Salvar alterações para aplicar. Descartar mantém a configuração
        salva.
      </p>
    </fieldset>
  );
}
