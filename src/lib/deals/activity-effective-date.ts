export type DashboardActivityDate = {
  type: string;
  due_date: string | null;
  activity_date: string | null;
  created_at: string | null;
};

export function activityEffectiveDate(activity: DashboardActivityDate): string | null {
  if (activity.type === "task") {
    return activity.due_date ?? activity.activity_date ?? activity.created_at;
  }
  return activity.activity_date ?? activity.created_at;
}