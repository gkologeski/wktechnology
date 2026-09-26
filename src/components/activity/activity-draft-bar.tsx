import { Button } from "@/components/ui/button";

export function DraftBar({
  savedAt,
  onDiscard,
}: {
  savedAt: string | null;
  onDiscard: () => void;
}) {
  if (!savedAt) return null;
  const time = new Date(savedAt).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div className="flex items-center justify-between gap-2 border-b border-product-divider bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
      <span aria-live="polite">Rascunho salvo às {time}</span>
      <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={onDiscard}>
        Descartar rascunho
      </Button>
    </div>
  );
}
