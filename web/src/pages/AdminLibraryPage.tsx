import { useState, useEffect, useRef } from 'react'
import { getAllVaccineLibraryEntries, addVaccineLibraryEntry, updateVaccineLibraryEntry, bulkUpsertVaccineLibraryEntries } from '../services/vaccineLibraryService'
import { getDiseaseRisk, setDiseaseRisk, deleteDiseaseRisk } from '../services/diseaseRiskService'
import { downloadLibraryCSV, parseLibraryCSV, type ParseResult } from '../utils/vaccineLibraryCsv'
import type { VaccineLibraryEntry, VaccineCategory, AnimalVaccineType } from '../types/vaccineLibrary'
import {
  VACCINE_STATUS_LABELS, VACCINE_STATUS_COLOURS,
  VACCINE_CATEGORY_LABELS, VACCINE_CATEGORY_COLOURS,
  ANIMAL_VACCINE_TYPE_LABELS, ALL_ANIMAL_VACCINE_TYPES,
} from '../types/vaccineLibrary'
import type { VaccineStatus } from '../types/vaccineLibrary'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { GeoTagInput } from '../components/ui/GeoTagInput'
import { useIsLg } from '../hooks/useMediaQuery'
import { ResizableSplitPane } from '../components/layout/ResizableSplitPane'

type FormData = Omit<VaccineLibraryEntry, 'id' | 'relevanceScore'>

const EMPTY_FORM: FormData = {
  Vac_Name: '', 'Disease Target': '', 'Short Description': '', 'Long Description': '',
  'Brand Name': '', Manufacturer: '', 'Type/Technology': '', Administration: '',
  'Dosing Schedule': '', 'Storage Requirements': '', 'Efficacy Rate': '',
  'Age Group': '', 'Target Population': '', 'Geographic Priority': '',
  'Disease Prevalence': '', 'Special Notes': '', status: 'available',
  category: 'human_adult', animalTypes: '',
  entryRequirementCountries: '', entryRequirementNote: '',
}

const TEXT_FIELDS: { key: keyof FormData; label: string; multiline?: boolean }[] = [
  { key: 'Vac_Name', label: 'Vaccine Name *' },
  { key: 'Disease Target', label: 'Disease Target *' },
  { key: 'Brand Name', label: 'Brand Name' },
  { key: 'Manufacturer', label: 'Manufacturer' },
  { key: 'Type/Technology', label: 'Type / Technology' },
  { key: 'Administration', label: 'Administration (e.g. IM injection)' },
  { key: 'Dosing Schedule', label: 'Dosing Schedule' },
  { key: 'Age Group', label: 'Age Group' },
  { key: 'Target Population', label: 'Target Population' },
  { key: 'Efficacy Rate', label: 'Efficacy Rate' },
  { key: 'Storage Requirements', label: 'Storage Requirements' },
  { key: 'Short Description', label: 'Short Description', multiline: true },
  { key: 'Long Description', label: 'Long Description', multiline: true },
  { key: 'Special Notes', label: 'Special Notes', multiline: true },
]

const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

// ── Import confirmation modal ─────────────────────────────────────────────────

interface ImportModalProps {
  filename:    string
  result:      ParseResult
  onConfirm:  () => Promise<void>
  onClose:    () => void
}

