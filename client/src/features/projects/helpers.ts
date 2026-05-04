export function getWeekEnding(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function getPreviousWeekEnding(weekEnding: string): string {
  const d = new Date(weekEnding + "T00:00:00");
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

export function safeParseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  let d = new Date(dateStr + "T00:00:00");
  if (!isNaN(d.getTime())) return d;
  d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  const parts = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (parts) {
    d = new Date(`${parts[3]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}T00:00:00`);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}
