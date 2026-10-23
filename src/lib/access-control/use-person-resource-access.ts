import { useHrCapabilities } from "./use-hr-capabilities";
import { usePermissions } from "./use-permissions";
import type { HrRecordResource } from "./hr-capabilities.functions";

export type PersonChildResource =
  | "documents"
  | "benefits"
  | "allocations"
  | "goals"
  | "one_on_ones"
  | "reviews"
  | "assessments"
  | "incidents"
  | "events";
export const PERSON_CHILD_PERMISSION_RESOURCE: Record<PersonChildResource, string> = {
  documents: "techpeople.documents",
  benefits: "techpeople.benefits",
  allocations: "techpeople.allocations",
  goals: "techpeople.goals",
  one_on_ones: "techpeople.one_on_ones",
  reviews: "techpeople.reviews",
  assessments: "techpeople.wellbeing.assessments",
  incidents: "techpeople.incidents",
  events: "techpeople.events",
};

/** Creation is bound to the person; existing rows use their own actual relationship. */
export function usePersonResourceAccess(
  resource: PersonChildResource,
  personId: string,
  ids: string[],
) {
  const { workspaceId } = usePermissions();
  const parent = useHrCapabilities(`person_${resource}` as HrRecordResource, [personId]);
  const rows = useHrCapabilities(resource, ids);
  return {
    workspaceId,
    canCreate: parent.for(personId).can_create_child,
    canUpdate: (id: string) => rows.for(id).can_update,
    canDelete: (id: string) => rows.for(id).can_delete,
    isError: parent.isError || rows.isError,
    refetch: () => {
      void parent.refetch();
      void rows.refetch();
    },
  };
}
