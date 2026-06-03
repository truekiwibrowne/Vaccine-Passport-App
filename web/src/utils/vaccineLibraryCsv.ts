/**
 * CSV import / export utilities for the Vaccine Library admin panel.
 *
 * Export: VaccineLibraryEntry[] → .csv download (id column included so
 *         downloaded rows can be re-uploaded as updates).
 *
 * Import: .csv text → parsed rows categorised as:
 *   - valid updates  (row has a non-empty `id`)
 *   - valid inserts  (row has no `id`)
 *   - invalid rows   (missing Vac_Name, or unrecognised status/category values)
 */

import type { VaccineLibraryEntry, VaccineStatus, VaccineCategory } from '../types/vaccineLibrary'

// ── Column order for the exported sheet ──────────────────────────────────────

export const CSV_COLUMNS: (keyof VaccineLibraryEntry)[] = [
  'id',
  'Vac_Name',
  'Disease Target',
  'Short Description',
  'Long Description',
  'Brand Name',
  'Manufacturer',
  'Type/Technology',
  'Administration',
  'Dosing Schedule',
  'Storage Requirements',
  'Efficacy Rate',
  'Age Group',
  'Target Population',
  'Geographic Priority',
  'Disease Prevalence',
  'Special Notes',
  'status',
  'category',
  'animalTypes',
]

const VALID_STATUSES   = new Set<string>(['available', 'trial', 'premarket', ''])
const VALID_CATEGORIES = new Set<string>(['human_adult', 'human_child', 'animal', ''])

// ── CSV escaping ──────────────────────────────────────────────────────────────

function esc(val: string | undefined | null): string {
  const s = val ?? ''
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

// ── Generate & download ───────────────────────────────────────────────────────

export function generateLibraryCSV(entries: VaccineLibraryEntry[]): string {
  const header = CSV_COLUMNS.join(',')
  const rows   = entries.map(e =>
    CSV_COLUMNS.map(col => esc(e[col] as string | undefined)).join(','),
  )
  return [header, ...rows].join('\r\n')
}

export function downloadLibraryCSV(entries: VaccineLibraryEntry[]): void {
  const content = generateLibraryCSV(entries)
  const blob    = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url     = URL.createObjectURL(blob)
  const a       = document.createElement('a')
  a.href        = url
  a.download    = 'vaccine_library.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Robust CSV parser (handles quoted fields, embedded newlines) ──────────────

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
      if (ch === '"')  { inQ = true; continue }
      if (ch === ',')  { cells.push(cell); cell = ''; continue }
      if (ch === '\n') { cells.push(cell); rows.push(cells); cells = []; cell = ''; continue }
      cell += ch
    }
  }
  // flush last cell / row
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

// ── Parsed result types ───────────────────────────────────────────────────────

export interface ParsedRow {
  data:  Partial<VaccineLibraryEntry>
  isUpdate: boolean   // true when row has a non-empty id
}

export interface ParseError {
  rowNumber: number   // 1-based data row index
  reason:    string
  raw:       Record<string, string>
}

export interface ParseResult {
  updates:   ParsedRow[]   // rows with id  → will be merged
  inserts:   ParsedRow[]   // rows without id → will be added
  errors:    ParseError[]  // rows that failed validation
}

// ── Parse & validate ──────────────────────────────────────────────────────────

export function parseLibraryCSV(text: string): ParseResult {
  const rawRows = parseCSVText(text)
  const updates: ParsedRow[]  = []
  const inserts: ParsedRow[]  = []
  const errors:  ParseError[] = []

  rawRows.forEach((raw, idx) => {
    const rowNum = idx + 1

    const name = raw['Vac_Name']?.trim()
    if (!name) {
      errors.push({ rowNumber: rowNum, reason: 'Missing Vac_Name (vaccine name is required)', raw })
      return
    }

    const status   = raw['status']?.trim()   ?? ''
    const category = raw['category']?.trim() ?? ''

    if (status && !VALID_STATUSES.has(status)) {
      errors.push({ rowNumber: rowNum, reason: `Unknown status "${status}". Must be: available, trial, premarket, or blank.`, raw })
      return
    }
    if (category && !VALID_CATEGORIES.has(category)) {
      errors.push({ rowNumber: rowNum, reason: `Unknown category "${category}". Must be: human_adult, human_child, animal, or blank.`, raw })
      return
    }

    // Build partial entry — keep only known columns
    const data: Partial<VaccineLibraryEntry> = {}
    CSV_COLUMNS.forEach(col => {
      const val = raw[col as string]
      if (val !== undefined) {
        // Typed coercions
        if (col === 'id') {
          if (val) (data as Record<string, string>)[col] = val
        } else if (col === 'status') {
          if (val) data.status = val as VaccineStatus
        } else if (col === 'category') {
          if (val) data.category = val as VaccineCategory
        } else {
          (data as Record<string, string>)[col as string] = val
        }
      }
    })

    // Default missing status / category so Firestore doesn't lose them
    if (!data.status)   data.status   = 'available'
    if (!data.category) data.category = 'human_adult'

    const isUpdate = !!(data as Partial<VaccineLibraryEntry> & { id?: string }).id
    const parsed: ParsedRow = { data, isUpdate }

    if (isUpdate) updates.push(parsed)
    else          inserts.push(parsed)
  })

  return { updates, inserts, errors }
}
