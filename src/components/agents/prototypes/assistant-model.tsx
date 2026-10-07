import { Save, ArrowLeft, Plus, Bot, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DemoProvider, useDemo } from "./state";
import {
  PrototypeFrame,
  Topbar,
  Navigation,
  StudioTabs,
  StepRail,
  WizardContent,
  WizardFooter,
  Preview,
  AgentLibrary,
  CustomerRecord,
  StudioArea,
} from "./shared";
function AssistantLayout() {
  const { agent, view, go, save, step } = useDemo();
  return (
    <PrototypeFrame number={2} title="02 · Assistente de criação">
      <Navigation />
      {view === "wizard" ? (
        <>
          <div className="grid gap-3 border-b border-border-subtle px-6 py-5 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <p className="mb-2 text-[10px] uppercase text-muted-foreground">
                Agentes / Novo rascunho
              </p>
              <h1 className="text-lg font-semibold">Dê forma ao seu próximo agente</h1>
            </div>
            <Button variant="ghost" size="sm" onClick={save}>
              <Save />
              Salvar rascunho
            </Button>
          </div>
          <div className="ap-wizard">
            <StepRail />
            <WizardContent />
            <Preview />
          </div>
          <WizardFooter />
        </>
      ) : view === "list" ? (
        <AgentLibrary />
      ) : view === "studio" ? (
        <>
          <Topbar title={agent.name} subtitle="Construção guiada / Estúdio">
            <Button variant="outline" size="sm" onClick={() => go("wizard")}>
              <ArrowLeft />
              Configuração
            </Button>
            <Button size="sm" onClick={save}>
              <Save />
              Salvar
            </Button>
          </Topbar>
          <StudioTabs />
          <StudioArea layout="tray" />
        </>
      ) : (
        <CustomerRecord />
      )}
    </PrototypeFrame>
  );
}
export function AssistantModel() {
  return (
    <DemoProvider number={2} initial="wizard">
      <AssistantLayout />
    </DemoProvider>
  );
}
