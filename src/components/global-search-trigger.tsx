// Input no header que abre o GlobalSearch (atalho ⌘K).
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

function openSearch() {
  window.dispatchEvent(new CustomEvent("global-search:open"));
}

export function GlobalSearchTrigger() {
  return (
    <>
      <button
        type="button"
        onClick={openCopilot}
        aria-label="Buscar ou perguntar"
        className="hidden md:flex items-center gap-2 h-9 w-[360px] max-w-[40vw] px-3 rounded-md border bg-muted/40 hover:bg-muted text-sm text-muted-foreground transition-colors"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">Buscar ou perguntar</span>
        <kbd className="hidden sm:inline-flex items-center gap-1 rounded border bg-background px-1.5 text-[10px] font-mono text-muted-foreground">
          ⌘K
        </kbd>
      </button>
      <Button
        variant="ghost"
        size="icon"
        onClick={openCopilot}
        aria-label="Buscar"
        className="md:hidden"
      >
        <Search className="h-4 w-4" />
      </Button>
    </>
  );
}
