// Botão de exportação com escolha de formato (CSV, JSON, XLSX).
// Usado na barra flutuante de ações em massa e nas toolbars de lista.
import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EXPORT_FORMAT_LABEL, type ExportFormat } from "@/lib/export/export-rows";

const FORMATS: ExportFormat[] = ["csv", "json", "xlsx"];

export function ExportMenuButton({
  onExport,
  label = "Exportar",
  disabled,
  variant = "outline",
  size = "sm",
  className,
}: {
  onExport: (format: ExportFormat) => void | Promise<void>;
  label?: string;
  disabled?: boolean;
  variant?: "outline" | "ghost" | "secondary" | "default";
  size?: "sm" | "default";
  className?: string;
}) {
  const [busy, setBusy] = useState(false);

  const run = async (format: ExportFormat) => {
    setBusy(true);
    try {
      await onExport(format);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao exportar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={disabled || busy} className={className}>
          <Download className="mr-1.5 h-4 w-4" aria-hidden />
          {busy ? "Exportando…" : label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {FORMATS.map((f) => (
          <DropdownMenuItem key={f} onSelect={() => void run(f)}>
            {EXPORT_FORMAT_LABEL[f]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
