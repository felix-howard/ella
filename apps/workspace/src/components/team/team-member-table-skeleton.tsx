/**
 * Skeleton loader for the team member table
 */
export function TeamMemberTableSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            {[1, 2, 3, 4, 5].map((i) => (
              <th key={i} className="px-4 py-3"><div className="h-4 w-20 bg-muted rounded animate-pulse" /></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 4 }).map((_, i) => (
            <tr key={i} className="border-b border-border">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-muted animate-pulse" />
                  <div className="h-4 w-28 bg-muted rounded animate-pulse" />
                </div>
              </td>
              <td className="px-4 py-3 hidden md:table-cell"><div className="h-4 w-36 bg-muted rounded animate-pulse" /></td>
              <td className="px-4 py-3"><div className="h-5 w-16 bg-muted rounded-full animate-pulse" /></td>
              <td className="px-4 py-3"><div className="h-4 w-8 bg-muted rounded animate-pulse" /></td>
              <td className="px-4 py-3"><div className="h-4 w-4 bg-muted rounded animate-pulse" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
