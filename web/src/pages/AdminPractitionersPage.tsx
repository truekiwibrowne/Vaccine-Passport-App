import { useState, useEffect, useRef } from 'react'
import { getPractitioners, addPractitioner, updatePractitioner, deletePractitioner, bulkUpsertPractitioners } from '../services/practitionersService'
import { getClinics } from '../services/clinicsService'
import { downloadPractitionerCSV, parsePractitionerCSV } from '../utils/practitionersCsv'
import type { PractitionerParseResult } from '../utils/practitionersCsv'
import type { Practitioner, Clinic, PractitionerType } from '../types/admin'
import { VERIFICATION_LEVEL_LABELS, VERIFICATION_LEVEL_COLOURS, PRACTITIONER_TYPE_LABELS, PRACTITIONER_TYPE_COLOURS } from '../types/admin'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Spinner } from '../components/ui/Spinner'
import { useAuth } from '../contexts/AuthContext'
import { useIsLg } from '../hooks/useMediaQuery'
import { ResizableSplitPane } from '../components/layout/ResizableSplitPane'

const EMPTY_FORM = {
  name: '', email: '', clinicId: '', clinicName: '', speciality: '',
  practitionerType: 'human' as PractitionerType,
  verificationLevel: 0 as Practitioner['verificationLevel'],
  verifiedBy: '', verifiedAt: '', active: true,
}

// ── Import confirmation modal ─────────────────────────────────────────────────

interface ImportModalProps {
  filename:  string
  result:    PractitionerParseResult
  onConfirm: () => Promise<void>
  onClose:   () => void
}

