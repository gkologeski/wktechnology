import { createContext, useContext, type ReactNode } from "react";
import type { BarAction, RelatedKey } from "./timeline-shared";

export type ActivityWindowRequest = {
  action: BarAction;
  relatedKey?: RelatedKey;
  relatedId?: string;
  subject?: string;
  to?: string;
  threadId?: string;
};

export type WindowChrome = {
  id: string;
  title: string;
  position: number;
  minimized: boolean;
  expanded: boolean;
  onFocus: () => void;
  onMinimize: () => void;
  onExpand: () => void;
  onClose: () => void;
  setCloseBlocked?: (blocked: boolean) => void;
};

export const WindowChromeContext = createContext<WindowChrome | null>(null);
export const useWindowChrome = () => useContext(WindowChromeContext);

const ActivityWindowsContext = createContext<((request: ActivityWindowRequest) => void) | null>(
  null,
);
export function ActivityWindowsProvider({
  open,
  children,
}: {
  open: (request: ActivityWindowRequest) => void;
  children: ReactNode;
}) {
  return <ActivityWindowsContext.Provider value={open}>{children}</ActivityWindowsContext.Provider>;
}
export function useActivityWindows() {
  return useContext(ActivityWindowsContext);
}
