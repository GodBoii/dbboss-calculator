/** India has a fixed UTC+05:30 offset. Never use the device's local calendar. */
export const INDIA_TIMEZONE = "Asia/Kolkata"
const OFFSET_MS = 330 * 60 * 1000
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const shifted = (date: Date) => new Date(date.getTime() + OFFSET_MS)

export function indiaISODate(date = new Date()): string {
  return shifted(date).toISOString().slice(0, 10)
}
export function indiaDayIndex(date: Date): number { return shifted(date).getUTCDay() }
export function indiaWeekday(date: Date): string { return DAYS[indiaDayIndex(date)] }
export function indiaDayOfMonth(date: Date): number { return shifted(date).getUTCDate() }
export function indiaHour(date = new Date()): number { return shifted(date).getUTCHours() }
export function indiaNoon(iso: string): Date { return new Date(`${iso}T12:00:00+05:30`) }
