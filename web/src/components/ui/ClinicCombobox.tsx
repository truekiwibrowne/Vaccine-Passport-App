/**
 * Shared clinic combobox used on all Add Vaccine pages.
 * Accepts a pre-filtered list of Clinic records and provides
 * type-ahead search with a free-text fallback.
 *
 * If the user can't find their clinic they can submit a request via the
 * built-in modal — the request is stored in PendingClinics for admin review.
 */
import { useState, useEffect, useRef } from 'react'
import type { Clinic } from '../../types/admin'
import type { VaccineContext } from '../../types/pendingSubmissions'
import { useAuth } from '../../contexts/AuthContext'
import { submitPendingClinic } from '../../services/pendingSubmissionsService'

interface Props {
  value:    string
  onChange: (name: string) => void
  clinics:  Clinic[]
  label?:   string
  placeholder?: string
  /** User's current country — clinics in this country are sorted to the top */
  userCountry?: string
  /**
   * When provided (i.e. the combobox is embedded in a vaccine-add form),
   * the context is stored with the pending request so the vaccine record can
   * be updated when the admin approves the clinic.
   */
  vaccineContext?: VaccineContext
  /**
   * Called when the user submits a clinic request.  Should save the vaccine
   * record and return the new record ID (or null on failure).  The ID is
   * stored in the pending-clinic document so the approve handler can find
   * the record and fill in the Clinic field.
   */
  onSaveVaccine?: () => Promise<string | null>
  /**
   * Called when the user dismisses the success screen after a pending request
   * has been submitted (and the vaccine was saved).  Use this to navigate
   * away from the vaccine-add form.
   */
  onRequestComplete?: () => void
}

const EMPTY_FORM = {
  name: '', phone: '', address: '', city: '', country: '', website: '', notes: '',
}

export function ClinicCombobox({
  value, onChange, clinics,
  label = 'Clinic / Hospital',
  placeholder = 'Search registered clinics or type any name…',
  userCountry,
  vaccineContext,
  onSaveVaccine,
  onRequestComplete,
}: Props) {
  const { user, profile } = useAuth()
  const [open,              setOpen]             = useState(false)
  const [showModal,         setShowModal]        = useState(false)
  const [form,              setForm]             = useState(EMPTY_FORM)
  const [saving,            setSaving]           = useState(false)
  const [done,              setDone]             = useState(false)
  const [vaccineSaved,      setVaccineSaved]     = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  let filtered = clinics
    .filter(c => !value.trim() || c.name.toLowerCase().includes(value.toLowerCase()))

  if (userCountry) {
    const uc = userCountry.toLowerCase()
    filtered = [
      ...filtered.filter(c => c.country?.toLowerCase() === uc),
      ...filtered.filter(c => c.country?.toLowerCase() !== uc),
    ]
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function openModal() {
    setOpen(false)
    setDone(false)
    // Pre-fill name with whatever the user typed
    setForm({ ...EMPTY_FORM, name: value, country: userCountry ?? profile?.currentCountry ?? '' })
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setForm(EMPTY_FORM)
    setVaccineSaved(false)
  }

  function set(field: string, val: string) {
    setForm(prev => ({ ...prev, [field]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim() || !form.city.trim() || !form.country.trim()) {
      alert('Please fill in all required fields (name, phone, address, city, country).')
      return
    }
    setSaving(true)
    try {
      // 1. Save the vaccine record first (so we can link it to this pending request)
      let vaccineRecordId: string | null = null
      if (onSaveVaccine) {
        vaccineRecordId = await onSaveVaccine()
        if (vaccineRecordId === null) {
          alert('Failed to save your vaccine record. Please check the vaccine details and try again.')
          setSaving(false)
          return
        }
        setVaccineSaved(true)
      }

      // 2. Build context with the saved record ID so the approve handler can
      //    find and update it instead of creating a duplicate.
      const contextWithId: VaccineContext | undefined = vaccineContext
        ? { ...vaccineContext, ...(vaccineRecordId ? { userVaccineRecordId: vaccineRecordId } : {}) }
        : undefined

      // 3. Submit the pending clinic request
      await submitPendingClinic({
        name:             form.name.trim(),
        phone:            form.phone.trim(),
        address:          form.address.trim(),
        city:             form.city.trim(),
        country:          form.country.trim(),
        website:          form.website.trim() || undefined,
        notes:            form.notes.trim() || undefined,
        vaccineContext:   contextWithId,
        submittedByUid:   user.uid,
        submittedByEmail: user.email ?? '',
      })
      setDone(true)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit request. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div ref={ref} className="relative">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
        <input
          type="text"
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full px-3 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500 dark:placeholder-gray-400"
        />
        {open && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-xl overflow-hidden">
            {filtered.length > 0 && (
              <ul className="max-h-48 overflow-y-auto">
                {filtered.map(c => (
                  <li
                    key={c.id}
                    onMouseDown={e => { e.preventDefault(); onChange(c.name); setOpen(false) }}
                    className="px-4 py-2.5 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{c.name}</p>
                        {(c.city || c.country) && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                            {[c.city, c.country].filter(Boolean).join(', ')}
                          </p>
                        )}
                      </div>
                      {c.verified && (
                        <span className="text-xs text-green-600 dark:text-green-400 font-medium flex-shrink-0">✓ Verified</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {/* Always-visible "request" footer */}
            <button
              onMouseDown={e => { e.preventDefault(); openModal() }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-t border-gray-100 dark:border-gray-700 transition-colors"
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Can't find your clinic? Request to add it
            </button>
          </div>
        )}
      </div>

      {/* ── Request modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50" onClick={e => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Request a Clinic</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Your request will be reviewed by an admin before being added.</p>
              </div>
              <button onClick={closeModal} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {done ? (
              <div className="px-5 py-8 text-center">
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="font-semibold text-gray-900 dark:text-white mb-1">Request submitted!</p>
                {vaccineSaved ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                    Your vaccine record has been saved. Once the clinic is approved by an admin, it will be automatically linked to your record — no need to re-add it.
                  </p>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                    An admin will review your request and add the clinic if approved.
                  </p>
                )}
                <button
                  onClick={() => { closeModal(); onRequestComplete?.() }}
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Clinic / Hospital Name <span className="text-red-500">*</span></label>
                    <input value={form.name} onChange={e => set('name', e.target.value)} required className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. City Medical Centre" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number <span className="text-red-500">*</span></label>
                    <input value={form.phone} onChange={e => set('phone', e.target.value)} required type="tel" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="+1 555 000 0000" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Website</label>
                    <input value={form.website} onChange={e => set('website', e.target.value)} type="url" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://…" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Street Address <span className="text-red-500">*</span></label>
                    <input value={form.address} onChange={e => set('address', e.target.value)} required className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="123 Main St" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">City <span className="text-red-500">*</span></label>
                    <input value={form.city} onChange={e => set('city', e.target.value)} required className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Springfield" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Country <span className="text-red-500">*</span></label>
                    <input value={form.country} onChange={e => set('country', e.target.value)} required className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="United States" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Additional Notes</label>
                    <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Any extra details that would help the admin verify this clinic…" />
                  </div>
                </div>
                <div className="flex gap-2 pt-1 pb-1">
                  <button type="button" onClick={closeModal} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-200">Cancel</button>
                  <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
                    {saving ? 'Submitting…' : 'Submit Request'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
