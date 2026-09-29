// Resolvedor de providers bancários. Por enquanto apenas Inter em modo mock.
import type { BankProvider } from "./types";
import { interMockProvider } from "./inter-mock";
import { internalMocksEnabled } from "@/lib/runtime-config.server";

export function resolveBankProvider(providerId: string, mode: string): BankProvider {
  if (providerId === "inter" && mode === "mock") {
    if (!internalMocksEnabled()) {
      throw new Error("A simulação bancária está desativada neste ambiente.");
    }
    return interMockProvider;
  }
  throw new Error(
    `Provider '${providerId}' em modo '${mode}' ainda não está disponível. ` +
      `Somente 'inter' em modo 'mock' está habilitado nesta fase.`,
  );
}

export type { BankProvider } from "./types";
