export type MetaTemplateAction = "view" | "create" | "update" | "delete";
export type MetaTemplateTarget = {
  id: string;
  provider: "cloud" | "lovable";
  label: string;
  wabaId: string | null;
  enabled: boolean;
  numbers: { id: string; phone: string; label: string }[];
};
export type MetaTemplateContext = {
  actor: string;
  workspace: string;
  readOnly: boolean;
  capabilities: Record<MetaTemplateAction, boolean>;
  targets: MetaTemplateTarget[];
};
export type MetaTemplateButton = {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
  text: string;
  url?: string;
  phoneNumber?: string;
  example?: string;
};
export type MetaTemplateDraft = {
  name: string;
  language: string;
  category: "UTILITY" | "MARKETING" | "AUTHENTICATION";
  parameterFormat: "POSITIONAL" | "NAMED";
  headerFormat: "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  headerText: string;
  headerExample: string;
  headerHandle: string;
  body: string;
  bodyExamples: Record<string, string>;
  footer: string;
  buttons: MetaTemplateButton[];
  authentication: {
    securityRecommendation: boolean;
    expiresMinutes: number | null;
    buttonText: string;
  };
};
export type MetaTemplateJson =
  | null
  | boolean
  | number
  | string
  | MetaTemplateJson[]
  | { [key: string]: MetaTemplateJson };
export type MetaTemplate = {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  parameterFormat: string;
  components: Record<string, MetaTemplateJson>[];
  rejectionReason: string | null;
  fingerprint: string;
  editable: boolean;
  editReason: string | null;
  draft: MetaTemplateDraft | null;
};
export type MetaTemplateCatalogue = {
  target: MetaTemplateTarget;
  capabilities: Record<MetaTemplateAction, boolean>;
  items: MetaTemplate[];
  nextCursor: string | null;
  fetchedAt: string;
  providerNote: string | null;
};
export type MetaTemplateMutationResult = {
  success: true;
  id: string | null;
  status: string;
  message: string;
};
export type MetaTemplateDeletionPreview = {
  scope: "variant" | "all_languages";
  name: string;
  language: string;
  languages: string[];
  variantIds: string[];
};
export const META_TEMPLATE_EDITABLE_STATUSES = ["APPROVED", "REJECTED", "PAUSED"] as const;
export const META_TEMPLATE_RESOURCE = "system.whatsapp_templates";
export const META_TEMPLATE_ROUTE = "/settings/whatsapp-templates";
export function emptyMetaTemplateDraft(): MetaTemplateDraft {
  return {
    name: "",
    language: "pt_BR",
    category: "UTILITY",
    parameterFormat: "POSITIONAL",
    headerFormat: "NONE",
    headerText: "",
    headerExample: "",
    headerHandle: "",
    body: "",
    bodyExamples: {},
    footer: "",
    buttons: [],
    authentication: {
      securityRecommendation: true,
      expiresMinutes: 10,
      buttonText: "Copiar código",
    },
  };
}
