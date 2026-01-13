/**
 * Today Summary Component - Dashboard header with greeting and date
 * Displays personalized greeting and current date in Vietnamese
 */

import { Calendar } from 'lucide-react'
import { UI_TEXT } from '../../lib/constants'

interface TodaySummaryProps {
  staffName?: string
}

export function TodaySummary({ staffName }: TodaySummaryProps) {
  const { dashboard, staff } = UI_TEXT
  const displayName = staffName || staff.defaultName

  // Format current date in Vietnamese
  const today = new Date()
  const dateStr = today.toLocaleDateString('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="mb-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {dashboard.greeting},{' '}
            <span className="text-accent">{displayName}</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            {dashboard.greetingSubtext}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
          <Calendar className="w-4 h-4" />
          <span className="text-sm capitalize">{dateStr}</span>
        </div>
      </div>
    </div>
  )
}
