/**
 * FarmImportPage — bulk import livestock records from CSV or Excel files.
 *
 * Flow:
 *  1. Download template (optional)  →  2. Upload file  →  3. Preview & validate
 *  →  4. Import with progress        →  5. Done summary
 *
 * Uses SheetJS (xlsx) loaded dynamically to avoid bloating the main bundle.
 * Writes in Firestore batches of 450 (well under the 500 op limit).
 */

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { bulkAddFarmAnimals } from '../services/farmService'
import type { FarmAnimal, FarmImportRow, FarmSpecies, FarmSex, FarmAnimalStatus, FarmPurpose } from '../types/farm'
import {
  IMPORT_TEMPLATE_HEADERS, IMPORT_TEMPLATE_EXAMPLE,
  VALID_SPECIES_SET, FARM_SPECIES_CODE,
} from '../types/farm'

// ── Parsing helpers ───────────────────────────────────────────────────────────

function normaliseHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_-]/g, '')
}

const HEADER_MAP: Record<string, keyof FarmImportRow> = {
  tagnumber:     'tagNumber',
  tag:           'tagNumber',
  eartag:        'tagNumber',
  eartagno:      'tagNumber',
  tagno:         'tagNumber',
  tagnum:        'tagNumber',
  species:       'species',
  chipid:        'chipId',
  rfid:          'chipId',
  microchip:     'chipId',
  nationalid:    'nationalId',
  nait:          'nationalId',
  nlis:          'nationalId',
  name:          'name',
  breed:         'breed',
  sex:           'sex',
  gender:        'sex',
  colour:        'colour',
  color:         'colour',
  dateofbirth:   'dateOfBirth',
  dob:           'dateOfBirth',
  born:          'dateOfBirth',
  birthdate:     'dateOfBirth',
  weight:        'weight',
  weightunit:    'weightUnit',
  unit:          'weightUnit',
  status:        'status',
  purpose:       'purpose',
  herd:          'herd',
  flock:         'herd',
  batch:         'herd',
  group:         'herd',
  paddock:       'paddock',
  location:      'paddock',
  pen:           'paddock',
  dam:           'damId',
  damid:         'damId',
  mother:        'damId',
  mothertag:     'damId',
  sire:          'sireId',
  sireid:        'sireId',
  father:        'sireId',
  fathertag:     'sireId',
  purchasedate:  'purchaseDate',
  purchased:     'purchaseDate',
  source:        'purchaseSource',
  purchasesource: 'purchaseSource',
  vendor:        'purchaseSource',
  notes:         'notes',
  note:          'notes',
  comments:      'notes',
}

const VALID_SEXES = new Set(['male', 'female', 'castrated', 'unknown', 'm', 'f', 'c', 'u'])
const SEX_MAP: Record<string, FarmSex> = {
  m: 'male', male: 'male',
  f: 'female', female: 'female',
  c: 'castrated', castrated: 'castrated', neutered: 'castrated',
  u: 'unknown', unknown: 'unknown', '': 'unknown',
}
const VALID_STATUSES = new Set(['active', 'sold', 'deceased', 'culled', 'lost'])
const VALID_PURPOSES = new Set([
  'beef', 'dairy', 'breeding', 'wool', 'fibre', 'eggs', 'pork', 'show', 'draught', 'other',
])

interface ParsedRow {
  row: number
  data: Omit<FarmAnimal, 'id' | 'createdAt' | 'ownerId' | 'members'>
  warnings: string[]
}
interface ParseError {
  row: number
  message: string
}

