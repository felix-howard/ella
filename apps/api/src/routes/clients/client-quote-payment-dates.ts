export function latestDate(values: Array<Date | null | undefined>): Date {
  return values.reduce<Date | null>((latest, value) => {
    if (!value) return latest
    return !latest || value > latest ? value : latest
  }, null) ?? new Date(0)
}

export function businessDaysSince(start: Date, end: Date): number {
  if (start >= end) return 0
  let count = 0
  const cursor = new Date(start)
  cursor.setDate(cursor.getDate() + 1)
  cursor.setHours(0, 0, 0, 0)
  while (cursor <= end) {
    const day = cursor.getDay()
    if (day !== 0 && day !== 6) count += 1
    cursor.setDate(cursor.getDate() + 1)
  }
  return count
}
