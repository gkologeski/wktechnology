// Server-only helper: reads the current request origin.
// Kept in a `.server.ts` module so `@tanstack/react-start/server` never appears
// in a client-reachable import graph (import-protection).
import { getRequest } from "@tanstack/react-start/server";

export function getRequestOrigin(): string {
  try {
    const req = getRequest();
    return req ? new URL(req.url).origin : "";
  } catch {
    return "";
  }
}
