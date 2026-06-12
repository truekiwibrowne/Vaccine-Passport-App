/**
 * Modal for requesting a new vaccine be added to the library.
 * Users must provide a name, category, and a credible reference URL.
 * The request is stored in PendingVaccines for admin review.
 */
import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { submitPendingVaccine } from '../../services/pendingSubmissionsService'
import type { VaccineCategory } from '../../types/vaccineLibrary'
import { VACCINE_CATEGORY_LABELS } from '../../types/vaccineLibrary'

interface Props {
  /** Pre-fill the vaccine name from the search query */
  initialName?: string
  onClose: () => void
}

const CATEGORIES: VaccineCategory[] = ['human_adult', 'human_child', 'animal']

export function VaccineRequestModal({ initialName = '', onClose }: Props) {
  const { user } = useAuth()

  const [form, setForm] = useState({
    name:         initialName,
    category:     'human_adult' as VaccineCategory,
    referenceUrl: '',
    diseaseTarget:'',
    manufacturer: '',
    notes:        '',
  })
  const [saving, setSaving] = useState(false)
  const [done,   setDone]   = useState(false)

  function set(field: string, val: string) {
    setForm(prev => ({ ...prev, [field]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!form.name.trim() || !form.referenceUrl.trim()) {
      alert('Vaccine name and a reference URL are required.')
      return
    }
    // Basic URL validation
    try { new URL(form.referenceUrl.trim()) }
    catch { alert('Please enter a valid URL (e.g. https://www.who.int/…).'); return }

    setSaving(true)
    try {
      await submitPendingVaccine({
        name:             form.name.trim(),
        category:         form.category,
        referenceUrl:     form.referenceUrl.trim(),
        diseaseTarget:    form.diseaseTarget.trim() || undefined,
        manufacturer:     form.manufacturer.trim() || undefined,
        notes:            form.notes.trim() || undefined,
        submittedByUid:   user.uid,
        submittedByEmail: user.email ?? '',
      })
      setDone(true)
    } catch {
      alert('Failed to submit request. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Request a New Vaccine</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Provide a credible reference link — we'll review your request and add it to the library if approved.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
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
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              An admin will review your request. If approved, the vaccine will appear in the library.
            </p>
            <button onClick={onClose} className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold">Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Vaccine / Treatment Name <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Varivax (Varicella Vaccine)"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.category}
                  onChange={e => set('category', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{VACCINE_CATEGORY_LABELS[cat]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Disease / Condition Target</label>
                <input
                  value={form.diseaseTarget}
                  onChange={e => set('diseaseTarget', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Chickenpox (Varicella)"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Manufacturer</label>
                <input
                  value={form.manufacturer}
                  onChange={e => set('manufacturer', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Merck & Co."
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reference URL <span className="text-red-500">*</span>
                  <span className="font-normal text-gray-400"> — link to WHO, CDC, EMA, or manufacturer page</span>
                </label>
                <input
                  value={form.referenceUrl}
                  onChange={e => set('referenceUrl', e.target.value)}
                  required
                  type="url"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://www.who.int/…"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Additional Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Any context that would help the admin review this request…"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1 pb-1">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-200">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
                {saving ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
