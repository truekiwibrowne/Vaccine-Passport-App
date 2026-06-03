import { useState, useEffect } from 'react'
import { getClinics, addClinic, updateClinic, deleteClinic } from '../services/clinicsService'
import type { Clinic } from '../types/admin'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Spinner } from '../components/ui/Spinner'
import { useIsLg } from '../hooks/useMediaQuery'

const EMPTY_FORM = { name: '', address: '', city: '', country: '', phone: '', website: '', verified: false }

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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

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
      console.error('Clinic save error:', e)
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

  const filtered = clinics.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.city.toLowerCase().includes(search.toLowerCase()) ||
    c.country.toLowerCase().includes(search.toLowerCase())
  )

  // ── List panel ─────────────────────────────────────────────────────────────
  const listPanel = (
    <div className="p-4 flex flex-col gap-3 pb-10">
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

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <p className="font-medium">No clinics found</p>
          <p className="text-sm mt-1">Add your first clinic using the button above</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-400 dark:text-gray-500">{filtered.length} clinic{filtered.length !== 1 ? 's' : ''}</p>
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
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${c.verified ? 'bg-green-50 text-green-700' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
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
      <div className="flex flex-1 overflow-hidden border-t border-gray-200 dark:border-gray-700">
        <div className="w-80 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto bg-white dark:bg-gray-800">
          {listPanel}
        </div>
        <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          {detailPanel}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1">
      {showDetail ? detailPanel : listPanel}
    </div>
  )
}
