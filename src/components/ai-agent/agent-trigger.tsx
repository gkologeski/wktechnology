import { lazy, Suspense, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";

// Carrega o drawer (AI SDK + react-markdown) somente quando o usuário abre o
// assistente. Sem isso, essas dependências entram no bundle de todas as telas,
// já que o gatilho é renderizado no layout raiz.
const AgentDrawer = lazy(() =>
  import("@/components/ai-agent/agent-drawer").then((m) => ({ default: m.AgentDrawer })),
);

export function AgentTrigger() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Atalho Cmd+K / Ctrl+K também abre o assistente
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setMounted(true);
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!user) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
        onPointerEnter={() => setMounted(true)}
        aria-label="Abrir assistente do CRM"
        className="fixed bottom-5 right-[8.75rem] z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg opacity-10 transition-opacity duration-200 hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        <Sparkles className="h-5 w-5" />
      </button>
      {mounted ? (
        <Suspense fallback={null}>
          <AgentDrawer open={open} onOpenChange={setOpen} />
        </Suspense>
      ) : null}
    </>
  );
}