function ImportModal({ filename, result, onConfirm, onClose }: ImportModalProps) {
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState<{ added: number; updated: number } | null>(null)
  const [err,  setErr]  = useState('')

  const total = result.updates.length + result.inserts.length

  async function handleConfirm() {
    setImporting(true)
    try {
      await onConfirm()
      setDone({ added: result.inserts.length, updated: result.updates.length })
    } catch {
      setErr('Import failed. Check your admin permissions and try again.')
    } finally { setImporting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full sm:max-w-lg bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl shadow-xl p-5 pb-8 sm:pb-5 max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {done ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Import complete</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {done.updated > 0 && <span>{done.updated} practitioner{done.updated !== 1 ? 's' : ''} updated · </span>}
              {done.added   > 0 && <span>{done.added} new practitioner{done.added !== 1 ? 's' : ''} added</span>}
              {done.updated === 0 && done.added === 0 && <span>Nothing to import.</span>}
            </p>
            <button onClick={onClose} className="mt-4 px-6 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">
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
              <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 px-3 py-2.5 text-center">
                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{result.updates.length}</p>
                <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5 font-medium">Updates</p>
                <p className="text-[10px] text-gray-400 mt-0.5">rows with ID</p>
              </div>
              <div className="rounded-xl bg-green-50 dark:bg-green-900/20 px-3 py-2.5 text-center">
                <p className="text-xl font-bold text-green-600 dark:text-green-400">{result.inserts.length}</p>
                <p className="text-xs text-green-500 dark:text-green-400 mt-0.5 font-medium">New</p>
                <p className="text-[10px] text-gray-400 mt-0.5">rows without ID</p>
              </div>
              <div className={`rounded-xl px-3 py-2.5 text-center ${result.errors.length > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
                <p className={`text-xl font-bold ${result.errors.length > 0 ? 'text-red-600' : 'text-gray-400'}`}>{result.errors.length}</p>
                <p className={`text-xs mt-0.5 font-medium ${result.errors.length > 0 ? 'text-red-500' : 'text-gray-400'}`}>Skipped</p>
                <p className="text-[10px] text-gray-400 mt-0.5">validation errors</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="mb-4 rounded-xl border border-red-200 dark:border-red-800 overflow-hidden">
                <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-800">
                  <p className="text-xs font-semibold text-red-600 dark:text-red-400">Rows with errors (will be skipped)</p>
                </div>
                <div className="divide-y divide-red-100 dark:divide-red-800 max-h-40 overflow-y-auto">
                  {result.errors.map((e, i) => (
                    <div key={i} className="px-3 py-2">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Row {e.rowNumber}: {e.raw['name'] || e.raw['email'] || '(no name)'}</p>
                      <p className="text-[11px] text-red-500 dark:text-red-400 mt-0.5">{e.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-300">
              <strong>Note:</strong> Updates merge into existing records — verifiedBy and verifiedAt are preserved.
              Practitioners not in the CSV are left untouched.
            </div>

            {err && <p className="text-xs text-red-500 mb-3">{err}</p>}

            {total === 0 ? (
              <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-2">No valid rows found.</p>
            ) : (
              <div className="flex gap-2">
                <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  Cancel
                </button>
                <button onClick={handleConfirm} disabled={importing} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
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

// ── Honour chain info box ─────────────────────────────────────────────────────
function HonourChainInfo() {
  return (
    <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-3 border border-blue-100 dark:border-blue-700">
      <p className="text-xs font-semibold text-blue-800 dark:text-blue-200 mb-1">Honour Verification Chain</p>
      <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">A practitioner's level determines the trust given to vaccines they verify. Vaccine auth level = practitioner level + 1 (max 5).</p>
      <div className="flex flex-col gap-1">
        {([0, 1, 2, 3, 4] as const).map(l => (
          <div key={l} className="flex items-center gap-2">
            <span className={`text-xs px-1.5 py-0.5 rounded font-semibold w-4 text-center ${VERIFICATION_LEVEL_COLOURS[l]}`}>{l}</span>
            <span className="text-xs text-blue-700 dark:text-blue-300">{VERIFICATION_LEVEL_LABELS[l]} → vaccine gets level {Math.min(l + 1, 5)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function AdminPractitionersPage() {
  const { profile } = useAuth()
  const isLg = useIsLg()
  const [practitioners, setPractitioners] = useState<Practitioner[]>([])
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [countryFilter, setCountryFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<PractitionerType | 'all'>('all')
  const [specialityFilter, setSpecialityFilter] = useState<string>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // CSV
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importModal, setImportModal] = useState<{ filename: string; result: PractitionerParseResult } | null>(null)

  const showDetail = isNew || selectedId !== null
  const selectedPractitioner = practitioners.find(p => p.id === selectedId) ?? null

  // Build a map of clinicId → clinic country for filtering
  const clinicCountryMap = Object.fromEntries(clinics.map(c => [c.id, c.country]))

  async function load() {
    setLoading(true)
    try {
      const [p, c] = await Promise.all([getPractitioners(), getClinics()])
      setPractitioners(p)
      setClinics(c)
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  function openAdd() { setIsNew(true); setSelectedId(null); setForm(EMPTY_FORM) }
  function openEdit(p: Practitioner) {
    setIsNew(false)
    setSelectedId(p.id)
    setForm({ name: p.name, email: p.email, clinicId: p.clinicId, clinicName: p.clinicName, speciality: p.speciality, practitionerType: p.practitionerType ?? 'human', verificationLevel: p.verificationLevel, verifiedBy: p.verifiedBy, verifiedAt: p.verifiedAt, active: p.active })
  }
  function closeDetail() { setSelectedId(null); setIsNew(false) }

  function handleClinicSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const clinic = clinics.find(c => c.id === e.target.value)
    setForm(f => ({
      ...f,
      clinicId:   clinic?.id   ?? '',
      clinicName: clinic?.name ?? '',
      // Auto-suggest practitioner type based on clinic type
      practitionerType: clinic?.clinicType === 'veterinary' ? 'veterinary'
        : clinic?.clinicType === 'human'     ? 'human'
        : f.practitionerType,
    }))
  }

  async function save() {
    setSaving(true)
    try {
      const now = new Date().toISOString()
      if (selectedId) {
        await updatePractitioner(selectedId, form)
        setPractitioners(prev => prev.map(p => p.id === selectedId ? { ...p, ...form } : p))
      } else {
        await addPractitioner({
          ...form,
          verifiedBy: form.verificationLevel > 0 ? (profile?.Full_Name ?? 'Admin') : '',
          verifiedAt: form.verificationLevel > 0 ? now : '',
        })
        await load()
      }
      closeDetail()
    } catch (e) {
      alert(`Error saving practitioner:\n${e instanceof Error ? e.message : String(e)}`)
    } finally { setSaving(false) }
  }

  async function setLevel(p: Practitioner, level: Practitioner['verificationLevel']) {
    try {
      const now = new Date().toISOString()
      await updatePractitioner(p.id, {
        verificationLevel: level,
        verifiedBy: level > 0 ? (profile?.Full_Name ?? 'Admin') : '',
        verifiedAt: level > 0 ? now : '',
      })
      setPractitioners(prev => prev.map(x => x.id === p.id ? { ...x, verificationLevel: level } : x))
      if (selectedId === p.id) setForm(f => ({ ...f, verificationLevel: level }))
    } catch { alert('Error updating level.') }
  }

  async function remove(p: Practitioner, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`Remove "${p.name}" (${p.email})?`)) return
    try {
      await deletePractitioner(p.id)
      if (selectedId === p.id) closeDetail()
      setPractitioners(prev => prev.filter(x => x.id !== p.id))
    } catch { alert('Error removing.') }
  }

  // CSV handlers
  function handleExportCSV() { downloadPractitionerCSV(practitioners) }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      setImportModal({ filename: file.name, result: parsePractitionerCSV(text) })
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  async function handleConfirmImport() {
    if (!importModal) return
    const rows = [
      ...importModal.result.updates.map(r => r.data),
      ...importModal.result.inserts.map(r => r.data),
    ]
    await bulkUpsertPractitioners(rows)
    await load()
  }

  // Derive filter options from loaded data
  // Countries come from clinics that practitioners are linked to
  const linkedCountries = Array.from(
    new Set(
      practitioners
        .map(p => clinicCountryMap[p.clinicId] ?? '')
        .filter(Boolean)
    )
  ).sort()

  const specialities = Array.from(
    new Set(practitioners.map(p => p.speciality).filter(Boolean))
  ).sort()

  const filtered = practitioners.filter(p => {
    const practCountry = clinicCountryMap[p.clinicId] ?? ''
    if (countryFilter !== 'all' && practCountry !== countryFilter) return false
    if (typeFilter !== 'all' && (p.practitionerType ?? 'human') !== typeFilter) return false
    if (specialityFilter !== 'all' && p.speciality !== specialityFilter) return false
    const q = search.toLowerCase()
    return !q ||
      p.name.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      p.clinicName?.toLowerCase().includes(q) ||
      p.speciality?.toLowerCase().includes(q)
  })

  // ── List panel ─────────────────────────────────────────────────────────────
  const listPanel = (
    <div className="p-4 flex flex-col gap-3 pb-10">
      {/* Search + Add */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search practitioners…"
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:placeholder-gray-400"
          />
        </div>
        <Button size="sm" onClick={openAdd}>+ Add</Button>
      </div>

      {/* CSV export / import */}
      <div className="flex gap-2">
        <button
          onClick={handleExportCSV}
          disabled={practitioners.length === 0}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Import CSV
        </button>
        <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileSelected} />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2">
        {/* Country filter — derived from linked clinic countries */}
        {linkedCountries.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">Country</p>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setCountryFilter('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${countryFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
              >
                All <span className="opacity-60 ml-1">{practitioners.length}</span>
              </button>
              {linkedCountries.map(c => {
                const count = practitioners.filter(p => (clinicCountryMap[p.clinicId] ?? '') === c).length
                return (
                  <button
                    key={c}
                    onClick={() => setCountryFilter(c)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${countryFilter === c ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                  >
                    {c} <span className="opacity-60 ml-1">{count}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Practitioner type filter */}
        <div>
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">Type</p>
          <div className="flex gap-1.5">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${typeFilter === 'all' ? 'bg-gray-700 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
            >
              All
            </button>
            {(['human', 'veterinary'] as PractitionerType[]).map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  typeFilter === t ? PRACTITIONER_TYPE_COLOURS[t] + ' ring-1 ring-current' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {t === 'human' ? '🏥 Human' : '🐾 Veterinary'}
                <span className="opacity-60 ml-1">{practitioners.filter(p => (p.practitionerType ?? 'human') === t).length}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Speciality / discipline filter */}
        {specialities.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">Discipline</p>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setSpecialityFilter('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${specialityFilter === 'all' ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
              >
                All disciplines
              </button>
              {specialities.map(s => {
                const count = practitioners.filter(p => p.speciality === s).length
                return (
                  <button
                    key={s}
                    onClick={() => setSpecialityFilter(s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${specialityFilter === s ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                  >
                    {s} <span className="opacity-60 ml-1">{count}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {!isLg && <HonourChainInfo />}

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <p className="font-medium">{practitioners.length === 0 ? 'No practitioners yet' : 'No practitioners match your filters'}</p>
          <p className="text-sm mt-1">{practitioners.length === 0 ? 'Add verified medical practitioners or import a CSV' : 'Try adjusting the country or discipline filter'}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {filtered.length === practitioners.length
              ? `${practitioners.length} practitioner${practitioners.length !== 1 ? 's' : ''}`
              : `${filtered.length} of ${practitioners.length} practitioners`}
          </p>
          {filtered.map(p => (
            <div
              key={p.id}
              onClick={() => openEdit(p)}
              className={`bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border cursor-pointer transition-all active:scale-[0.98] ${
                selectedId === p.id
                  ? 'border-blue-400 dark:border-blue-500 ring-1 ring-blue-400'
                  : 'border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">{p.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${PRACTITIONER_TYPE_COLOURS[p.practitionerType ?? 'human']}`}>
                      {(p.practitionerType ?? 'human') === 'veterinary' ? '🐾 Vet' : '🏥 Human'}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${VERIFICATION_LEVEL_COLOURS[p.verificationLevel]}`}>
                      L{p.verificationLevel} · {VERIFICATION_LEVEL_LABELS[p.verificationLevel]}
                    </span>
                    {!p.active && <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full font-medium">Inactive</span>}
                  </div>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 truncate">{p.email}</p>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    {p.clinicName && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{p.clinicName}</p>}
                    {p.speciality && (
                      <span className="text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">
                        {p.speciality}
                      </span>
                    )}
                    {clinicCountryMap[p.clinicId] && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">{clinicCountryMap[p.clinicId]}</span>
                    )}
                  </div>
                </div>
                <button onClick={e => remove(p, e)} className="p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              {/* Quick level row */}
              <div className="mt-2.5 pt-2.5 border-t border-gray-100 dark:border-gray-700">
                <div className="flex gap-1">
                  {([0, 1, 2, 3, 4] as const).map(l => (
                    <button
                      key={l}
                      onClick={e => { e.stopPropagation(); setLevel(p, l) }}
                      className={`flex-1 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        p.verificationLevel === l
                          ? VERIFICATION_LEVEL_COLOURS[l] + ' ring-1 ring-offset-1 ring-blue-400'
                          : 'bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
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
    <div className="p-4 lg:p-6 flex flex-col gap-4">
      {!isLg && (
        <button onClick={closeDetail} className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to practitioners
        </button>
      )}

      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          {isNew ? 'New Practitioner' : 'Edit Practitioner'}
        </h2>
        {selectedPractitioner && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{selectedPractitioner.email}</p>
        )}
      </div>

      <HonourChainInfo />

      <div className="space-y-3">
        <Input label="Full Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Dr. Jane Smith" />
        <Input label="Email *" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="doctor@clinic.com" />
        <Input label="Speciality / Discipline" value={form.speciality} onChange={e => setForm(f => ({ ...f, speciality: e.target.value }))} placeholder="General Practitioner" />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Practitioner Type *</label>
          <div className="grid grid-cols-2 gap-2">
            {(['human', 'veterinary'] as PractitionerType[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setForm(f => ({ ...f, practitionerType: t }))}
                className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                  form.practitionerType === t
                    ? PRACTITIONER_TYPE_COLOURS[t] + ' border-current'
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-transparent hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                {t === 'human' ? '🏥 Human Medicine' : '🐾 Veterinary'}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{PRACTITIONER_TYPE_LABELS[form.practitionerType]}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Associated Clinic</label>
          <select
            value={form.clinicId}
            onChange={handleClinicSelect}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700"
          >
            <option value="">— No clinic —</option>
            {clinics.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}{c.city ? ` (${c.city}${c.country ? ', ' + c.country : ''})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Verification Level</label>
          <div className="flex gap-1.5">
            {([0, 1, 2, 3, 4] as const).map(l => (
              <button
                key={l}
                onClick={() => setForm(f => ({ ...f, verificationLevel: l }))}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  form.verificationLevel === l ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{VERIFICATION_LEVEL_LABELS[form.verificationLevel]}</p>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => setForm(f => ({ ...f, active: !f.active }))}
            className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${form.active ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-600'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${form.active ? 'translate-x-4' : ''}`} />
          </div>
          <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
        </label>

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" fullWidth onClick={closeDetail}>Cancel</Button>
          <Button fullWidth loading={saving} onClick={save} disabled={!form.name.trim() || !form.email.trim()}>
            {isNew ? 'Add Practitioner' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 p-8 text-center">
      <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="font-medium">Select a practitioner to edit</p>
      <p className="text-sm mt-1">or click + Add to register a new one</p>
    </div>
  )

  // ── Layout ─────────────────────────────────────────────────────────────────
  if (isLg) {
    return (
      <>
        <ResizableSplitPane
          storageKey="splitPane:adminPractitioners"
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
            onClose={() => { setImportModal(null); load() }}
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
          onClose={() => { setImportModal(null); load() }}
        />
      )}
    </>
  )
}
