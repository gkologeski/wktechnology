// Comando "Expandir tudo / Recolher tudo" da timeline. `version` muda a cada
// comando para que cada cartão aplique o estado mesmo após ajustes manuais.
import { createContext, useContext } from "react";

export type TimelineExpandState = { expanded: boolean; version: number };

export const TimelineExpandContext = createContext<TimelineExpandState>({
  expanded: false,
  version: 0,
});

export function useTimelineExpand() {
  return useContext(TimelineExpandContext);
}
