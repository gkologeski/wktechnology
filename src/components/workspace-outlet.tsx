import { Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { onWorkspaceChanged } from "@/lib/workspace-events";

// Clear route-local form/list state as well as query caches when switching tenants.
// Global conversation/activity draft hosts stay outside this boundary.
export function WorkspaceOutlet() {
  const [revision, setRevision] = useState(0);
  useEffect(() => onWorkspaceChanged(() => setRevision((value) => value + 1)), []);
  return <Outlet key={revision} />;
}
