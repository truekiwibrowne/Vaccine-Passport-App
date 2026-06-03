import { useState, useEffect } from 'react'
import { getPractitioners, addPractitioner, updatePractitioner, deletePractitioner } from '../services/practitionersService'
import { getClinics } from '../services/clinicsService'
import type { Practitioner, Clinic } from '../types/admin'
import { VERIFICATION_LEVEL_LABELS, VERIFICATION_LEVEL_COLOURS } from '../types/admin'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Spinner } from '../components/ui/Spinner'
import { useAuth } from '../contexts/AuthContext'
import { useIsLg } from '../hooks/useMediaQuery'

const EMPTY_FORM = {
  name: '', email: '', clinicId: '', clinicName: '', speciality: '',
  verificationLevel: 0 as Practitioner['verificationLevel'],
  verifiedBy: '', verifiedAt: '', active: true,
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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const showDetail = isNew || selectedId !== null
  const selectedPractitioner = practitioners.find(p => p.id === selectedId) ?? null

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
    setForm({ name: p.name, email: p.email, clinicId: p.clinicId, clinicName: p.clinicName, speciality: p.speciality, verificationLevel: p.verificationLevel, verifiedBy: p.verifiedBy, verifiedAt: p.verifiedAt, active: p.active })
  }
  function closeDetail() { setSelectedId(null); setIsNew(false) }

  function handleClinicSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const clinic = clinics.find(c => c.id === e.target.value)
    setForm(f => ({ ...f, clinicId: clinic?.id ?? '', clinicName: clinic?.name ?? '' }))
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
      console.error('Practitioner save error:', e)
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

  const filtered = practitioners.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.email.toLowerCase().includes(search.toLowerCase()) ||
    p.clinicName?.toLowerCase().includes(search.toLowerCase())
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
            placeholder="Search practitioners…"
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:placeholder-gray-400"
          />
        </div>
        <Button size="sm" onClick={openAdd}>+ Add</Button>
      </div>

      {!isLg && <HonourChainInfo />}

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <p className="font-medium">No practitioners found</p>
          <p className="text-sm mt-1">Add verified medical practitioners above</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-400 dark:text-gray-500">{filtered.length} practitioner{filtered.length !== 1 ? 's' : ''}</p>
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
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${VERIFICATION_LEVEL_COLOURS[p.verificationLevel]}`}>
                      L{p.verificationLevel} · {VERIFICATION_LEVEL_LABELS[p.verificationLevel]}
                    </span>
                    {!p.active && <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full font-medium">Inactive</span>}
                  </div>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 truncate">{p.email}</p>
                  {p.clinicName && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{p.clinicName}</p>}
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
        <Input label="Speciality" value={form.speciality} onChange={e => setForm(f => ({ ...f, speciality: e.target.value }))} placeholder="General Practitioner" />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Associated Clinic</label>
          <select
            value={form.clinicId}
            onChange={handleClinicSelect}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700"
          >
            <option value="">— No clinic —</option>
            {clinics.map(c => <option key={c.id} value={c.id}>{c.name} ({c.city})</option>)}
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
