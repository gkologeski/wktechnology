import { createContext, useContext } from "react";
import { PLATFORM_DEFAULT_PHONE_COUNTRY } from "./e164";

/**
 * País padrão para números NOVOS digitados sem +DDI. Vem do workspace
 * (`workspaces.default_phone_country`) via `PhoneCountryProvider`; fora dele
 * (telas públicas sem workspace carregado) vale o padrão da plataforma.
 */
export const PhoneCountryContext = createContext<string>(PLATFORM_DEFAULT_PHONE_COUNTRY);

export function useDefaultPhoneCountry(): string {
  return useContext(PhoneCountryContext);
}
