/**
 * ShareManageModal — reusable modal for managing shared access to any resource.
 *
 * Shows:
 *  - Current members (owner badge, remove button)
 *  - Pending outgoing invites (cancel button)
 *  - Email form to invite a new user
 *
 * Props:
 *  resourceType   — 'farmAnimal' | 'pet' | 'dependent'
 *  resourceId     — Firestore doc ID of the resource
 *  resourceName   — display name shown in the invite notification
 *  ownerId        — UID of the resource owner (to prevent removing them)
 *  currentUid     — UID of the signed-in user (to check ownership)
 */

import { useState, useEffect, useCallback } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'
import {
  sendShareInvite, cancelInvite,
  removeShareMember, getResourceMembers, getPendingInvitesForResource,
} from '../../services/sharingService'
import type { ShareResourceType, UserPublicProfile, ShareInvite } from '../../types/sharing'
import { useAuth } from '../../contexts/AuthContext'

interface Props {
  open: boolean
  onClose: () => void
  resourceType: ShareResourceType
  resourceId: string
  resourceName: string
  ownerId: string
}

export function ShareManageModal({
  open, onClose, resourceType, resourceId, resourceName, ownerId,
}: Props) {
  const { user, profile } = useAuth()
  const [members, setMembers] = useState<UserPublicProfile[]>([])
  const [pendingInvites, setPendingInvites] = useState<ShareInvite[]>([])
  const [loading, setLoading] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'searching' | 'sending' | 'sent' | 'error'>('idle')
  const [inviteError, setInviteError] = useState('')

  const isOwner = user?.uid === ownerId

  const reload = useCallback(async () => {
    if (!open) return
    setLoading(true)
    try {
      const [m, p] = await Promise.all([
        getResourceMembers(resourceType, resourceId),
        getPendingInvitesForResource(resourceId),
      ])
      setMembers(m)
      setPendingInvites(p)
    } finally {
      setLoading(false)
    }
  }, [open, resourceType, resourceId])

  useEffect(() => { reload() }, [reload])

  async function handleInvite() {
    if (!user || !profile || !inviteEmail.trim()) return
    setInviteStatus('sending')
    setInviteError('')
    try {
      await sendShareInvite(
        user.uid,
        profile.Full_Name || 'A user',
        inviteEmail.trim(),
        resourceType,
        resourceId,
        resourceName,
      )
      setInviteEmail('')
      setInviteStatus('sent')
      await reload()
      setTimeout(() => setInviteStatus('idle'), 3000)
    } catch (err: unknown) {
      setInviteStatus('error')
      setInviteError(err instanceof Error ? err.message : 'Failed to send invite.')
    }
  }

  async function handleRemoveMember(uid: string) {
    if (!window.confirm('Remove this person\'s access?')) return
    try {
      await removeShareMember(resourceType, resourceId, uid)
      await reload()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Could not remove member.')
    }
  }

  async function handleCancelInvite(inviteId: string) {
    if (!window.confirm('Cancel this invite?')) return
    await cancelInvite(inviteId)
    await reload()
  }

  return (
    <Modal open={open} onClose={onClose} title="Manage Access">
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-5">

          {/* ── Current members ── */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Who has access
            </h3>
            <ul className="space-y-2">
              {members.map(m => (
                <li key={m.uid} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl px-3 py-2">
                  {m.photoURL ? (
                    <img src={m.photoURL} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-300">
                        {m.displayName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{m.displayName}</p>
                    <p className="text-xs text-gray-400 truncate">{m.email}</p>
                  </div>
                  {m.uid === ownerId && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                      Owner
                    </span>
                  )}
                  {m.uid !== ownerId && isOwner && (
                    <button
                      onClick={() => handleRemoveMember(m.uid)}
                      className="text-red-400 hover:text-red-600 dark:hover:text-red-300 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Remove access"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                  {m.uid !== ownerId && m.uid === user?.uid && !isOwner && (
                    <button
                      onClick={() => handleRemoveMember(m.uid)}
                      className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    >
                      Leave
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {/* ── Pending invites ── */}
          {pendingInvites.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Pending invites
              </h3>
              <ul className="space-y-2">
                {pendingInvites.map(inv => (
                  <li key={inv.id} className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-3 py-2">
                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                      <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white truncate">{inv.inviteeEmail}</p>
                      <p className="text-xs text-amber-600 dark:text-amber-400">Awaiting response</p>
                    </div>
                    {isOwner && (
                      <button
                        onClick={() => handleCancelInvite(inv.id)}
                        className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ── Invite form (owner only) ── */}
          {isOwner && (
            <section>
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Invite someone by email
              </h3>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => { setInviteEmail(e.target.value); setInviteStatus('idle'); setInviteError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleInvite()}
                  placeholder="email@example.com"
                  className="flex-1 text-sm border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Button
                  onClick={handleInvite}
                  disabled={!inviteEmail.trim() || inviteStatus === 'sending'}
                  className="!px-4 !py-2 !text-sm"
                >
                  {inviteStatus === 'sending' ? '…' : 'Send'}
                </Button>
              </div>

              {inviteStatus === 'sent' && (
                <p className="mt-2 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Invite sent — they'll see it next time they open the app.
                </p>
              )}
              {inviteStatus === 'error' && (
                <p className="mt-2 text-xs text-red-500 dark:text-red-400">{inviteError}</p>
              )}
              <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                The other user must already have an account. They will see the invite in their Share Invites inbox.
              </p>
            </section>
          )}
        </div>
      )}
    </Modal>
  )
}
