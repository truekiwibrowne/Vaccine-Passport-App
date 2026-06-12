import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { getDependents, addDependent, updateDependent, deleteDependent, getDependentVaccines } from '../services/dependentsService'
import type { Dependent } from '../types/dependent'

interface DepStats {
  total: number
  verified: number
  pending: number
  expiringSoon: number
}

function computeAge(dob?: string): number | null {
  if (!dob) return null
  const birth = new Date(dob)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age
}

const SEX_LABELS: Record<string, string> = {
  male: 'Male',
  female: 'Female',
  intersex: 'Intersex',
  prefer_not_to_say: 'Prefer not to say',
}

export function DependentsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [dependents, setDependents] = useState<Dependent[]>([])
  const [loading, setLoading] = useState(true)
  const [depStats, setDepStats] = useState<Record<string, DepStats>>({})
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Dependent | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '',
    dateOfBirth: '',
    biologicalSex: '',
  })

  useEffect(() => {
    if (!user) return
    getDependents(user.uid)
      .then(deps => {
        setDependents(deps)
        // Fetch vaccine stats for each dependent in parallel
        deps.forEach(dep => {
          getDependentVaccines(user.uid, dep.id).then(vaxes => {
            const now = Date.now()
            const expiringSoon = vaxes.filter(v => {
              if (!v.Expiration_date) return false
              const diff = new Date(v.Expiration_date).getTime() - now
              return diff >= 0 && diff <= 30 * 86_400_000
            }).length
            setDepStats(prev => ({
              ...prev,
              [dep.id]: {
                total:    vaxes.length,
                verified: vaxes.filter(v => v.Authenticated === true).length,
                pending:  vaxes.filter(v => v.pending_validation === true).length,
                expiringSoon,
              },
            }))
          })
        })
      })
      .finally(() => setLoading(false))
  }, [user])

  function openAdd() {
    setEditing(null)
    setForm({ name: '', dateOfBirth: '', biologicalSex: '' })
    setModalOpen(true)
  }

  function openEdit(dep: Dependent) {
    setEditing(dep)
    setForm({
      name: dep.name,
      dateOfBirth: dep.dateOfBirth ?? '',
      biologicalSex: dep.biologicalSex ?? '',
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
  }

  async function handleSave() {
    if (!user || !form.name.trim()) return
    setSaving(true)
    try {
      const data = {
        name: form.name.trim(),
        ...(form.dateOfBirth ? { dateOfBirth: form.dateOfBirth } : {}),
        ...(form.biologicalSex ? { biologicalSex: form.biologicalSex } : {}),
      }
      if (editing) {
        await updateDependent(user.uid, editing.id, data)
        setDependents(prev => prev.map(d => d.id === editing.id ? { ...d, ...data } : d))
      } else {
        const id = await addDependent(user.uid, data)
        const newDep = { id, ...data, createdAt: new Date().toISOString() } as Dependent
        setDependents(prev => [newDep, ...prev])
      }
      closeModal()
    } catch (e) {
      console.error(e)
      alert('Error saving. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(dep: Dependent) {
    if (!user) return
    if (!window.confirm(`Remove ${dep.name}? This will not delete their vaccine records.`)) return
    try {
      await deleteDependent(user.uid, dep.id)
      setDependents(prev => prev.filter(d => d.id !== dep.id))
    } catch (e) {
      console.error(e)
      alert('Error deleting. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-4 pt-safe">
        <div className="flex items-center h-14 gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="flex-1 font-semibold text-gray-900 dark:text-white text-lg">Dependents</h1>
          <button
            onClick={openAdd}
            className="w-9 h-9 bg-blue-600 text-white rounded-full flex items-center justify-center active:scale-95 transition-transform"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 pb-32 flex flex-col gap-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <svg className="animate-spin w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : dependents.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-200 dark:text-gray-700" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="font-medium text-gray-500 dark:text-gray-400">No dependents yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Tap + to add a child or family member</p>
          </div>
        ) : (
          dependents.map(dep => {
            const age = computeAge(dep.dateOfBirth)
            return (
              <div
                key={dep.id}
                onClick={() => navigate(`/dependents/${dep.id}`)}
                className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm cursor-pointer active:opacity-80 transition-opacity"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white text-base">{dep.name}</p>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      {age !== null && (
                        <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                          {age} yr{age !== 1 ? 's' : ''}
                        </span>
                      )}
                      {dep.biologicalSex && dep.biologicalSex !== 'prefer_not_to_say' && (
                        <span className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                          {SEX_LABELS[dep.biologicalSex] ?? dep.biologicalSex}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); openEdit(dep) }}
                      className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 active:scale-90 transition-transform"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(dep) }}
                      className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 active:scale-90 transition-transform"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* ── Vaccine mini-dashboard ─────────────────────────────── */}
                {(() => {
                  const stats = depStats[dep.id]
                  if (!stats) {
                    // Loading skeleton
                    return (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center gap-1">
                        {[...Array(4)].map((_, i) => (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <div className="h-5 w-6 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
                            <div className="h-2 w-8 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
                          </div>
                        ))}
                      </div>
                    )
                  }
                  if (stats.total === 0) {
                    return (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-1">No vaccine records yet</p>
                      </div>
                    )
                  }
                  return (
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-1">
                        <div className="flex-1 flex flex-col items-center gap-0.5">
                          <span className="text-lg font-bold text-gray-900 dark:text-white">{stats.total}</span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium tracking-wide uppercase">Total</span>
                        </div>
                        <div className="w-px h-7 bg-gray-100 dark:bg-gray-700" />
                        <div className="flex-1 flex flex-col items-center gap-0.5">
                          <span className="text-lg font-bold text-green-500">{stats.verified}</span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium tracking-wide uppercase">Verified</span>
                        </div>
                        <div className="w-px h-7 bg-gray-100 dark:bg-gray-700" />
                        <div className="flex-1 flex flex-col items-center gap-0.5">
                          <span className="text-lg font-bold text-yellow-500">{stats.pending}</span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium tracking-wide uppercase">Pending</span>
                        </div>
                        <div className="w-px h-7 bg-gray-100 dark:bg-gray-700" />
                        <div className="flex-1 flex flex-col items-center gap-0.5">
                          <span className={`text-lg font-bold ${stats.total - stats.verified - stats.pending > 0 ? 'text-gray-500 dark:text-gray-400' : 'text-gray-400 dark:text-gray-600'}`}>
                            {stats.total - stats.verified - stats.pending}
                          </span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium tracking-wide uppercase">Recorded</span>
                        </div>
                      </div>
                      {stats.expiringSoon > 0 && (
                        <p className="text-xs text-orange-500 font-medium mt-2">
                          ⚠️ {stats.expiringSoon} vaccine{stats.expiringSoon !== 1 ? 's' : ''} expiring within 30 days
                        </p>
                      )}
                    </div>
                  )
                })()}

              </div>
            )
          })
        )}
      </div>

      {/* Add / Edit modal */}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Dependent' : 'Add Dependent'}>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="First name or nickname"
              className="w-full px-3.5 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Date of Birth (optional)</label>
            <input
              type="date"
              value={form.dateOfBirth}
              onChange={e => setForm(f => ({ ...f, dateOfBirth: e.target.value }))}
              className="w-full px-3.5 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Optional — used only for age-appropriate vaccine suggestions</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Biological Sex (optional)</label>
            <select
              value={form.biologicalSex}
              onChange={e => setForm(f => ({ ...f, biologicalSex: e.target.value }))}
              className="w-full px-3.5 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Prefer not to say</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="intersex">Intersex</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" fullWidth onClick={closeModal}>Cancel</Button>
            <Button
              fullWidth
              loading={saving}
              disabled={!form.name.trim()}
              onClick={handleSave}
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
