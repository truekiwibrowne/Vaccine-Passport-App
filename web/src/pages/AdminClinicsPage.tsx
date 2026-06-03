import { useState, useEffect, useRef } from 'react'
import { getClinics, addClinic, updateClinic, deleteClinic, bulkUpsertClinicsById } from '../services/clinicsService'
import { downloadClinicCSV, parseClinicCSV } from '../utils/clinicsCsv'
import type { ClinicParseResult } from '../utils/clinicsCsv'
import type { Clinic } from '../types/admin'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Spinner } from '../components/ui/Spinner'
import { useIsLg } from '../hooks/useMediaQuery'

const EMPTY_FORM = { name: '', address: '', city: '', country: '', phone: '', website: '', verified: false }

// ── Import confirmation modal ─────────────────────────────────────────────────

interface ImportModalProps {
  filename:  string
  result:    ClinicParseResult
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
              {done.updated > 0 && <span>{done.updated} clinic{done.updated !== 1 ? 's' : ''} updated · </span>}
              {done.added   > 0 && <span>{done.added} new clinic{done.added !== 1 ? 's' : ''} added</span>}
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
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Row {e.rowNumber}: {e.raw['name'] || '(no name)'}</p>
                      <p className="text-[11px] text-red-500 dark:text-red-400 mt-0.5">{e.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-300">
              <strong>Note:</strong> Updates merge into existing records. Clinics not in the CSV are left untouched.
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

// ── Shared form ────────────────────────────────────────────────────────────────
function ClinicForm({
  form,
  setForm,
  saving,
  isNew,
  onSave,
  onCancel,
}: {
  form: typeof EMPTY_FORM
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>
  saving: boolean
  isNew: boolean
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="space-y-3">
      <Input label="Clinic Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="City Medical Centre" />
      <Input label="Address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="123 Main Street" />
      <div className="flex gap-2">
        <Input label="City" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Nairobi" />
        <Input label="Country" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="Kenya" />
      </div>
      <Input label="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} type="tel" placeholder="+254 700 000000" />
      <Input label="Website" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://clinic.example.com" />
      <label className="flex items-center gap-3 cursor-pointer pt-1">
        <div
          onClick={() => setForm(f => ({ ...f, verified: !f.verified }))}
          className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${form.verified ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-600'}`}
        >
          <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${form.verified ? 'translate-x-4' : ''}`} />
        </div>
        <span className="text-sm text-gray-700 dark:text-gray-300">Mark as Verified Clinic</span>
      </label>
      <div className="flex gap-3 pt-2">
        <Button variant="secondary" fullWidth onClick={onCancel}>Cancel</Button>
        <Button fullWidth loading={saving} onClick={onSave} disabled={!form.name.trim()}>
          {isNew ? 'Add Clinic' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function AdminClinicsPage() {
  const isLg = useIsLg()
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [countryFilter, setCountryFilter] = useState<string>('all')
  const [verifiedFilter, setVerifiedFilter] = useState<'all' | 'verified' | 'unverified'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // CSV
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importModal, setImportModal] = useState<{ filename: string; result: ClinicParseResult } | null>(null)

  const showDetail = isNew || selectedId !== null

  async function load() {
    setLoading(true)
    try { setClinics(await getClinics()) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  function openAdd() { setIsNew(true); setSelectedId(null); setForm(EMPTY_FORM) }
  function openEdit(c: Clinic) {
    setIsNew(false)
    setSelectedId(c.id)
    setForm({ name: c.name, address: c.address, city: c.city, country: c.country, phone: c.phone, website: c.website, verified: c.verified })
  }
  function closeDetail() { setSelectedId(null); setIsNew(false) }

  async function save() {
    setSaving(true)
    try {
      if (selectedId) {
        await updateClinic(selectedId, form)
        setClinics(prev => prev.map(c => c.id === selectedId ? { ...c, ...form } : c))
      } else {
        await addClinic(form)
        await load()
      }
      closeDetail()
    } catch (e) {
      alert(`Error saving clinic:\n${e instanceof Error ? e.message : String(e)}`)
    } finally { setSaving(false) }
  }

  async function remove(c: Clinic, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`Delete "${c.name}"?`)) return
    try {
      await deleteClinic(c.id)
      if (selectedId === c.id) closeDetail()
      setClinics(prev => prev.filter(x => x.id !== c.id))
    } catch { alert('Error deleting.') }
  }

  // CSV handlers
  function handleExportCSV() { downloadClinicCSV(clinics) }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      setImportModal({ filename: file.name, result: parseClinicCSV(text) })
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
    await bulkUpsertClinicsById(rows)
    await load()
  }

  // Derive unique sorted countries from loaded data
  const countries = Array.from(new Set(clinics.map(c => c.country).filter(Boolean))).sort()

  const filtered = clinics.filter(c => {
    if (countryFilter !== 'all' && c.country !== countryFilter) return false
    if (verifiedFilter === 'verified'   && !c.verified) return false
    if (verifiedFilter === 'unverified' &&  c.verified) return false
    const q = search.toLowerCase()
    return !q ||
      c.name.toLowerCase().includes(q) ||
      c.city.toLowerCase().includes(q) ||
      c.country.toLowerCase().includes(q) ||
      c.address.toLowerCase().includes(q)
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
            placeholder="Search clinics…"
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:placeholder-gray-400"
          />
        </div>
        <Button size="sm" onClick={openAdd}>+ Add</Button>
      </div>

      {/* CSV export / import */}
      <div className="flex gap-2">
        <button
          onClick={handleExportCSV}
          disabled={clinics.length === 0}
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

      {/* Filters row */}
      <div className="flex flex-col gap-2">
        {/* Country filter */}
        {countries.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setCountryFilter('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${countryFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
            >
              All countries <span className="opacity-60 ml-1">{clinics.length}</span>
            </button>
            {countries.map(c => (
              <button
                key={c}
                onClick={() => setCountryFilter(c)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${countryFilter === c ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
              >
                {c} <span className="opacity-60 ml-1">{clinics.filter(x => x.country === c).length}</span>
              </button>
            ))}
          </div>
        )}

        {/* Verified filter */}
        <div className="flex gap-1.5">
          {(['all', 'verified', 'unverified'] as const).map(v => (
            <button
              key={v}
              onClick={() => setVerifiedFilter(v)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${
                verifiedFilter === v
                  ? v === 'verified' ? 'bg-green-600 text-white' : v === 'unverified' ? 'bg-gray-600 text-white' : 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {v === 'all' ? 'All' : v === 'verified' ? '✓ Verified' : 'Unverified'}
              {v === 'all' && <span className="opacity-60 ml-1">{clinics.length}</span>}
              {v !== 'all' && <span className="opacity-60 ml-1">{clinics.filter(x => v === 'verified' ? x.verified : !x.verified).length}</span>}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <p className="font-medium">{clinics.length === 0 ? 'No clinics yet' : 'No clinics match your filters'}</p>
          <p className="text-sm mt-1">{clinics.length === 0 ? 'Add your first clinic or import a CSV' : 'Try adjusting the country or verified filter'}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {filtered.length === clinics.length ? `${clinics.length} clinic${clinics.length !== 1 ? 's' : ''}` : `${filtered.length} of ${clinics.length} clinics`}
          </p>
          {filtered.map(c => (
            <div
              key={c.id}
              onClick={() => openEdit(c)}
              className={`bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border cursor-pointer transition-all active:scale-[0.98] ${
                selectedId === c.id
                  ? 'border-blue-400 dark:border-blue-500 ring-1 ring-blue-400'
                  : 'border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">{c.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${c.verified ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                      {c.verified ? '✓ Verified' : 'Unverified'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{[c.address, c.city, c.country].filter(Boolean).join(', ')}</p>
                  {c.phone && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{c.phone}</p>}
                </div>
                <button onClick={e => remove(c, e)} className="p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // ── Detail / edit panel ────────────────────────────────────────────────────
  const detailPanel = showDetail ? (
    <div className="p-4 lg:p-6">
      {!isLg && (
        <button onClick={closeDetail} className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 mb-5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to clinics
        </button>
      )}
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5">
        {isNew ? 'New Clinic' : 'Edit Clinic'}
      </h2>
      <ClinicForm form={form} setForm={setForm} saving={saving} isNew={isNew} onSave={save} onCancel={closeDetail} />
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 p-8 text-center">
      <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
      <p className="font-medium">Select a clinic to edit</p>
      <p className="text-sm mt-1">or click + Add to create a new one</p>
    </div>
  )

  // ── Layout ─────────────────────────────────────────────────────────────────
  if (isLg) {
    return (
      <>
        <div className="flex flex-1 overflow-hidden border-t border-gray-200 dark:border-gray-700">
          <div className="w-80 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto bg-white dark:bg-gray-800">
            {listPanel}
          </div>
          <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
            {detailPanel}
          </div>
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
