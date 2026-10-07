import { useDemo } from "./state";
import { FlowCanvas } from "./flow";
import { Knowledge } from "./agent-configuration";
import { TestChat } from "./test-and-launch";
import { Launch } from "./test-and-launch";
import { Metrics } from "./metrics";

export function StudioArea({ layout }: { layout: "studio" | "tray" | "bottom" }) {
  const { area } = useDemo();
  if (area === "Fluxo")
    return (
      <div className="ap-workspace">
        <FlowCanvas layout={layout} />
      </div>
    );
  return (
    <section className="mx-auto max-w-4xl p-6 lg:p-10">
      {area === "Testar" ? (
        <TestChat />
      ) : area === "Métricas" ? (
        <Metrics />
      ) : area === "Conhecimento" ? (
        <Knowledge />
      ) : (
        <Launch />
      )}
    </section>
  );
}
