export type TimeBucket = "morning" | "midday" | "evening" | "late_night"

export function getTimeBucket(date: Date): TimeBucket {
  const hour = date.getHours()

  if (hour >= 7 && hour < 12) return "morning"
  if (hour >= 12 && hour < 17) return "midday"
  if (hour >= 17 && hour < 22) return "evening"
  return "late_night"
}

export function parseTimeOverride(timeStr: string): Date {
  const [hours, minutes] = timeStr.split(":").map(Number)
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return date
}

export function getChicagoTime(): Date {
  const now = new Date()
  return new Date(now.toLocaleString("en-US", { timeZone: "America/Chicago" }))
}
