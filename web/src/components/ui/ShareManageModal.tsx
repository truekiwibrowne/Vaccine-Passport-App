import { useState, useEffect, useCallback } from 'react'
import { Modal } from './Modal'
import { removeShareMember, getResourceMembers } from '../../services/sharingService'
import {
  createShareCode, cancelShareCode, getActiveShareCodeForResource,
  isShareCodeExpired, shareCodeTimeUntilExpiry,
} from '../../services/shareCodeService'
import type { ShareResourceType, UserPublicProfile } from '../../types/sharing'
import type { ShareCode } from '../../types/shareCode'
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
  const { user } = useAuth()
  const [members, setMembers]     = useState<UserPublicProfile[]>([])
  const [loading, setLoading]     = useState(false)
  const [activeCode, setActiveCode] = useState<ShareCode | null>(null)
  const [codeLoading, setCodeLoading] = useState(false)
  const [generating, setGenerating]   = useState(false)
  const [cancelling, setCancelling]   = useState(false)
  const [copied, setCopied]           = useState(false)
  const [codeError, setCodeError]     = useState<string | null>(null)

  const isOwner = user?.uid === ownerId

  const reload = useCallback(async () => {
    if (!open || !user) return
    setLoading(true)
    try {
      const [m] = await Promise.all([
        getResourceMembers(resourceType, resourceId),
      ])
      setMembers(m)
    } finally {
      setLoading(false)
    }
  }, [open, resourceType, resourceId, user])

  const reloadCode = useCallback(async () => {
    if (!open || !isOwner || !user) return
    setCodeLoading(true)
    try {
      const sc = await getActiveShareCodeForResource(user.uid, resourceType, resourceId)
      setActiveCode(sc && !isShareCodeExpired(sc) ? sc : null)
    } catch {
      setActiveCode(null)
    } finally {
      setCodeLoading(false)
    }
  }, [open, isOwner, user, resourceType, resourceId])

  useEffect(() => {
    reload()
    reloadCode()
  }, [reload, reloadCode])

  async function handleRemoveMember(uid: string) {
    if (!window.confirm('Remove this person\'s access?')) return
    try {
      await removeShareMember(resourceType, resourceId, uid)
      await reload()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Could not remove member.')
    }
  }

  async function handleGenerate() {
    if (!user) return
    setGenerating(true)
    setCodeError(null)
    try {
      await createShareCode(user.uid, resourceType, resourceId, resourceName)
      await reloadCode()
    } catch (e) {
      setCodeError((e as Error)?.message ?? 'Failed to generate code.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleCancel() {
    if (!activeCode || !user) return
    setCancelling(true)
    try {
      await cancelShareCode(activeCode.code, user.uid)
      setActiveCode(null)
    } catch (e) {
      setCodeError((e as Error)?.message ?? 'Failed to cancel code.')
    } finally {
      setCancelling(false)
    }
  }

  function handleCopy() {
    if (!activeCode) return
    navigator.clipboard.writeText(activeCode.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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

          {/* ── Share code (owner only) ── */}
          {isOwner && (
            <section>
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Invite someone
              </h3>

              {codeLoading ? (
                <div className="flex justify-center py-4">
                  <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : activeCode ? (
                <>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    Share this code — the recipient enters it at <strong className="text-gray-600 dark:text-gray-300">Profile → Claim Code</strong>.
                  </p>

                  {/* Code display */}
                  <div className="flex items-center justify-center gap-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl py-5 mb-3">
                    <span className="font-mono text-3xl font-bold tracking-[0.25em] text-gray-900 dark:text-white select-all">
                      {activeCode.code}
                    </span>
                    <button
                      onClick={handleCopy}
                      className="p-2 rounded-lg bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-500 transition-colors"
                      title="Copy code"
                    >
                      {copied ? (
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 justify-center mb-3">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Expires in {shareCodeTimeUntilExpiry(activeCode)}
                  </div>

                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="w-full py-2.5 text-sm font-semibold text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-xl disabled:opacity-60 active:bg-red-50 dark:active:bg-red-900/20"
                  >
                    {cancelling ? 'Cancelling…' : 'Cancel Code'}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                    Generate a code and share it with the person you want to invite. They enter it at <strong className="text-gray-500 dark:text-gray-400">Profile → Claim Code</strong>.
                  </p>
                  {codeError && (
                    <p className="text-xs text-red-500 dark:text-red-400 mb-2">{codeError}</p>
                  )}
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl disabled:opacity-60 active:bg-blue-700 flex items-center justify-center gap-2"
                  >
                    {generating ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Generating…
                      </>
                    ) : 'Generate Share Code'}
                  </button>
                </>
              )}
            </section>
          )}
        </div>
      )}
    </Modal>
  )
}
