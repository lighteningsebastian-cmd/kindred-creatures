import { Skeleton } from "@/components/ui/Skeleton";

/** The order list, mid-flight. Same shape as the real thing, so it does not jump. */
export default function AdminOrdersLoading() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 md:px-6">
      <Skeleton className="h-8 w-40 rounded-sm" />

      <div className="mt-6 rounded-md border border-line">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="border-b border-line p-4 last:border-b-0">
            <Skeleton className="h-10 w-full rounded-sm" />
          </div>
        ))}
      </div>

      <p className="sr-only" role="status">
        Loading orders
      </p>
    </div>
  );
}
