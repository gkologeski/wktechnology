// Resolvedor de providers bancários. Por enquanto apenas Inter em modo mock.
import type { BankProvider } from "./types";
import { interMockProvider } from "./inter-mock";

export function resolveBankProvider(providerId: string, mode: string): BankProvider {
  if (providerId === "inter" && mode === "mock") return interMockProvider;
  throw new Error(
    `Provider '${providerId}' em modo '${mode}' ainda não está disponível. ` +
      `Somente 'inter' em modo 'mock' está habilitado nesta fase.`,
  );
}

export type { BankProvider } from "./types";
