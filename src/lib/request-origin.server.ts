// Server-only helper: reads data from the current request.
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

export function getRequestAuthorization(): string {
  try {
    return getRequest()?.headers.get("authorization") ?? "";
  } catch {
    return "";
  }
}
