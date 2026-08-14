import { useState } from "react";
import { Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BugReportDialog } from "./bug-report-dialog";

export function BugReportButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="fixed bottom-5 right-5 z-50">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                onClick={() => setOpen(true)}
                aria-label="Abrir chamado"
                className="h-12 w-12 rounded-full shadow-lg opacity-10 transition-opacity duration-200 hover:opacity-100 focus-visible:opacity-100"
              >
                <Bug className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Abrir chamado</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <BugReportDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
