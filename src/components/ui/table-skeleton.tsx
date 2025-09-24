import { Skeleton } from "@/components/ui/skeleton";

export function TableSkeleton({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid grid-cols-12 gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="col-span-2">
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