function parseRows(raw: Record<string, string>[]): { parsed: ParsedRow[]; errors: ParseError[] } {
  const parsed: ParsedRow[] = []
  const errors: ParseError[] = []

  raw.forEach((rawRow, i) => {
    const rowNum = i + 2   // +2 because row 1 = header, +1 for 1-index
    const row: Partial<FarmImportRow> = {}

    // Map raw keys to FarmImportRow keys
    Object.entries(rawRow).forEach(([k, v]) => {
      const mapped = HEADER_MAP[normaliseHeader(k)]
      if (mapped) (row as unknown as Record<string, string>)[mapped] = (v ?? '').trim()
    })

    // Validate required fields
    const tagNumber = row.tagNumber?.trim()
    if (!tagNumber) { errors.push({ row: rowNum, message: 'Missing tag number (tagNumber column)' }); return }

    const speciesRaw = row.species?.trim().toLowerCase()
    if (!speciesRaw || !VALID_SPECIES_SET.has(speciesRaw)) {
      errors.push({ row: rowNum, message: `Invalid or missing species "${row.species ?? ''}" — valid: ${Array.from(VALID_SPECIES_SET).join(', ')}` })
      return
    }
    const species = speciesRaw as FarmSpecies

    const warnings: string[] = []

    // Sex
    const sexRaw = row.sex?.trim().toLowerCase() ?? ''
    if (sexRaw && !VALID_SEXES.has(sexRaw)) warnings.push(`Unknown sex "${row.sex}" — defaulting to unknown`)
    const sex: FarmSex = SEX_MAP[sexRaw] ?? 'unknown'

    // Status
    const statusRaw = row.status?.trim().toLowerCase() ?? ''
    if (statusRaw && !VALID_STATUSES.has(statusRaw)) warnings.push(`Unknown status "${row.status}" — defaulting to active`)
    const status: FarmAnimalStatus = VALID_STATUSES.has(statusRaw) ? (statusRaw as FarmAnimalStatus) : 'active'

    // Purpose
    const purposeRaw = row.purpose?.trim().toLowerCase() ?? ''
    if (purposeRaw && !VALID_PURPOSES.has(purposeRaw)) warnings.push(`Unknown purpose "${row.purpose}" — ignored`)
    const purpose = VALID_PURPOSES.has(purposeRaw) ? (purposeRaw as FarmPurpose) : undefined

    // Weight
    const weightNum = row.weight ? parseFloat(row.weight) : undefined
    if (row.weight && isNaN(weightNum!)) warnings.push(`Invalid weight "${row.weight}" — ignored`)

    const clean = (s?: string) => s?.trim() || undefined

    const data: Omit<FarmAnimal, 'id' | 'createdAt' | 'ownerId' | 'members'> = {
      species, tagNumber,
      chipId: clean(row.chipId),
      nationalId: clean(row.nationalId),
      name: clean(row.name),
      breed: clean(row.breed),
      sex,
      colour: clean(row.colour),
      dateOfBirth: clean(row.dateOfBirth),
      weight: !isNaN(weightNum!) ? weightNum : undefined,
      weightUnit: row.weightUnit?.trim().toLowerCase() === 'lb' ? 'lb' : 'kg',
      status,
      purpose,
      herd: clean(row.herd),
      paddock: clean(row.paddock),
      damId: clean(row.damId),
      sireId: clean(row.sireId),
      purchaseDate: clean(row.purchaseDate),
      purchaseSource: clean(row.purchaseSource),
      notes: clean(row.notes),
    }

    // Remove undefined keys
    const payload = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined),
    ) as typeof data

    parsed.push({ row: rowNum, data: payload, warnings })
  })

  return { parsed, errors }
}

// ── CSV download helper ───────────────────────────────────────────────────────

