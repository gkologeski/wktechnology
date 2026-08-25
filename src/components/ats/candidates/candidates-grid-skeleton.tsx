import { Skeletons } from "@/components/ats/ui";

export function CandidatesGridSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeletons.Card key={i} lines={3} />
      ))}
    </div>
  );
}
