/**
 * Lead List Table Skeleton - Loading placeholder for lead table
 */
export function LeadListTableSkeleton() {
  return (
    <div className="bg-card rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/50">
              <th className="px-4 py-3 w-10">
                <div className="h-4 w-4 bg-muted rounded animate-pulse" />
              </th>
              <th className="text-left px-4 py-3">
                <div className="h-4 w-20 bg-muted rounded animate-pulse" />
              </th>
              <th className="text-left px-4 py-3">
                <div className="h-4 w-16 bg-muted rounded animate-pulse" />
              </th>
              <th className="text-left px-4 py-3">
                <div className="h-4 w-14 bg-muted rounded animate-pulse" />
              </th>
              <th className="text-left px-4 py-3 hidden sm:table-cell">
                <div className="h-4 w-14 bg-muted rounded animate-pulse" />
              </th>
              <th className="text-left px-4 py-3 hidden md:table-cell">
                <div className="h-4 w-16 bg-muted rounded animate-pulse" />
              </th>
              <th className="text-left px-4 py-3 hidden lg:table-cell">
                <div className="h-4 w-14 bg-muted rounded animate-pulse" />
              </th>
              <th className="text-left px-4 py-3">
                <div className="h-4 w-14 bg-muted rounded animate-pulse" />
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-border/40">
                <td className="px-4 py-3 w-10">
                  <div className="h-4 w-4 bg-muted rounded animate-pulse" />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-muted animate-pulse" />
                    <div>
                      <div className="h-4 w-28 bg-muted rounded animate-pulse" />
                      <div className="h-3 w-36 bg-muted rounded animate-pulse mt-1.5" />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-5 w-16 bg-muted rounded-full animate-pulse" />
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <div className="h-4 w-14 bg-muted rounded animate-pulse" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-8 w-16 bg-muted rounded-lg animate-pulse" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