function downloadTemplate() {
  const header = IMPORT_TEMPLATE_HEADERS.join(',')
  const rows = IMPORT_TEMPLATE_EXAMPLE.map(r =>
    IMPORT_TEMPLATE_HEADERS.map(h => {
      const v = (r as unknown as Record<string, string | undefined>)[h] ?? ''
      return v.includes(',') ? `"${v}"` : v
    }).join(','),
  )
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'farm_import_template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Stage = 'upload' | 'preview' | 'importing' | 'done'

export function FarmImportPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [stage, setStage] = useState<Stage>('upload')
  const [dragOver, setDragOver] = useState(false)
  const [parseErrors, setParseErrors] = useState<ParseError[]>([])
  const [parsed, setParsed] = useState<ParsedRow[]>([])
  const [importProgress, setImportProgress] = useState(0)
  const [importTotal, setImportTotal] = useState(0)
  const [importDone, setImportDone] = useState(0)
  const [importError, setImportError] = useState<string | null>(null)

  const processFile = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()

    let raw: Record<string, string>[] = []

    if (ext === 'csv' || ext === 'txt') {
      // Native CSV parse — avoids bundle overhead for CSV-only users
      const text = await file.text()
      const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
      if (lines.length < 2) { alert('File appears empty or has no data rows.'); return }

      // Parse quoted CSV
      function parseCsvLine(line: string): string[] {
        const result: string[] = []
        let cur = '', inQ = false
        for (let i = 0; i < line.length; i++) {
          const c = line[i]
          if (c === '"') { inQ = !inQ }
          else if (c === ',' && !inQ) { result.push(cur); cur = '' }
          else cur += c
        }
        result.push(cur)
        return result
      }

      const headers = parseCsvLine(lines[0])
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue
        const vals = parseCsvLine(lines[i])
        const obj: Record<string, string> = {}
        headers.forEach((h, idx) => { obj[h.trim()] = (vals[idx] ?? '').trim() })
        raw.push(obj)
      }
    } else if (ext === 'xlsx' || ext === 'xls' || ext === 'ods') {
      // Dynamic import — only loaded when needed
      try {
        const XLSX = await import('xlsx')
        const buf = await file.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array', cellDates: true })
        const ws = wb.Sheets[wb.SheetNames[0]]
        raw = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '', raw: false })
      } catch (e) {
        alert(`Could not read Excel file: ${(e as Error).message}`)
        return
      }
    } else {
      alert('Unsupported file type. Please upload a .csv or .xlsx file.')
      return
    }

    if (raw.length === 0) { alert('No data rows found in the file.'); return }

    const { parsed: p, errors: e } = parseRows(raw)
    setParsed(p)
    setParseErrors(e)
    setStage('preview')
  }, [])

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  async function runImport() {
    if (!user || parsed.length === 0) return
    setStage('importing')
    setImportTotal(parsed.length)
    setImportProgress(0)
    setImportError(null)
    try {
      const done = await bulkAddFarmAnimals(
        user.uid,
        parsed.map(p => p.data),
        (completed, total) => {
          setImportProgress(completed)
          setImportTotal(total)
        },
      )
      setImportDone(done)
      setStage('done')
    } catch (e) {
      setImportError((e as Error)?.message ?? 'Unknown error')
      setStage('preview')
    }
  }

  const warningCount = parsed.filter(p => p.warnings.length > 0).length

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="flex items-center gap-3 px-4 pt-safe h-14">
          <button onClick={() => stage === 'preview' ? setStage('upload') : navigate(-1)} className="p-2 -ml-2">
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-base font-semibold text-gray-900 dark:text-white">
              {stage === 'upload' && 'Bulk Import'}
              {stage === 'preview' && 'Preview & Validate'}
              {stage === 'importing' && 'Importing…'}
              {stage === 'done' && 'Import Complete'}
            </h1>
            <p className="text-xs text-gray-400 -mt-0.5">CSV / Excel livestock records</p>
          </div>
        </div>

        {/* Stage progress */}
        <div className="flex px-4 pb-2 gap-1">
          {(['upload', 'preview', 'done'] as const).map((s, i) => (
            <div key={s} className={`flex-1 h-1 rounded-full ${
              stage === 'importing' || (i <= ['upload','preview','done'].indexOf(stage))
                ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700'
            }`} />
          ))}
        </div>
      </div>

      <div className="px-4 py-5 max-w-xl mx-auto">

        {/* ── Upload stage ── */}
        {stage === 'upload' && (
          <div className="flex flex-col gap-5">
            {/* Template download */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
                Step 1 — Prepare your data
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                Download the template, fill in your animal data, then upload. One animal per row.
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 mb-3">
                <strong>Required:</strong> tagNumber, species<br />
                <strong>Accepted species:</strong> cattle, sheep, pig, goat, chicken, turkey, duck, horse, rabbit, deer, alpaca, llama, goose, other
              </p>
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 text-sm font-semibold text-green-700 dark:text-green-400 border border-green-300 dark:border-green-800 rounded-lg px-4 py-2.5 w-full justify-center"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download CSV Template
              </button>
            </div>

            {/* Drop zone */}
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                dragOver
                  ? 'border-green-600 bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
              }`}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
            >
              <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Drag & drop your file here
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 mb-4">
                Supports .csv, .xlsx, .xls
              </p>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,.ods,.txt"
                  className="hidden"
                  onChange={handleFileInput}
                />
                <span className="text-xs font-bold text-white bg-green-700 px-4 py-2 rounded-lg">
                  Browse Files
                </span>
              </label>
            </div>

            {/* Column reference */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">Available Columns</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {IMPORT_TEMPLATE_HEADERS.map(h => (
                  <div key={h} className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${h === 'tagNumber' || h === 'species' ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                    <span className="text-xs font-mono text-gray-600 dark:text-gray-300">{h}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-2">Red = required. Column names are flexible — common aliases accepted.</p>
            </div>
          </div>
        )}

        {/* ── Preview stage ── */}
        {stage === 'preview' && (
          <div className="flex flex-col gap-4">
            {/* Summary */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">Parse Summary</p>
              <div className="flex gap-4">
                <div className="text-center flex-1">
                  <p className="text-2xl font-black text-green-700 dark:text-green-400">{parsed.length}</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Valid rows</p>
                </div>
                <div className="text-center flex-1">
                  <p className={`text-2xl font-black ${parseErrors.length > 0 ? 'text-red-600' : 'text-gray-300 dark:text-gray-600'}`}>
                    {parseErrors.length}
                  </p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Errors</p>
                </div>
                <div className="text-center flex-1">
                  <p className={`text-2xl font-black ${warningCount > 0 ? 'text-amber-500' : 'text-gray-300 dark:text-gray-600'}`}>
                    {warningCount}
                  </p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Warnings</p>
                </div>
              </div>
            </div>

            {/* Errors */}
            {parseErrors.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-4">
                <p className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wide mb-2">
                  {parseErrors.length} Row{parseErrors.length !== 1 ? 's' : ''} Skipped (fix in your file to include them)
                </p>
                <div className="flex flex-col gap-1">
                  {parseErrors.slice(0, 10).map(e => (
                    <p key={e.row} className="text-xs text-red-600 dark:text-red-400">
                      <span className="font-mono font-bold">Row {e.row}:</span> {e.message}
                    </p>
                  ))}
                  {parseErrors.length > 10 && (
                    <p className="text-xs text-red-500">…and {parseErrors.length - 10} more errors</p>
                  )}
                </div>
              </div>
            )}

            {/* Import error from last attempt */}
            {importError && (
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-3">
                <p className="text-xs text-red-600 dark:text-red-400 font-semibold">Import failed: {importError}</p>
              </div>
            )}

            {/* Preview table */}
            {parsed.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    Preview — first {Math.min(parsed.length, 20)} of {parsed.length} records
                  </p>
                </div>
                {/* Column headers */}
                <div className="grid grid-cols-12 gap-1 px-3 py-1.5 bg-gray-50 dark:bg-gray-700/30 border-b border-gray-100 dark:border-gray-700">
                  <span className="col-span-3 text-[9px] font-bold text-gray-400 uppercase tracking-widest">Tag</span>
                  <span className="col-span-2 text-[9px] font-bold text-gray-400 uppercase tracking-widest">Spc</span>
                  <span className="col-span-3 text-[9px] font-bold text-gray-400 uppercase tracking-widest">Herd</span>
                  <span className="col-span-2 text-[9px] font-bold text-gray-400 uppercase tracking-widest">Status</span>
                  <span className="col-span-2 text-[9px] font-bold text-gray-400 uppercase tracking-widest">Warn</span>
                </div>
                <div className="divide-y divide-gray-50 dark:divide-gray-700/40">
                  {parsed.slice(0, 20).map(p => (
                    <div key={p.row} className="grid grid-cols-12 gap-1 px-3 py-2 items-center">
                      <span className="col-span-3 text-xs font-mono font-bold text-gray-900 dark:text-white truncate">{p.data.tagNumber}</span>
                      <span className="col-span-2">
                        <span className="text-[9px] font-mono font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1 py-0.5 rounded">
                          {FARM_SPECIES_CODE[p.data.species]}
                        </span>
                      </span>
                      <span className="col-span-3 text-[10px] text-gray-500 dark:text-gray-400 truncate">{p.data.herd ?? '—'}</span>
                      <span className="col-span-2 text-[9px] text-gray-500 uppercase truncate">{p.data.status ?? 'active'}</span>
                      <span className="col-span-2">
                        {p.warnings.length > 0 && (
                          <span className="text-[9px] text-amber-600 font-bold" title={p.warnings.join('\n')}>
                            {p.warnings.length}W
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
                {parsed.length > 20 && (
                  <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-[10px] text-gray-400">…{parsed.length - 20} more records</p>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pb-10">
              <button
                onClick={() => setStage('upload')}
                className="flex-1 py-3 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300"
              >
                Change File
              </button>
              <button
                onClick={runImport}
                disabled={parsed.length === 0}
                className="flex-1 py-3 bg-green-700 text-white rounded-xl text-sm font-bold disabled:opacity-40"
              >
                Import {parsed.length} Record{parsed.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}

        {/* ── Importing stage ── */}
        {stage === 'importing' && (
          <div className="flex flex-col items-center gap-6 py-16">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-green-600 rounded-full animate-spin" />
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {importProgress} / {importTotal}
              </p>
              <p className="text-sm text-gray-400 uppercase tracking-wide mt-1">Records written</p>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full transition-all"
                style={{ width: importTotal > 0 ? `${(importProgress / importTotal) * 100}%` : '0%' }}
              />
            </div>
            <p className="text-xs text-gray-400">Do not close this page</p>
          </div>
        )}

        {/* ── Done stage ── */}
        {stage === 'done' && (
          <div className="flex flex-col items-center gap-6 py-16">
            <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-xl font-black text-gray-900 dark:text-white">{importDone} Records Imported</p>
              {parseErrors.length > 0 && (
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                  {parseErrors.length} row{parseErrors.length !== 1 ? 's were' : ' was'} skipped due to errors
                </p>
              )}
              <p className="text-sm text-gray-400 mt-1">Animals are now visible in the Farm register</p>
            </div>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => { setStage('upload'); setParsed([]); setParseErrors([]) }}
                className="flex-1 py-3 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300"
              >
                Import More
              </button>
              <button
                onClick={() => navigate('/farm')}
                className="flex-1 py-3 bg-green-700 text-white rounded-xl text-sm font-bold"
              >
                View Register
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
