export type SearchCreateEntity =
  | "company"
  | "contact"
  | "project"
  | "contract"
  | "commercial_contract";
export const searchCreateResources: Record<SearchCreateEntity, string> = {
  company: "techsales.companies",
  contact: "techsales.contacts",
  project: "techprojects.projects",
  contract: "techcontracts.contracts",
  commercial_contract: "techcontracts.contracts",
};
