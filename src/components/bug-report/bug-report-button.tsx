import { useEffect, useState } from "react";
import { registerDockOpener } from "@/components/floating-dock/side-dock-store";
import { BugReportDialog } from "./bug-report-dialog";

// O botão fica na aba lateral (SideDock); aqui só a janela do chamado.
export function BugReportButton() {
  const [open, setOpen] = useState(false);
  useEffect(() => registerDockOpener("bug", () => setOpen(true)), []);
  return <BugReportDialog open={open} onOpenChange={setOpen} />;
}
