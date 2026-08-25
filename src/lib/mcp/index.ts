import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchCompaniesTool from "./tools/search-companies";
import listDealsTool from "./tools/list-deals";
import searchLeadsTool from "./tools/search-leads";
import createLeadTool from "./tools/create-lead";
import whoamiTool from "./tools/whoami";

// O issuer OAuth precisa ser o host direto do backend. O project ref é o único
// valor que sobrevive ao publish sem reescrita, então é ele que monta a URL.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "techerp",
  title: "TechERP",
  version: "0.1.0",
  instructions:
    "Ferramentas do TechERP (CRM/ATS). Use `whoami` para confirmar o usuário e o workspace ativo, " +
    "`search_companies`, `search_leads` e `list_deals` para consultar o CRM, e `create_lead` para " +
    "registrar um novo lead. Todas as ações respeitam as permissões do usuário conectado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, searchCompaniesTool, searchLeadsTool, listDealsTool, createLeadTool],
});
