type Preset = { name: string; primary: string; accent: string };

const PRESETS: Preset[] = [
  { name: "Indigo", primary: "#4f46e5", accent: "#22d3ee" },
  { name: "Emerald", primary: "#059669", accent: "#10b981" },
  { name: "Slate", primary: "#0f172a", accent: "#3b82f6" },
  { name: "Rose", primary: "#e11d48", accent: "#f43f5e" },
  { name: "Amber", primary: "#d97706", accent: "#f59e0b" },
  { name: "Violet", primary: "#7c3aed", accent: "#a78bfa" },
  { name: "Teal", primary: "#0d9488", accent: "#14b8a6" },
  { name: "Crimson", primary: "#c21d1d", accent: "#2563eb" },
];

type Props = {
  activePrimary?: string;
  onPick: (primary: string, accent: string) => void;
};

export function PalettePresets({ activePrimary, onPick }: Props) {
  return (
    <div>
      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
        Paletas sugeridas
      </div>
      <div className="grid grid-cols-4 gap-2">
        {PRESETS.map((p) => {
          const isActive = activePrimary?.toLowerCase() === p.primary.toLowerCase();
          return (
            <button
              key={p.name}
              type="button"
              title={p.name}
              onClick={() => onPick(p.primary, p.accent)}
              className={`group h-9 rounded-md border overflow-hidden flex transition-all hover:scale-105 ${
                isActive ? "ring-2 ring-offset-2 ring-primary border-primary" : "border-border"
              }`}
            >
              <span className="flex-1" style={{ background: p.primary }} />
              <span className="flex-1" style={{ background: p.accent }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
