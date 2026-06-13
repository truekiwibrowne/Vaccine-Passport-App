import { useState, useEffect } from 'react'
import {
  createTransferCode, cancelTransferCode, getSenderPendingTransfers,
  timeUntilExpiry, isCodeExpired,
} from '../../services/transferService'
import type { TransferCode, TransferType } from '../../types/transfer'

interface Props {
  senderUid: string
  type: TransferType
  entityIds: string[]
  entityNames: string[]
  vaccineCount: number
  onClose: () => void
}

export function TransferCodeModal({ senderUid, type, entityIds, entityNames, vaccineCount, onClose }: Props) {
  const [phase, setPhase]         = useState<'loading' | 'ready' | 'generating' | 'error'>('loading')
  const [existing, setExisting]   = useState<TransferCode | null>(null)
  const [code, setCode]           = useState<string | null>(null)
  const [copied, setCopied]       = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  // Check if there's already an active code for these entities
  useEffect(() => {
    getSenderPendingTransfers(senderUid)
      .then(transfers => {
        // Find a matching pending code for this exact set of entities
        const match = transfers.find(t =>
          t.type === type &&
          t.entityIds.length === entityIds.length &&
          entityIds.every(id => t.entityIds.includes(id)) &&
          !isCodeExpired(t)
        )
        if (match) {
          setExisting(match)
          setCode(match.code)
        }
        setPhase('ready')
      })
      .catch(() => setPhase('ready'))
  }, [senderUid, type, entityIds])

  async function handleGenerate() {
    setPhase('generating')
    setError(null)
    try {
      const newCode = await createTransferCode(senderUid, type, entityIds, entityNames, vaccineCount)
      setCode(newCode)
      setExisting(null)
      setPhase('ready')
    } catch (e) {
      setError((e as Error)?.message ?? 'Failed to generate code.')
      setPhase('error')
    }
  }

  async function handleCancel() {
    if (!code) return
    setCancelling(true)
    try {
      await cancelTransferCode(code, senderUid)
      setCode(null)
      setExisting(null)
    } catch (e) {
      setError((e as Error)?.message ?? 'Failed to cancel code.')
    } finally {
      setCancelling(false)
    }
  }

  function handleCopy() {
    if (!code) return
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const typeLabel: Record<TransferType, string> = {
    dependent:    'Dependent transfer',
    pet:          'Pet transfer',
    farm_animals: 'Farm transfer',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-t-3xl px-6 pb-safe pt-5">
        {/* Handle */}
        <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-gray-600 mx-auto mb-5" />

        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{typeLabel[type]}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-[260px]">
              {entityNames.join(', ')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {phase === 'loading' && (
          <div className="flex justify-center py-10">
            <svg className="w-6 h-6 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {(phase === 'ready' || phase === 'error') && !code && (
          <>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-4 mb-5 space-y-2">
              {vaccineCount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Vaccine records</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{vaccineCount}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">
                  {type === 'farm_animals' ? 'Animals' : 'Records'}
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">{entityIds.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Code expires</span>
                <span className="font-semibold text-gray-900 dark:text-white">in 48 hours</span>
              </div>
            </div>

            {type === 'dependent' && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
                The recipient's vaccination records will be copied to their personal history. Your dependent record will remain until you remove it.
              </p>
            )}
            {(type === 'pet' || type === 'farm_animals') && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
                Full ownership transfers to the recipient. You will lose access once they claim the code.
              </p>
            )}

            {error && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>}

            <button
              onClick={handleGenerate}
              disabled={phase === 'generating'}
              className="w-full py-3.5 bg-blue-600 text-white font-semibold rounded-2xl disabled:opacity-60 active:bg-blue-700 flex items-center justify-center gap-2 mb-3"
            >
              {phase === 'generating' ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating…
                </>
              ) : 'Generate Transfer Code'}
            </button>
            <button
              onClick={onClose}
              className="w-full py-3 text-sm font-semibold text-gray-500 dark:text-gray-400"
            >
              Cancel
            </button>
          </>
        )}

        {phase === 'ready' && code && (
          <>
            {existing && (
              <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-3 py-2 mb-4">
                An active code already exists for this transfer.
              </p>
            )}

            <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-2">
              Share this code with the recipient
            </p>

            {/* Big code display */}
            <div className="flex items-center justify-center gap-3 bg-gray-50 dark:bg-gray-700/50 rounded-2xl py-6 mb-4">
              <span className="font-mono text-4xl font-bold tracking-[0.25em] text-gray-900 dark:text-white select-all">
                {code}
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

            <div className="flex items-center gap-2 justify-center text-xs text-gray-400 dark:text-gray-500 mb-5">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Valid for 48 hours. The recipient enters this at <strong className="text-gray-500">Menu → Claim Transfer</strong>.</span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 py-3 border border-red-300 dark:border-red-700 text-sm font-semibold text-red-600 dark:text-red-400 rounded-2xl disabled:opacity-60 active:bg-red-50 dark:active:bg-red-900/20"
              >
                {cancelling ? 'Cancelling…' : 'Cancel Code'}
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold rounded-2xl active:opacity-80"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
