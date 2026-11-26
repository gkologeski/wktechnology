// O que o importador lê do Jibble, por endpoint documentado em docs.api.jibble.io.
// Leitura integral: sem $filter de papel/status (inclui inativos e arquivados quando a API
// os devolve). Native records have no date filter: incorrect past/future dates are retained.
import type { JibbleService } from "./jibble-urls";

export type CollectSpec = {
  entity: string;
  service: Exclude<JibbleService, "identity">;
  path: string;
  query?: Record<string, string>;
  /** false = endpoint sem paginação OData documentada. */
  paged: boolean;
};

export const COLLECT_SPECS: CollectSpec[] = [
  { entity: "person", service: "workspace", path: "/v1/People", paged: true },
  { entity: "position", service: "workspace", path: "/v1/Positions", paged: true },
  { entity: "group", service: "workspace", path: "/v1/Groups", paged: true },
  { entity: "client", service: "workspace", path: "/v1/Clients", paged: true },
  {
    entity: "project",
    service: "workspace",
    path: "/v1/Projects",
    query: { $expand: "client($select=id,name),location($select=id,name)" },
    paged: true,
  },
  { entity: "activity", service: "workspace", path: "/v1/Activities", paged: true },
  { entity: "location", service: "workspace", path: "/v1/Locations", paged: true },
  { entity: "schedule", service: "workspace", path: "/v1/Schedules", paged: true },
  {
    entity: "pay_period_definition",
    service: "workspace",
    path: "/v1/PayPeriodDefinitions",
    paged: true,
  },
  { entity: "time_off_policy", service: "workspace", path: "/v1/TimeOffPolicies", paged: true },
  { entity: "calendar", service: "workspace", path: "/v1/Calendars", paged: true },
  { entity: "calendar_day", service: "workspace", path: "/v1/CalendarDays", paged: true },
  { entity: "pay_period", service: "timeAttendance", path: "/v1/PayPeriodSummary", paged: true },
  { entity: "time_off", service: "timeTracking", path: "/v1/TimeOffOverview", paged: false },
  {
    entity: "time_entry",
    service: "timeTracking",
    path: "/v1/TimeEntries",
    query: { $orderby: "time asc,id asc" },
    paged: true,
  },
  {
    entity: "hour_entry",
    service: "timeTracking",
    path: "/v1/HourEntries",
    query: { $orderby: "createdAt asc,id asc" },
    paged: true,
  },
  {
    entity: "screenshot",
    service: "timeTracking",
    path: "/v1/Screenshots",
    paged: true,
    query: {
      $select: "url,id,time,status",
      $expand: "person($select=id)",
      $orderby: "time asc,id asc",
    },
  },
];

export type WindowSpec = {
  entity: "time_entry" | "hour_entry" | "timesheet_day" | "screenshot";
  service: Exclude<JibbleService, "identity">;
  path: string;
  query: (from: string, to: string) => Record<string, string>;
  paged: boolean;
};

const lastDay = (to: string) =>
  new Date(Date.parse(`${to}T00:00:00Z`) - 86400_000).toISOString().slice(0, 10);

export const WINDOW_SPECS: WindowSpec[] = [
  {
    entity: "timesheet_day",
    service: "timeAttendance",
    path: "/v1/TimesheetsSummary",
    query: (from, to) => ({ period: "Custom", date: from, endDate: lastDay(to) }),
    paged: false,
  },
];

export const PAGE_SIZE = 500;

export const DRY_PHASES = [
  "start",
  "organization",
  "collect",
  "windows",
  "mappings",
  "intervals",
  "report",
  "done",
] as const;
export const IMPORT_PHASES = [
  "start",
  "projects_write",
  "intervals_write",
  "report",
  "done",
] as const;
export const ROLLBACK_PHASES = ["start", "rollback", "done"] as const;
