/**
 * ShareInvitesPage — inbox for all share invitations.
 *
 * Received (pending)  → Accept / Decline buttons
 * Sent (pending)      → Cancel button
 * Historical          → greyed out with status badge
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getMyInvites, acceptInvite, declineInvite, cancelInvite } from '../services/sharingService'
import type { ShareInvite } from '../types/sharing'

const RESOURCE_LABELS: Record<string, string> = {
  farmAnimal: 'Farm Animal',
  pet:        'Pet',
  dependent:  'Dependent',
}

const STATUS_STYLE: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  accepted:  'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  declined:  'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  cancelled: 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
}

export function ShareInvitesPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [invites, setInvites] = useState<ShareInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState<string | null>(null)

  async function load() {
    if (!user || !profile) return
    setLoading(true)
    try {
      const all = await getMyInvites(user.uid, profile.Email)
      setInvites(all)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user, profile]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAccept(invite: ShareInvite) {
    if (!user) return
    setActioning(invite.id)
    try {
      await acceptInvite(invite, user.uid)
      await load()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Could not accept invite.')
    } finally {
      setActioning(null)
    }
  }

  async function handleDecline(invite: ShareInvite) {
    if (!window.confirm('Decline this invite?')) return
    setActioning(invite.id)
    try {
      await declineInvite(invite.id)
      await load()
    } finally {
      setActioning(null)
    }
  }

  async function handleCancel(invite: ShareInvite) {
    if (!window.confirm('Cancel this invite?')) return
    setActioning(invite.id)
    try {
      await cancelInvite(invite.id)
      await load()
    } finally {
      setActioning(null)
    }
  }

  const received = invites.filter(i => i.inviterUid !== user?.uid)
  const sent     = invites.filter(i => i.inviterUid === user?.uid)
  const pendingReceived = received.filter(i => i.status === 'pending')

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-safe">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-4 pt-12 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Share Invites</h1>
            {pendingReceived.length > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                {pendingReceived.length} pending invite{pendingReceived.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-4 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : invites.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">No share invites yet</p>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
              When someone shares a pet, animal or dependent with you, it will appear here.
            </p>
          </div>
        ) : (
          <>
            {/* ── Received invites ── */}
            {received.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  Received
                </h2>
                <ul className="space-y-3">
                  {received.map(inv => (
                    <li key={inv.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                              {RESOURCE_LABELS[inv.resourceType] ?? inv.resourceType}
                            </span>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_STYLE[inv.status]}`}>
                              {inv.status}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{inv.resourceName}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            From <span className="font-medium">{inv.inviterName}</span>
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            {new Date(inv.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {inv.status === 'pending' && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                          <button
                            onClick={() => handleAccept(inv)}
                            disabled={actioning === inv.id}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-xl transition-colors"
                          >
                            {actioning === inv.id ? '…' : 'Accept'}
                          </button>
                          <button
                            onClick={() => handleDecline(inv)}
                            disabled={actioning === inv.id}
                            className="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 text-gray-700 dark:text-gray-200 text-sm font-semibold py-2 rounded-xl transition-colors"
                          >
                            Decline
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ── Sent invites ── */}
            {sent.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  Sent
                </h2>
                <ul className="space-y-3">
                  {sent.map(inv => (
                    <li key={inv.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                              {RESOURCE_LABELS[inv.resourceType] ?? inv.resourceType}
                            </span>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_STYLE[inv.status]}`}>
                              {inv.status}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{inv.resourceName}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            To <span className="font-medium">{inv.inviteeEmail}</span>
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            {new Date(inv.createdAt).toLocaleDateString()}
                          </p>
                        </div>

                        {inv.status === 'pending' && (
                          <button
                            onClick={() => handleCancel(inv)}
                            disabled={actioning === inv.id}
                            className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-50 transition-colors whitespace-nowrap"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