function ImportModal({ filename, result, onConfirm, onClose }: ImportModalProps) {
  const [importing, setImporting] = useState(false)
  const [done, setDone]           = useState<{ added: number; updated: number } | null>(null)
  const [err,  setErr]            = useState('')

  const total = result.updates.length + result.inserts.length

  async function handleConfirm() {
    setImporting(true)
    try {
      await onConfirm()
      setDone({ added: result.inserts.length, updated: result.updates.length })
    } catch {
      setErr('Import failed. Check your admin permissions and try again.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full sm:max-w-lg bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl shadow-xl p-5 pb-8 sm:pb-5 max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {done ? (
          /* Success state */
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Import complete</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {done.updated > 0 && <span>{done.updated} vaccine{done.updated !== 1 ? 's' : ''} updated · </span>}
              {done.added > 0   && <span>{done.added} new vaccine{done.added !== 1 ? 's' : ''} added</span>}
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-6 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Import CSV</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-xs">{filename}</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 px-3 py-2.5 text-center">
                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{result.updates.length}</p>
                <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5 font-medium">Updates</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">rows with ID</p>
              </div>
              <div className="rounded-xl bg-green-50 dark:bg-green-900/20 px-3 py-2.5 text-center">
                <p className="text-xl font-bold text-green-600 dark:text-green-400">{result.inserts.length}</p>
                <p className="text-xs text-green-500 dark:text-green-400 mt-0.5 font-medium">New</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">rows without ID</p>
              </div>
              <div className={`rounded-xl px-3 py-2.5 text-center ${result.errors.length > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
                <p className={`text-xl font-bold ${result.errors.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'}`}>{result.errors.length}</p>
                <p className={`text-xs mt-0.5 font-medium ${result.errors.length > 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'}`}>Skipped</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">validation errors</p>
              </div>
            </div>

            {/* Error details */}
            {result.errors.length > 0 && (
              <div className="mb-4 rounded-xl border border-red-200 dark:border-red-800 overflow-hidden">
                <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-800">
                  <p className="text-xs font-semibold text-red-600 dark:text-red-400">Rows with errors (will be skipped)</p>
                </div>
                <div className="divide-y divide-red-100 dark:divide-red-800 max-h-40 overflow-y-auto">
                  {result.errors.map((e, i) => (
                    <div key={i} className="px-3 py-2">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Row {e.rowNumber}: {e.raw['Vac_Name'] || '(no name)'}</p>
                      <p className="text-[11px] text-red-500 dark:text-red-400 mt-0.5">{e.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Info note */}
            <div className="mb-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-300">
              <strong>Note:</strong> Updates merge into existing records — no fields are deleted unless explicitly blanked in the CSV.
              Vaccines not present in the CSV are left untouched.
            </div>

            {err && <p className="text-xs text-red-500 mb-3">{err}</p>}

            {total === 0 ? (
              <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-2">
                No valid rows found to import.
              </p>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={importing}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {importing ? 'Importing…' : `Import ${total} row${total !== 1 ? 's' : ''}`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Category filter chips ──────────────────────────────────────────────────────
const CAT_FILTERS: { value: VaccineCategory | 'all'; label: string; colour: string }[] = [
  { value: 'all',         label: 'All',      colour: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' },
  { value: 'human_adult', label: 'Adults',   colour: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
  { value: 'human_child', label: 'Children', colour: 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' },
  { value: 'animal',      label: 'Animals',  colour: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
]

export function AdminLibraryPage() {
  const isLg = useIsLg()
  const [entries, setEntries] = useState<VaccineLibraryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState<VaccineCategory | 'all'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Risk map editor state (per-entry, loaded when an entry is opened)
  const [riskHigh,       setRiskHigh]       = useState('')   // comma-separated country names
  const [riskMedium,     setRiskMedium]     = useState('')
  const [riskNote,       setRiskNote]       = useState('')
  const [riskLoading,    setRiskLoading]    = useState(false)
  const [riskSaving,     setRiskSaving]     = useState(false)
  const [riskSavedMsg,   setRiskSavedMsg]   = useState('')
  const [showRiskEditor, setShowRiskEditor] = useState(false)

  // CSV import/export
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importModal, setImportModal] = useState<{ filename: string; result: ParseResult } | null>(null)

  const showDetail = isNew || selectedId !== null

  async function load() {
    setLoading(true)
    try { setEntries(await getAllVaccineLibraryEntries()) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  function openNew() {
    setIsNew(true)
    setSelectedId(null)
    setForm({ ...EMPTY_FORM })
  }

  function openEdit(entry: VaccineLibraryEntry) {
    setIsNew(false)
    setSelectedId(entry.id)
    const { id, relevanceScore, ...rest } = entry
    void id; void relevanceScore
    setForm({ ...EMPTY_FORM, ...rest } as FormData)
    // Load existing risk map data for this entry
    setRiskHigh(''); setRiskMedium(''); setRiskNote('')
    setRiskSavedMsg(''); setShowRiskEditor(false)
    setRiskLoading(true)
    getDiseaseRisk(entry.id)
      .then(doc => {
        if (doc) {
          setRiskHigh(doc.high.join(', '))
          setRiskMedium(doc.medium.join(', '))
          setRiskNote(doc.note ?? '')
          setShowRiskEditor(true)  // auto-expand if data exists
        }
      })
      .catch(() => {/* non-critical */})
      .finally(() => setRiskLoading(false))
  }

  function closeDetail() {
    setSelectedId(null); setIsNew(false)
    setRiskHigh(''); setRiskMedium(''); setRiskNote('')
    setRiskSavedMsg(''); setShowRiskEditor(false)
  }

  async function save() {
    if (!form.Vac_Name?.trim() || !form['Disease Target']?.trim()) {
      alert('Vaccine Name and Disease Target are required.')
      return
    }
    setSaving(true)
    try {
      if (isNew) {
        await addVaccineLibraryEntry(form)
        await load()
      } else if (selectedId) {
        await updateVaccineLibraryEntry(selectedId, form)
        setEntries(prev => prev.map(e => e.id === selectedId ? { ...e, ...form } : e))
      }
      closeDetail()
    } catch (e) {
      console.error('Library save error:', e)
      alert('Error saving. Make sure your Admin flag is set to boolean true in Firestore.')
    } finally { setSaving(false) }
  }

  async function saveRiskMap() {
    if (!selectedId) return
    setRiskSaving(true); setRiskSavedMsg('')
    try {
      const parseTags = (s: string) => s.split(',').map(t => t.trim()).filter(Boolean)
      await setDiseaseRisk(selectedId, {
        diseaseTarget: form['Disease Target'] ?? '',
        high:   parseTags(riskHigh),
        medium: parseTags(riskMedium),
        note:   riskNote.trim(),
      })
      setRiskSavedMsg('Saved!')
      setTimeout(() => setRiskSavedMsg(''), 3000)
    } catch {
      alert('Error saving risk data. Check admin permissions.')
    } finally { setRiskSaving(false) }
  }

  async function clearRiskMap() {
    if (!selectedId) return
    if (!window.confirm('Remove all risk map data for this vaccine? The static fallback data (if any) will be used instead.')) return
    try {
      await deleteDiseaseRisk(selectedId)
      setRiskHigh(''); setRiskMedium(''); setRiskNote('')
      setRiskSavedMsg('Risk map cleared')
      setTimeout(() => setRiskSavedMsg(''), 3000)
    } catch {
      alert('Error clearing risk data.')
    }
  }

  function handleExportCSV() {
    downloadLibraryCSV(entries)
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const result = parseLibraryCSV(text)
      setImportModal({ filename: file.name, result })
    }
    reader.readAsText(file)
    // Reset so the same file can be re-selected
    e.target.value = ''
  }

  async function handleConfirmImport() {
    if (!importModal) return
    const rows = [
      ...importModal.result.updates.map(r => r.data),
      ...importModal.result.inserts.map(r => r.data),
    ]
    await bulkUpsertVaccineLibraryEntries(rows)
    await load()
  }

  const filtered = entries.filter(e => {
    const matchesCat = catFilter === 'all' || (e.category ?? 'human_adult') === catFilter
    const matchesSearch =
      e.Vac_Name?.toLowerCase().includes(search.toLowerCase()) ||
      e['Disease Target']?.toLowerCase().includes(search.toLowerCase()) ||
      e['Brand Name']?.toLowerCase().includes(search.toLowerCase()) ||
      e.Manufacturer?.toLowerCase().includes(search.toLowerCase())
    return matchesCat && matchesSearch
  })

  // ── List panel ─────────────────────────────────────────────────────────────
  const listPanel = (
    <div className="p-4 flex flex-col gap-3 pb-10">
      {/* Search + add */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search vaccines, diseases…"
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:placeholder-gray-400"
          />
        </div>
        <Button size="sm" onClick={openNew}>+ New</Button>
      </div>

      {/* CSV import / export */}
      <div className="flex gap-2">
        {/* Export */}
        <button
          onClick={handleExportCSV}
          disabled={entries.length === 0}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </button>

        {/* Import */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Import CSV
        </button>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleFileSelected}
        />
      </div>

      {/* Category filter chips */}
      <div className="flex gap-1.5 flex-wrap">
        {CAT_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setCatFilter(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              catFilter === f.value
                ? f.colour + ' ring-1 ring-current'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {f.label}
            <span className="ml-1.5 opacity-60">
              {f.value === 'all'
                ? entries.length
                : entries.filter(e => (e.category ?? 'human_adult') === f.value).length}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-400 dark:text-gray-500">{filtered.length} of {entries.length} entries</p>
          {filtered.map(entry => (
            <div
              key={entry.id}
              onClick={() => openEdit(entry)}
              className={`bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border cursor-pointer transition-all active:scale-[0.98] ${
                selectedId === entry.id
                  ? 'border-blue-400 dark:border-blue-500 ring-1 ring-blue-400'
                  : 'border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white truncate">{entry.Vac_Name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{entry['Disease Target']} · {entry.Manufacturer}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  {entry.category && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${VACCINE_CATEGORY_COLOURS[entry.category]}`}>
                      {VACCINE_CATEGORY_LABELS[entry.category]}
                    </span>
                  )}
                  {entry.status && entry.status !== 'available' && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${VACCINE_STATUS_COLOURS[entry.status]}`}>
                      {VACCINE_STATUS_LABELS[entry.status]}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // ── Detail / edit panel ────────────────────────────────────────────────────
  const detailPanel = showDetail ? (
    <div className="p-6">
      {!isLg && (
        <button onClick={closeDetail} className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 mb-5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to library
        </button>
      )}

      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          {isNew ? 'New Vaccine' : 'Edit Entry'}
        </h2>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={closeDetail}>Cancel</Button>
          <Button size="sm" loading={saving} onClick={save}>
            {isNew ? 'Add Vaccine' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Category */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Category *</label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.entries(VACCINE_CATEGORY_LABELS) as [VaccineCategory, string][]).map(([cat, lbl]) => (
              <button
                key={cat}
                type="button"
                onClick={() => setForm(f => ({ ...f, category: cat, animalTypes: cat !== 'animal' ? '' : f.animalTypes }))}
                className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                  (form.category ?? 'human_adult') === cat
                    ? `${VACCINE_CATEGORY_COLOURS[cat]} border-current`
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-transparent hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Animal types */}
        {(form.category ?? 'human_adult') === 'animal' && (
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Animal Type(s)</label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_ANIMAL_VACCINE_TYPES.map(t => {
                const active = (form.animalTypes ?? '').split(',').map(s => s.trim()).filter(Boolean).includes(t)
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      const current = (form.animalTypes ?? '').split(',').map(s => s.trim()).filter(Boolean)
                      const next = active ? current.filter(x => x !== t) : [...current, t]
                      setForm(f => ({ ...f, animalTypes: next.join(', ') }))
                    }}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      active ? 'bg-green-600 text-white border-green-600' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'
                    }`}
                  >
                    {ANIMAL_VACCINE_TYPE_LABELS[t as AnimalVaccineType]}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Two-column grid for short fields on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {TEXT_FIELDS.filter(f => !f.multiline).map(({ key, label }) => (
            <div key={key as string} className={key === 'Vac_Name' || key === 'Disease Target' ? 'lg:col-span-2' : ''}>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">{label}</label>
              <input
                type="text"
                value={(form[key] as string) ?? ''}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className={inputCls}
              />
            </div>
          ))}
        </div>

        {/* Multiline fields full-width */}
        {TEXT_FIELDS.filter(f => f.multiline).map(({ key, label }) => (
          <div key={key as string}>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">{label}</label>
            <textarea
              value={(form[key] as string) ?? ''}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              rows={3}
              className={inputCls}
            />
          </div>
        ))}

        {/* Geographic fields */}
        <GeoTagInput
          label="Geographic Priority"
          value={form['Geographic Priority'] ?? ''}
          onChange={v => setForm(f => ({ ...f, 'Geographic Priority': v }))}
          placeholder="Search countries or regions to add…"
        />
        <GeoTagInput
          label="Disease Prevalence"
          value={form['Disease Prevalence'] ?? ''}
          onChange={v => setForm(f => ({ ...f, 'Disease Prevalence': v }))}
          placeholder="Search regions where disease is prevalent…"
        />

        {/* ── Entry Requirements ──────────────────────────────────────────── */}
        <div className="border border-amber-200 dark:border-amber-700/50 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 flex items-center gap-2 border-b border-amber-100 dark:border-amber-700/40">
            <span className="text-base">🛂</span>
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Entry Requirements</p>
              <p className="text-xs text-amber-600 dark:text-amber-400">Countries that require proof of this vaccination for entry / visa</p>
            </div>
          </div>
          <div className="px-4 py-4 flex flex-col gap-3">
            <GeoTagInput
              label="Required-for-Entry Countries"
              value={form.entryRequirementCountries ?? ''}
              onChange={v => setForm(f => ({ ...f, entryRequirementCountries: v }))}
              placeholder="Search and add countries that require this vaccine…"
            />
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                Clarifying Note (optional)
              </label>
              <textarea
                value={form.entryRequirementNote ?? ''}
                onChange={e => setForm(f => ({ ...f, entryRequirementNote: e.target.value }))}
                rows={2}
                placeholder='e.g. "Required only if arriving from or transiting through an endemic country."'
                className={inputCls + ' resize-none'}
              />
            </div>
          </div>
        </div>

        {/* ── Risk Map Editor ──────────────────────────────────────────────── */}
        {!isNew && (
          <div className="border border-gray-200 dark:border-gray-600 rounded-2xl overflow-hidden">
            {/* Header / toggle */}
            <button
              type="button"
              onClick={() => setShowRiskEditor(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                </svg>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Risk Map Data</span>
                {riskLoading && <span className="text-xs text-gray-400">Loading…</span>}
                {!riskLoading && (riskHigh || riskMedium) && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">Saved</span>
                )}
              </div>
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${showRiskEditor ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showRiskEditor && (
              <div className="px-4 py-4 flex flex-col gap-4 border-t border-gray-100 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Define which countries show as High (red) or Moderate (amber) risk on the public-facing
                  disease map. These settings override the built-in static data. Leave blank to use
                  static defaults.
                </p>

                <GeoTagInput
                  label="🔴 High Risk Countries"
                  value={riskHigh}
                  onChange={setRiskHigh}
                  placeholder="Add country where vaccination is required / endemic…"
                />
                <GeoTagInput
                  label="🟡 Moderate Risk Countries"
                  value={riskMedium}
                  onChange={setRiskMedium}
                  placeholder="Add country where vaccination is recommended…"
                />

                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                    Contextual Note (shown in blue callout below map)
                  </label>
                  <textarea
                    value={riskNote}
                    onChange={e => setRiskNote(e.target.value)}
                    rows={2}
                    placeholder="e.g. 'No licensed vaccine exists for this disease.' or 'Disease was eradicated in 1980.'"
                    className={inputCls + ' resize-none'}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={saveRiskMap}
                    disabled={riskSaving}
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {riskSaving ? 'Saving…' : 'Save Risk Map'}
                  </button>
                  <button
                    type="button"
                    onClick={clearRiskMap}
                    className="px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    Clear
                  </button>
                </div>
                {riskSavedMsg && (
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium">{riskSavedMsg}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Market status */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Market Status</label>
          <div className="flex gap-2">
            {(['available', 'trial', 'premarket'] as VaccineStatus[]).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setForm(f => ({ ...f, status: s }))}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors border ${
                  (form.status ?? 'available') === s
                    ? `${VACCINE_STATUS_COLOURS[s]} border-current`
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-transparent hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                {s === 'available' ? 'Available' : s === 'trial' ? 'Trial' : 'Pre-market'}
              </button>
            ))}
          </div>
          {(form.status === 'trial' || form.status === 'premarket') && (
            <p className="text-xs text-amber-600 mt-1.5">Users can only add this vaccine if they simultaneously submit it for validation.</p>
          )}
        </div>

        {/* Bottom save row */}
        <div className="flex gap-3 pt-2 pb-10">
          <Button variant="secondary" fullWidth onClick={closeDetail}>Cancel</Button>
          <Button fullWidth loading={saving} onClick={save}>
            {isNew ? 'Add Vaccine' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 p-8 text-center">
      <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
      <p className="font-medium">Select a vaccine to edit</p>
      <p className="text-sm mt-1">or click + New to add an entry</p>
    </div>
  )

  // ── Layout ─────────────────────────────────────────────────────────────────
  if (isLg) {
    return (
      <>
        <ResizableSplitPane
          storageKey="splitPane:adminLibrary"
          leftClassName="overflow-y-auto bg-white dark:bg-gray-800"
          rightClassName="bg-gray-50 dark:bg-gray-900"
          left={listPanel}
          right={detailPanel}
        />
        {importModal && (
          <ImportModal
            filename={importModal.filename}
            result={importModal.result}
            onConfirm={handleConfirmImport}
            onClose={() => setImportModal(null)}
          />
        )}
      </>
    )
  }

  return (
    <>
      <div className="flex-1">
        {showDetail ? detailPanel : listPanel}
      </div>
      {importModal && (
        <ImportModal
          filename={importModal.filename}
          result={importModal.result}
          onConfirm={handleConfirmImport}
          onClose={() => setImportModal(null)}
        />
      )}
    </>
  )
}
