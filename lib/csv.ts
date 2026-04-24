export function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function toCSVRow(values: unknown[]): string {
  return values.map(escapeCSV).join(',')
}

export function toCSV(headers: string[], rows: unknown[][]): string {
  return [headers.join(','), ...rows.map(toCSVRow)].join('\n')
}
