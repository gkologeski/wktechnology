import { ArrowLeft, Save, Play, Bot, ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
function StudioLayout() {
  const { agent, agents, select, view, go, save, setArea } = useDemo();
  return (
    <PrototypeFrame number={1} title="01 · Estúdio">
      <Navigation />
      {view === "studio" ? (
        <>
          <Topbar title={agent.name} subtitle="Estúdio de agentes / Fluxo de atendimento">
            <div className="hidden xl:block">
              <Select value={agent.id} onValueChange={select}>
                <SelectTrigger aria-label="Selecionar agente" className="w-44 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" variant="outline" onClick={() => setArea("Testar")}>
              <Play />
              Testar
            </Button>
            <Button size="sm" onClick={save}>
              <Save />
              <span className="hidden sm:inline">Salvar fluxo</span>
            </Button>
          </Topbar>
          <div className="flex items-center justify-between bg-product-toolbar px-6 py-2 text-[10px]">
            <span className="text-muted-foreground">v4 · Rascunho independente</span>
            <span className="flex items-center gap-1.5 text-success">
              <span className="size-1.5 rounded-full bg-current" />5 conexões · configuração local
            </span>
          </div>
          <StudioTabs />
          <StudioArea layout="studio" />
        </>
      ) : view === "wizard" ? (
        <>
          <Topbar title="Construir agente" subtitle="Rascunho · configuração independente">
            <Button size="sm" variant="outline" onClick={save}>
              <Save />
              Salvar
            </Button>
          </Topbar>
          <div className="ap-wizard">
            <StepRail />
            <WizardContent />
            <Preview />
          </div>
          <WizardFooter />
        </>
      ) : view === "list" ? (
        <AgentLibrary />
      ) : (
        <CustomerRecord />
      )}
    </PrototypeFrame>
  );
}
export function StudioModel() {
  return (
    <DemoProvider number={1} initial="studio">
      <StudioLayout />
    </DemoProvider>
  );
}
