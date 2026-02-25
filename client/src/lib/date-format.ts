const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatDateForProject(isoDate: string, dateFormat: string): string {
  if (!isoDate) return "";
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  const [yyyy, mm, dd] = parts;
  const monthIdx = parseInt(mm, 10) - 1;
  const day = parseInt(dd, 10).toString();
  const dayPadded = dd;

  switch (dateFormat) {
    case "MM/DD/YYYY":
      return `${mm}/${dayPadded}/${yyyy}`;
    case "DD/MM/YYYY":
      return `${dayPadded}/${mm}/${yyyy}`;
    case "YYYY-MM-DD":
      return isoDate;
    case "Month DD, YYYY":
      return `${MONTH_NAMES[monthIdx]} ${day}, ${yyyy}`;
    default:
      return isoDate;
  }
}

export function parseDateToISO(dateStr: string, dateFormat: string): string {
  if (!dateStr) return "";
  const s = dateStr.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  switch (dateFormat) {
    case "MM/DD/YYYY": {
      const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
      break;
    }
    case "DD/MM/YYYY": {
      const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      break;
    }
    case "Month DD, YYYY": {
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
      }
      break;
    }
  }
  return s;
}

export function getDatePlaceholder(dateFormat: string): string {
  switch (dateFormat) {
    case "MM/DD/YYYY": return "MM/DD/YYYY";
    case "DD/MM/YYYY": return "DD/MM/YYYY";
    case "YYYY-MM-DD": return "YYYY-MM-DD";
    case "Month DD, YYYY": return "Month DD, YYYY";
    default: return "Select a date";
  }
}
