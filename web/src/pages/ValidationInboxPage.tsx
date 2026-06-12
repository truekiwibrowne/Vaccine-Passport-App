import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getValidatorRequests, approveValidation, rejectValidation } from '../services/validationService'
import type { ValidationRequest } from '../types/validation'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { PageShell } from '../components/layout/PageShell'
import { formatDate } from '../utils/dateUtils'
import { Spinner } from '../components/ui/Spinner'

export function ValidationInboxPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [requests, setRequests] = useState<ValidationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ValidationRequest | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    if (!user?.email) return
    setLoading(true)
    const reqs = await getValidatorRequests(user.email)
    setRequests(reqs.sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime()))
    setLoading(false)
  }

  useEffect(() => { load() }, [user?.email])

  async function approve() {
    if (!selected) return
    setSubmitting(true)
    try {
      const { authLevel } = await approveValidation(selected, notes)
      setSelected(null); setNotes('')
      await load()
      alert(`Approved! Authentication level set to ${authLevel} based on your verified practitioner status.`)
    } catch (e) { console.error('Approve error:', e); alert('Error approving. Check browser console for details.') }
    finally { setSubmitting(false) }
  }

  async function reject() {
    if (!selected) return
    setSubmitting(true)
    try {
      await rejectValidation(selected, notes)
      setSelected(null); setNotes('')
      await load()
    } catch { alert('Error rejecting.') }
    finally { setSubmitting(false) }
  }

  const statusColor = { pending: 'bg-yellow-100 text-yellow-700', approved: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-500' }

  return (
    <PageShell title="Validation Inbox" onBack={() => navigate(-1)}>
      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <p className="font-medium">No validation requests</p>
          <p className="text-sm mt-1">Requests sent to {user?.email} will appear here</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 mt-2">
          {requests.map(req => (
            <div
              key={req.request_id}
              onClick={() => req.status === 'pending' && setSelected(req)}
              className={`bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm ${req.status === 'pending' ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide ${
                      req.record_type === 'sexual_health'
                        ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300'
                        : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300'
                    }`}>
                      {req.record_type === 'sexual_health' ? '🔒 Private Health' : '💉 Vaccine'}
                    </span>
                  </div>
                  <p className="font-semibold text-gray-900 dark:text-white truncate">{req.vaccine_name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">From: {req.requestor_email}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{formatDate(req.requested_at)}</p>
                  {req.status !== 'pending' && req.authentication_level > 0 && (
                    <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5">Level {req.authentication_level} authentication</p>
                  )}
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${statusColor[req.status]}`}>
                  {req.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Review Validation Request">
        {selected && (
          <div className="space-y-4">
            <div className={`rounded-xl p-3 ${selected.record_type === 'sexual_health' ? 'bg-violet-50 dark:bg-violet-900/30' : 'bg-blue-50 dark:bg-blue-900/30'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide ${
                  selected.record_type === 'sexual_health'
                    ? 'bg-violet-200 dark:bg-violet-800 text-violet-700 dark:text-violet-200'
                    : 'bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-200'
                }`}>
                  {selected.record_type === 'sexual_health' ? '🔒 Private Health Record' : '💉 Vaccine Record'}
                </span>
              </div>
              <p className={`font-semibold ${selected.record_type === 'sexual_health' ? 'text-violet-900 dark:text-violet-100' : 'text-blue-900 dark:text-blue-100'}`}>{selected.vaccine_name}</p>
              <p className={`text-xs mt-0.5 ${selected.record_type === 'sexual_health' ? 'text-violet-600 dark:text-violet-400' : 'text-blue-600 dark:text-blue-400'}`}>Requested by: {selected.requestor_email}</p>
              <p className={`text-xs mt-0.5 ${selected.record_type === 'sexual_health' ? 'text-violet-500 dark:text-violet-400' : 'text-blue-500 dark:text-blue-400'}`}>Date: {formatDate(selected.requested_at)}</p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Authentication Level</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Automatically determined by your verified practitioner level.
                The record will receive the appropriate trust level based on your registration status.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500 dark:placeholder-gray-400"
                placeholder="Add any notes about this validation…"
              />
            </div>

            <div className="flex gap-3">
              <Button variant="danger" fullWidth loading={submitting} onClick={reject}>Reject</Button>
              <Button fullWidth loading={submitting} onClick={approve}>Approve</Button>
            </div>
          </div>
        )}
      </Modal>
    </PageShell>
  )
}
