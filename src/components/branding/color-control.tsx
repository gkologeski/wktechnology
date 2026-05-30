import { useEffect, useState } from "react";
import { anyToHex } from "@/lib/color-utils";

type Props = {
  label: string;
  value: string;
  onChange: (hex: string) => void;
};

export function ColorControl({ label, value, onChange }: Props) {
  const [text, setText] = useState(() => anyToHex(value));

  useEffect(() => {
    setText(anyToHex(value));
  }, [value]);

  const commit = (raw: string) => {
    const hex = anyToHex(raw);
    setText(hex);
    onChange(hex);
  };

  return (
    <div className="space-y-2">
      <label className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-foreground uppercase tracking-wide">{label}</span>
        <span className="text-[10px] font-mono text-muted-foreground">{text.toUpperCase()}</span>
      </label>
      <div className="flex items-center gap-2">
        <label className="relative h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-border shadow-sm overflow-hidden">
          <span className="absolute inset-0" style={{ background: text }} />
          <input
            type="color"
            value={text}
            onChange={(e) => commit(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-xs font-mono"
          placeholder="#000000"
        />
      </div>
    </div>
  );
}
