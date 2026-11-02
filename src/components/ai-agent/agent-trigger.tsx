import { lazy, Suspense, useEffect, useState } from "react";
import { registerDockOpener, setDockState } from "@/components/floating-dock/side-dock-store";
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

  useEffect(
    () =>
      registerDockOpener("agent", () => {
        setMounted(true);
        setOpen(true);
      }),
    [],
  );
  useEffect(() => {
    setDockState({ agentAvailable: !!user });
  }, [user]);

  if (!user) return null;

  return (
    <>
      {mounted ? (
        <Suspense fallback={null}>
          <AgentDrawer open={open} onOpenChange={setOpen} />
        </Suspense>
      ) : null}
    </>
  );
}
