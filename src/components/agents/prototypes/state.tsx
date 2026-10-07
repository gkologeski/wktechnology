import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import { makeAgents, type Agent } from "./model";
type State = {
  agents: Agent[];
  agent: Agent;
  selected: string;
  select: (id: string) => void;
  patch: (change: Partial<Agent>) => void;
  save: () => void;
  duplicate: (id: string) => void;
  archive: (id: string) => void;
  create: () => void;
  view: string;
  go: (view: string) => void;
  step: number;
  setStep: (n: number) => void;
  area: string;
  setArea: (v: string) => void;
};
const Context = createContext<State | null>(null);
export function DemoProvider({
  children,
  initial,
  number,
}: {
  children: ReactNode;
  initial: string;
  number: number;
}) {
  const [agents, setAgents] = useState(makeAgents);
  const [selected, select] = useState("sales");
  const [view, go] = useState(initial);
  const [step, setStep] = useState(0);
  const [area, setArea] = useState("Fluxo");
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`agents-prototype-${number}`);
      if (!raw) return;
      const saved = JSON.parse(raw) as Agent[];
      if (
        Array.isArray(saved) &&
        saved.length &&
        saved.every(
          (a) =>
            typeof a.id === "string" &&
            typeof a.name === "string" &&
            Array.isArray(a.nodes) &&
            Array.isArray(a.sources),
        )
      )
        setAgents(saved);
    } catch {
      /* An invalid local draft never prevents opening the prototype. */
    }
  }, [number]);
  const agent = agents.find((a) => a.id === selected) ?? agents[0];
  if (!agent) return null;
  const patch = (change: Partial<Agent>) =>
    setAgents((all) => all.map((a) => (a.id === selected ? { ...a, ...change } : a)));
  const save = () => {
    try {
      localStorage.setItem(`agents-prototype-${number}`, JSON.stringify(agents));
      toast.success("Salvo neste protótipo");
    } catch {
      toast.error("Não foi possível salvar neste navegador.");
    }
  };
  const duplicate = (id: string) => {
    const item = agents.find((a) => a.id === id);
    if (!item) return;
    const copy = {
      ...structuredClone(item),
      id: crypto.randomUUID(),
      name: `${item.name} · cópia`,
      channel: "Nenhum canal",
    };
    setAgents((all) => [...all, copy]);
    select(copy.id);
    toast.success("Cópia criada somente neste protótipo");
  };
  const archive = (id: string) => {
    setAgents((all) => all.map((a) => (a.id === id ? { ...a, archived: !a.archived } : a)));
    toast.success("Status alterado somente neste protótipo");
  };
  const create = () => {
    const seed = makeAgents()[1];
    if (!seed) return;
    const a = {
      ...seed,
      id: crypto.randomUUID(),
      name: "Novo agente",
      purpose: "",
      channel: "Nenhum canal",
    };
    setAgents((all) => [...all, a]);
    select(a.id);
    setStep(0);
    go("wizard");
  };
  return (
    <Context.Provider
      value={{
        agents,
        agent,
        selected,
        select,
        patch,
        save,
        duplicate,
        archive,
        create,
        view,
        go,
        step,
        setStep,
        area,
        setArea,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useDemo() {
  const value = useContext(Context);
  if (!value) throw new Error("Protótipo sem contexto");
  return value;
}
