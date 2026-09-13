import { ListSkeleton } from "@/components/ui/skeleton";

export default function AppLoading() {
  return (
    <div className="space-y-6">
      <div className="h-7 w-48 animate-pulse rounded bg-secondary" />
      <ListSkeleton rows={4} />
    </div>
  );
}
