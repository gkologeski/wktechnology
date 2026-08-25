import type {
  getAtsJob,
  listAtsCandidates,
  listJobApplications,
  listJobEvents,
  listJobInterviews,
} from "@/lib/ats/ats.functions";

export type App = Awaited<ReturnType<typeof listJobApplications>>[number];
export type Job = Awaited<ReturnType<typeof getAtsJob>>;
export type Candidate = Awaited<ReturnType<typeof listAtsCandidates>>[number];
export type JobEvent = Awaited<ReturnType<typeof listJobEvents>>[number];
export type JobInterview = Awaited<ReturnType<typeof listJobInterviews>>[number];
