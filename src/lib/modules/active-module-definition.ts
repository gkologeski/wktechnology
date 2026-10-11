import { MODULES } from "./registry";
import { useActiveModule } from "./active-module";

export function useActiveModuleDefinition() {
  return MODULES[useActiveModule()];
}
