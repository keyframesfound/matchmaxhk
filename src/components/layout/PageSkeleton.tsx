import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shared route-transition fallback. It deliberately mirrors the application shell
 * without displaying a text-based loading message.
 */
export function PageSkeleton() {
  return (
    <main aria-busy="true" aria-label="Loading page" className="min-h-screen bg-background">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-8 w-32" />
          <div className="hidden items-center gap-5 md:flex">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-9 w-24" />
          </div>
          <Skeleton className="h-9 w-9 md:hidden" />
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="mt-5 h-11 max-w-2xl" />
        <Skeleton className="mt-4 h-5 max-w-3xl" />
        <Skeleton className="mt-2 h-5 w-4/5 max-w-2xl" />

        <section className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="rounded-3xl border border-border bg-card p-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <Skeleton className="mt-6 h-4 w-full" />
              <Skeleton className="mt-3 h-4 w-5/6" />
              <Skeleton className="mt-6 h-9 w-28" />
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
