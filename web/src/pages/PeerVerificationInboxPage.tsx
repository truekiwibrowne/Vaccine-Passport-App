import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getPendingRequestsForApprover, approvePeerVerificationDoc, rejectPeerVerificationDoc } from '../services/peerVerificationService'
import { peerUpgradePractitioner } from '../services/practitionersService'
import type { PeerVerification } from '../types/admin'
import { VERIFICATION_LEVEL_LABELS, VERIFICATION_LEVEL_COLOURS } from '../types/admin'
import { PageShell } from '../components/layout/PageShell'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'

export function PeerVerificationInboxPage() {
  const { user, profile } = useAuth()
  const [requests, setRequests] = useState<PeerVerification[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PeerVerification | null>(null)
  const [responseNotes, setResponseNotes] = useState('')
  const [acting, setActing] = useState(false)

  async function load() {
    if (!user?.email) return
    setLoading(true)
    try {
      setRequests(await getPendingRequestsForApprover(user.email))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user?.email])

  async function approve(req: PeerVerification) {
    if (!profile?.Full_Name) return
    setActing(true)
    try {
      // 1. Update the Peer_Verifications doc
      await approvePeerVerificationDoc(req.id, responseNotes)
      // 2. Upgrade the target's Practitioners doc (Firestore rule enforces your level ≥ req.target_level + 1)
      await peerUpgradePractitioner(req.requester_uid, req.target_level, profile.Full_Name)
      setSelected(null)
      setResponseNotes('')
      await load()
    } catch (e) {
      console.error('Approve error:', e)
      const msg = e instanceof Error ? e.message : String(e)
      alert(`Error approving:\n${msg}\n\nMake sure your own verification level is high enough (at least level ${req.target_level + 1}).`)
    } finally {
      setActing(false)
    }
  }

  async function reject(req: PeerVerification) {
    setActing(true)
    try {
      await rejectPeerVerificationDoc(req.id, responseNotes)
      setSelected(null)
      setResponseNotes('')
      await load()
    } catch (e) {
      console.error('Reject error:', e)
      alert('Error rejecting request.')
    } finally {
      setActing(false)
    }
  }

  return (
    <PageShell title="Peer Verification Inbox">
      <div className="px-4 py-4 space-y-3 pb-10">

        {/* Explainer */}
        <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-3 border border-blue-100 dark:border-blue-700">
          <p className="text-xs font-semibold text-blue-800 dark:text-blue-200 mb-1">How peer verification works</p>
          <p className="text-xs text-blue-600 dark:text-blue-400">
            Practitioners can request an upgrade from you. You can approve requests for level{' '}
            <strong>one below your own</strong> — e.g. if you are level 3, you can approve level 2 requests.
            Approving updates their Practitioners record and the vaccines they verify will carry a higher trust level.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : requests.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">
            <svg className="w-10 h-10 mx-auto mb-3 text-gray-200 dark:text-gray-700" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="font-medium">No pending requests</p>
            <p className="text-sm mt-1">Requests addressed to your email will appear here</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-gray-400 dark:text-gray-500">{requests.length} pending request{requests.length !== 1 ? 's' : ''}</p>
            {requests.map(req => (
              <div key={req.id} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{req.requester_name}</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">{req.requester_email}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${VERIFICATION_LEVEL_COLOURS[req.target_level as 0|1|2|3|4] ?? 'bg-gray-100 text-gray-500'}`}>
                    Requesting L{req.target_level}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
                  <span>→ {VERIFICATION_LEVEL_LABELS[req.target_level] ?? `Level ${req.target_level}`}</span>
                  <span>·</span>
                  <span>{new Date(req.created_at).toLocaleDateString()}</span>
                </div>

                {req.notes && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded-lg p-2 mb-3 italic">"{req.notes}"</p>
                )}

                {selected?.id === req.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={responseNotes}
                      onChange={e => setResponseNotes(e.target.value)}
                      placeholder="Optional response notes…"
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none dark:placeholder-gray-400"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        fullWidth
                        onClick={() => { setSelected(null); setResponseNotes('') }}
                      >
                        Cancel
                      </Button>
                      <button
                        onClick={() => reject(req)}
                        disabled={acting}
                        className="flex-1 py-2 rounded-xl text-sm font-semibold bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <Button size="sm" fullWidth loading={acting} onClick={() => approve(req)}>
                        Approve
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setSelected(req); setResponseNotes('') }}
                    className="w-full py-2 rounded-xl text-sm font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    Review Request
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  )
}
