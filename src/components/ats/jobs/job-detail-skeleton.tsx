import { Skeletons } from "@/components/ats/ui";

export function JobDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-3">
        <div className="h-4 w-32 rounded-md bg-surface-sunken animate-pulse" />
        <div className="h-7 w-72 rounded-md bg-surface-sunken animate-pulse" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
        <Skeletons.Card lines={6} />
        <Skeletons.Card lines={10} />
        <Skeletons.Card lines={6} />
      </div>
    </div>
  );
}
