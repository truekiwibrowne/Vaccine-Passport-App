/**
 * CSV import / export utilities for the Clinics admin panel.
 *
 * Export: Clinic[] → .csv download (id column included so rows can be
 *         re-uploaded as updates).
 *
 * Import: .csv text → parsed rows categorised as:
 *   - valid updates  (row has a non-empty `id`)
 *   - valid inserts  (row has no `id`)
 *   - invalid rows   (missing `name`)
 */

import type { Clinic, ClinicType } from '../types/admin'

const VALID_CLINIC_TYPES = new Set<string>(['human', 'veterinary', 'both', ''])

// ── Column order ──────────────────────────────────────────────────────────────

export const CLINIC_CSV_COLUMNS = [
  'id', 'name', 'address', 'city', 'country', 'phone', 'website', 'clinicType', 'verified',
] as const

type ClinicCsvCol = typeof CLINIC_CSV_COLUMNS[number]

// ── CSV escaping ──────────────────────────────────────────────────────────────

function esc(val: string | boolean | undefined | null): string {
  const s = String(val ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

// ── Export ────────────────────────────────────────────────────────────────────

export function generateClinicCSV(clinics: Clinic[]): string {
  const header = CLINIC_CSV_COLUMNS.join(',')
  const rows   = clinics.map(c =>
    CLINIC_CSV_COLUMNS.map(col => esc((c as Record<ClinicCsvCol, unknown>)[col] as string | boolean | undefined)).join(','),
  )
  return [header, ...rows].join('\r\n')
}

export function downloadClinicCSV(clinics: Clinic[]): void {
  const content = generateClinicCSV(clinics)
  const blob    = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url     = URL.createObjectURL(blob)
  const a       = document.createElement('a')
  a.href        = url
  a.download    = 'clinics.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Robust CSV parser ─────────────────────────────────────────────────────────

function parseCSVText(text: string): Record<string, string>[] {
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rows: string[][] = []
  let cells: string[] = []
  let cell  = ''
  let inQ   = false

  for (let i = 0; i < src.length; i++) {
    const ch   = src[i]
    const next = src[i + 1]
    if (inQ) {
      if (ch === '"' && next === '"') { cell += '"'; i++; continue }
      if (ch === '"')                  { inQ = false; continue }
      cell += ch
    } else {
      if (ch === '"')  { inQ = true;  continue }
      if (ch === ',')  { cells.push(cell); cell = '';    continue }
      if (ch === '\n') { cells.push(cell); rows.push(cells); cells = []; cell = ''; continue }
      cell += ch
    }
  }
  cells.push(cell)
  if (cells.some(c => c.trim())) rows.push(cells)
  if (rows.length < 2) return []

  const headers = rows[0].map(h => h.trim())
  return rows.slice(1)
    .filter(r => r.some(c => c.trim()))
    .map(r => {
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => { obj[h] = (r[i] ?? '').trim() })
      return obj
    })
}

// ── Result types ──────────────────────────────────────────────────────────────

export type ClinicImportData = Omit<Clinic, 'id' | 'Created'> & { id?: string; clinicType: ClinicType }

export interface ClinicParseRow {
  data:     ClinicImportData
  isUpdate: boolean
}

export interface ClinicParseError {
  rowNumber: number
  reason:    string
  raw:       Record<string, string>
}

export interface ClinicParseResult {
  updates: ClinicParseRow[]
  inserts: ClinicParseRow[]
  errors:  ClinicParseError[]
}

// ── Parse & validate ──────────────────────────────────────────────────────────

export function parseClinicCSV(text: string): ClinicParseResult {
  const rawRows = parseCSVText(text)
  const updates: ClinicParseRow[]  = []
  const inserts: ClinicParseRow[]  = []
  const errors:  ClinicParseError[] = []

  rawRows.forEach((raw, idx) => {
    const rowNum   = idx + 1
    const name     = raw['name']?.trim()
    if (!name) {
      errors.push({ rowNumber: rowNum, reason: 'Missing name (required)', raw })
      return
    }

    const rawType = raw['clinicType']?.trim() ?? ''
    if (rawType && !VALID_CLINIC_TYPES.has(rawType)) {
      errors.push({ rowNumber: rowNum, reason: `Invalid clinicType "${rawType}". Must be: human, veterinary, both, or blank.`, raw })
      return
    }

    const data: ClinicImportData = {
      name,
      address:    raw['address']  ?? '',
      city:       raw['city']     ?? '',
      country:    raw['country']  ?? '',
      phone:      raw['phone']    ?? '',
      website:    raw['website']  ?? '',
      clinicType: (rawType || 'human') as ClinicType,
      verified:   raw['verified']?.toLowerCase() === 'true',
    }

    const rawId = raw['id']?.trim()
    if (rawId) data.id = rawId

    const isUpdate = !!data.id
    if (isUpdate) updates.push({ data, isUpdate })
    else          inserts.push({ data, isUpdate })
  })

  return { updates, inserts, errors }
}
