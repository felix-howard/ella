import { useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, X } from 'lucide-react'
import { cn } from '@ella/ui'

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'))
const MINUTES = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, '0'))
const iconButtonClass = 'grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none'
const timeSelectClass = 'h-10 rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'

function pad(value: number): string { return String(value).padStart(2, '0') }

function toLocalValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function parseLocalValue(value: string): Date | null {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date : null
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function startOfMonth(date: Date): Date { return new Date(date.getFullYear(), date.getMonth(), 1) }

function addMonths(date: Date, amount: number): Date { return new Date(date.getFullYear(), date.getMonth() + amount, 1) }

function getCalendarDays(month: Date): Date[] {
  const first = startOfMonth(month)
  const mondayOffset = (first.getDay() + 6) % 7
  const start = new Date(first)
  start.setDate(first.getDate() - mondayOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    return day
  })
}

function getWeekdayLabels(locale: string): string[] {
  const monday = new Date(2026, 0, 5)
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday)
    day.setDate(monday.getDate() + index)
    return new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(day)
  })
}

type DepositPaidAtPickerProps = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  locale: string
  dateLabel: string
  timeLabel: string
  placeholder: string
  nowLabel: string
  clearLabel: string
}

export function DepositPaidAtPicker({
  value,
  onChange,
  disabled = false,
  locale,
  dateLabel,
  timeLabel,
  placeholder,
  nowLabel,
  clearLabel,
}: DepositPaidAtPickerProps) {
  const selected = parseLocalValue(value)
  const displayDate = selected ?? new Date()
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(displayDate))
  const days = getCalendarDays(visibleMonth)
  const today = new Date()
  const hour = pad(displayDate.getHours())
  const minute = pad(displayDate.getMinutes())
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(visibleMonth)
  const readableValue = selected ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(selected) : placeholder

  const commit = (next: Date) => {
    if (disabled) return
    setVisibleMonth(startOfMonth(next))
    onChange(toLocalValue(next))
  }

  const updateTime = (nextHour: string, nextMinute: string) => {
    const next = new Date(displayDate)
    next.setHours(Number(nextHour), Number(nextMinute), 0, 0)
    commit(next)
  }

  return (
    <div className={cn('rounded-xl border border-border bg-card shadow-sm', disabled && 'opacity-60')}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            {dateLabel}
          </div>
          <div className={cn('mt-0.5 truncate text-sm font-medium', !selected && 'text-muted-foreground')}>
            {readableValue}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => commit(new Date())}
            disabled={disabled}
            className="rounded-full px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary-light disabled:pointer-events-none"
          >
            {nowLabel}
          </button>
          <button type="button" onClick={() => onChange('')} disabled={disabled || !value}
            className={cn(iconButtonClass, 'disabled:opacity-40')} aria-label={clearLabel} title={clearLabel}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="grid gap-4 p-3 sm:grid-cols-[1fr_160px]">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => setVisibleMonth((current) => addMonths(current, -1))}
              disabled={disabled} className={iconButtonClass} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="text-sm font-semibold capitalize text-foreground">{monthLabel}</div>
            <button type="button" onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
              disabled={disabled} className={iconButtonClass} aria-label="Next month">
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
            {getWeekdayLabels(locale).map((label, index) => <div key={`${label}-${index}`}>{label}</div>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {days.map((day) => {
              const active = selected ? sameDay(day, selected) : false
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => {
                    const next = new Date(day)
                    next.setHours(displayDate.getHours(), displayDate.getMinutes(), 0, 0)
                    commit(next)
                  }}
                  disabled={disabled}
                  className={cn(
                    'grid h-8 place-items-center rounded-full text-sm transition-colors disabled:pointer-events-none',
                    day.getMonth() !== visibleMonth.getMonth() ? 'text-muted-foreground/55' : 'text-foreground',
                    sameDay(day, today) && 'ring-1 ring-primary/30',
                    active && 'bg-primary text-primary-foreground shadow-sm hover:bg-primary-dark',
                    !active && 'hover:bg-muted',
                  )}
                >
                  {day.getDate()}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Clock3 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            {timeLabel}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={hour} onChange={(event) => updateTime(event.target.value, minute)}
              disabled={disabled} className={timeSelectClass} aria-label={`${timeLabel} hour`}>
              {HOURS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <select value={minute} onChange={(event) => updateTime(hour, event.target.value)}
              disabled={disabled} className={timeSelectClass} aria-label={`${timeLabel} minute`}>
              {MINUTES.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}
