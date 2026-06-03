/**
 * CSV import / export utilities for the Practitioners admin panel.
 *
 * Export: Practitioner[] → .csv download (id column included).
 *
 * Import: .csv text → parsed rows categorised as updates/inserts/errors.
 *   Required columns: name, email
 *   verificationLevel must be 0-4 if provided.
 */

import type { Practitioner, PractitionerType } from '../types/admin'

const VALID_PRACTITIONER_TYPES = new Set<string>(['human', 'veterinary', ''])

// ── Column order ──────────────────────────────────────────────────────────────

export const PRACTITIONER_CSV_COLUMNS = [
  'id', 'name', 'email', 'clinicId', 'clinicName', 'speciality',
  'practitionerType', 'verificationLevel', 'active',
] as const

type PractitionerCsvCol = typeof PRACTITIONER_CSV_COLUMNS[number]

// ── CSV escaping ──────────────────────────────────────────────────────────────

function esc(val: string | number | boolean | undefined | null): string {
  const s = String(val ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

// ── Export ────────────────────────────────────────────────────────────────────

export function generatePractitionerCSV(practitioners: Practitioner[]): string {
  const header = PRACTITIONER_CSV_COLUMNS.join(',')
  const rows   = practitioners.map(p =>
    PRACTITIONER_CSV_COLUMNS.map(col =>
      esc((p as Record<PractitionerCsvCol, unknown>)[col] as string | number | boolean | undefined),
    ).join(','),
  )
  return [header, ...rows].join('\r\n')
}

export function downloadPractitionerCSV(practitioners: Practitioner[]): void {
  const content = generatePractitionerCSV(practitioners)
  const blob    = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url     = URL.createObjectURL(blob)
  const a       = document.createElement('a')
  a.href        = url
  a.download    = 'practitioners.csv'
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

export type PractitionerImportData = Omit<Practitioner, 'id' | 'Created' | 'uid' | 'verifiedBy' | 'verifiedAt'> & { id?: string; practitionerType: PractitionerType }

export interface PractitionerParseRow {
  data:     PractitionerImportData
  isUpdate: boolean
}

export interface PractitionerParseError {
  rowNumber: number
  reason:    string
  raw:       Record<string, string>
}

export interface PractitionerParseResult {
  updates: PractitionerParseRow[]
  inserts: PractitionerParseRow[]
  errors:  PractitionerParseError[]
}

const VALID_LEVELS = new Set(['0', '1', '2', '3', '4', ''])

// ── Parse & validate ──────────────────────────────────────────────────────────

export function parsePractitionerCSV(text: string): PractitionerParseResult {
  const rawRows = parseCSVText(text)
  const updates: PractitionerParseRow[]  = []
  const inserts: PractitionerParseRow[]  = []
  const errors:  PractitionerParseError[] = []

  rawRows.forEach((raw, idx) => {
    const rowNum = idx + 1
    const name   = raw['name']?.trim()
    const email  = raw['email']?.trim().toLowerCase()

    if (!name) {
      errors.push({ rowNumber: rowNum, reason: 'Missing name (required)', raw })
      return
    }
    if (!email) {
      errors.push({ rowNumber: rowNum, reason: 'Missing email (required)', raw })
      return
    }

    const rawLevel = raw['verificationLevel']?.trim() ?? ''
    if (rawLevel && !VALID_LEVELS.has(rawLevel)) {
      errors.push({ rowNumber: rowNum, reason: `Invalid verificationLevel "${rawLevel}". Must be 0–4 or blank.`, raw })
      return
    }

    const level = rawLevel ? (parseInt(rawLevel, 10) as Practitioner['verificationLevel']) : 0

    const rawPType = raw['practitionerType']?.trim() ?? ''
    if (rawPType && !VALID_PRACTITIONER_TYPES.has(rawPType)) {
      errors.push({ rowNumber: rowNum, reason: `Invalid practitionerType "${rawPType}". Must be: human, veterinary, or blank.`, raw })
      return
    }

    const data: PractitionerImportData = {
      name,
      email,
      clinicId:          raw['clinicId']        ?? '',
      clinicName:        raw['clinicName']       ?? '',
      speciality:        raw['speciality']       ?? '',
      practitionerType:  (rawPType || 'human') as PractitionerType,
      verificationLevel: level,
      active:            raw['active']?.toLowerCase() !== 'false',
    }

    const rawId = raw['id']?.trim()
    if (rawId) data.id = rawId

    const isUpdate = !!data.id
    if (isUpdate) updates.push({ data, isUpdate })
    else          inserts.push({ data, isUpdate })
  })

  return { updates, inserts, errors }
}
