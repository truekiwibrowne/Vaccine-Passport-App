import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getTransferCode, claimTransfer, isCodeExpired, timeUntilExpiry } from '../services/transferService'
import type { TransferCode } from '../types/transfer'

const TYPE_LABELS: Record<string, string> = {
  dependent:    'Dependent\'s vaccine records',
  pet:          'Pet',
  farm_animals: 'Farm animal(s)',
}

const TYPE_ICON: Record<string, string> = {
  dependent:    '👤',
  pet:          '🐾',
  farm_animals: '🐄',
}

export function ClaimTransferPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [codeInput, setCodeInput]       = useState('')
  const [looking, setLooking]           = useState(false)
  const [found, setFound]               = useState<TransferCode | null>(null)
  const [lookupError, setLookupError]   = useState<string | null>(null)
  const [claiming, setClaiming]         = useState(false)
  const [claimError, setClaimError]     = useState<string | null>(null)
  const [success, setSuccess]           = useState(false)

  async function handleLookup() {
    const code = codeInput.toUpperCase().trim()
    if (code.length !== 6) {
      setLookupError('Enter the full 6-character code.')
      return
    }
    setLooking(true)
    setLookupError(null)
    setFound(null)
    try {
      const result = await getTransferCode(code)
      if (!result) {
        setLookupError('Code not found. Check the code and try again.')
        return
      }
      if (result.status === 'claimed') {
        setLookupError('This code has already been claimed.')
        return
      }
      if (result.status === 'cancelled') {
        setLookupError('This code has been cancelled by the sender.')
        return
      }
      if (isCodeExpired(result)) {
        setLookupError('This code has expired. Ask the sender to generate a new one.')
        return
      }
      if (result.senderUid === user?.uid) {
        setLookupError('You cannot claim your own transfer code.')
        return
      }
      setFound(result)
    } catch (e) {
      setLookupError((e as Error)?.message ?? 'Could not look up code. Try again.')
    } finally {
      setLooking(false)
    }
  }

  async function handleClaim() {
    if (!found || !user) return
    setClaiming(true)
    setClaimError(null)
    try {
      await claimTransfer(found.code, user.uid)
      setSuccess(true)
    } catch (e) {
      setClaimError((e as Error)?.message ?? 'Transfer failed. Please try again.')
    } finally {
      setClaiming(false)
    }
  }

  if (success && found) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Transfer Complete</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
          {found.type === 'dependent'
            ? `${found.vaccineCount} vaccine record${found.vaccineCount !== 1 ? 's' : ''} have been added to your personal vaccine history.`
            : found.type === 'pet'
              ? `${found.entityNames[0]} is now in your pets.`
              : `${found.entityIds.length} animal${found.entityIds.length !== 1 ? 's' : ''} have been transferred to your farm.`
          }
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-8">You can view them now in the app.</p>
        <div className="flex gap-3">
          {found.type === 'dependent' && (
            <button
              onClick={() => navigate('/vaccines')}
              className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl active:bg-blue-700"
            >
              View My Vaccines
            </button>
          )}
          {found.type === 'pet' && (
            <button
              onClick={() => navigate('/pets')}
              className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl active:bg-blue-700"
            >
              View Pets
            </button>
          )}
          {found.type === 'farm_animals' && (
            <button
              onClick={() => navigate('/farm')}
              className="px-5 py-2.5 bg-green-700 text-white text-sm font-semibold rounded-xl active:bg-green-800"
            >
              View Farm
            </button>
          )}
          <button
            onClick={() => navigate('/')}
            className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-300 rounded-xl active:bg-gray-50 dark:active:bg-gray-700"
          >
            Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 pt-safe">
        <div className="flex items-center gap-3 h-14">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-gray-500 dark:text-gray-400"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-base font-semibold text-gray-900 dark:text-white">Claim Transfer</h1>
        </div>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 mb-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Enter the 6-character code from the person transferring records to you.
          </p>

          <div className="flex gap-2">
            <input
              value={codeInput}
              onChange={e => {
                setCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))
                setLookupError(null)
                setFound(null)
              }}
              onKeyDown={e => { if (e.key === 'Enter') handleLookup() }}
              placeholder="XXXXXX"
              maxLength={6}
              className="flex-1 font-mono text-2xl text-center tracking-[0.3em] uppercase border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-300 dark:placeholder-gray-600"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />
            <button
              onClick={handleLookup}
              disabled={looking || codeInput.length !== 6}
              className="px-4 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50 active:bg-blue-700"
            >
              {looking ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : 'Look up'}
            </button>
          </div>

          {lookupError && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">{lookupError}</p>
          )}
        </div>

        {/* Preview */}
        {found && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{TYPE_ICON[found.type]}</span>
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">
                    {TYPE_LABELS[found.type]}
                  </p>
                  <p className="text-base font-bold text-gray-900 dark:text-white leading-tight">
                    {found.entityNames.join(', ')}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-5 py-4 space-y-3">
              {found.vaccineCount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Vaccine records</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{found.vaccineCount}</span>
                </div>
              )}
              {found.entityIds.length > 1 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Animals</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{found.entityIds.length}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Code expires in</span>
                <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">{timeUntilExpiry(found)}</span>
              </div>
            </div>

            {found.type === 'dependent' && (
              <div className="mx-5 mb-4 px-3 py-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  These vaccination records will be added to <strong>your personal vaccine history</strong>. The dependent record stays in the sender's account until they remove it.
                </p>
              </div>
            )}

            {(found.type === 'pet' || found.type === 'farm_animals') && (
              <div className="mx-5 mb-4 px-3 py-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Full ownership will transfer to your account. The previous owner will lose access.
                </p>
              </div>
            )}

            {claimError && (
              <p className="mx-5 mb-3 text-sm text-red-600 dark:text-red-400">{claimError}</p>
            )}

            <div className="px-5 pb-5 flex gap-3">
              <button
                onClick={() => { setFound(null); setCodeInput('') }}
                className="flex-1 py-3 border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-300 rounded-xl active:bg-gray-50 dark:active:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleClaim}
                disabled={claiming}
                className="flex-1 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl disabled:opacity-60 active:bg-blue-700 flex items-center justify-center gap-2"
              >
                {claiming ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Claiming…
                  </>
                ) : 'Accept Transfer'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
