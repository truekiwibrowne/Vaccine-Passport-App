import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getPublicSHDoc } from '../services/sexualHealthService'
import type { PublicSexualHealthDoc } from '../types/sexualHealth'
import { SH_RESULT_LABELS, SH_RESULT_COLOURS } from '../types/sexualHealth'
import { formatDate } from '../utils/dateUtils'

function overallBanner(records: PublicSexualHealthDoc['records']) {
  if (records.length === 0) return { label: 'No records shared', colour: 'bg-gray-50 text-gray-600', icon: '📋' }
  const results = records.map(r => r.result)
  if (results.includes('positive'))     return { label: 'Positive results present', colour: 'bg-red-50 text-red-700',   icon: '⚠️' }
  if (results.includes('undetectable')) return { label: 'On treatment — Undetectable (U=U)', colour: 'bg-blue-50 text-blue-700', icon: '💊' }
  if (results.includes('on_treatment')) return { label: 'On treatment', colour: 'bg-amber-50 text-amber-700', icon: '💊' }
  if (results.includes('pending'))      return { label: 'Some results pending', colour: 'bg-gray-50 text-gray-600', icon: '⏳' }
  return { label: 'All tested results negative', colour: 'bg-green-50 text-green-700', icon: '✓' }
}

export function PublicSexualHealthPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData]       = useState<PublicSexualHealthDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return }
    getPublicSHDoc(token)
      .then(doc => {
        if (!doc) setNotFound(true)
        else setData(doc)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [token])

  const hasUndetectable = data?.records.some(r => r.result === 'undetectable')

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <svg className="animate-spin w-6 h-6 text-violet-600" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center text-3xl">🔒</div>
        <h1 className="text-xl font-bold text-gray-900">Record Not Found</h1>
        <p className="text-sm text-gray-500 max-w-sm">
          This link is invalid, has been disabled, or the records are no longer being shared.
        </p>
      </div>
    )
  }

  const banner = overallBanner(data.records)
  const lastUpdated = formatDate(data.lastUpdated)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header bar */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-2">
        <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <span className="text-sm font-bold text-gray-900">VaxPass</span>
        <span className="text-xs text-gray-300 ml-1">· Private Health Records</span>
      </div>

      <div className="flex-1 px-4 py-6 max-w-md mx-auto w-full flex flex-col gap-5">

        {/* Name + last updated */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            {data.displayName ? `${data.displayName}'s` : 'Shared'} Health Records
          </h1>
          <p className="text-sm text-gray-400 mt-1">Last updated {lastUpdated}</p>
        </div>

        {/* Overall status banner */}
        <div className={`rounded-2xl px-5 py-4 flex items-center gap-3 ${banner.colour}`}>
          <span className="text-2xl leading-none">{banner.icon}</span>
          <p className="font-bold text-lg leading-tight">{banner.label}</p>
        </div>

        {/* Individual condition records */}
        {data.records.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 pt-3 pb-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                {data.showConditionNames ? 'Test Results' : 'Panel Results'}
              </p>
            </div>
            {data.records.map((r, i) => {
              const { bg, text } = SH_RESULT_COLOURS[r.result]
              return (
                <div key={i}>
                  {i > 0 && <div className="h-px bg-gray-100 mx-4" />}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {data.showConditionNames && r.conditionLabel
                          ? r.conditionLabel
                          : `Test ${i + 1}`}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">Tested {formatDate(r.testDate)}</p>
                      {r.medication && data.showMedication && (
                        <p className="text-xs text-gray-500 mt-0.5">💊 {r.medication}</p>
                      )}
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0 ${bg} ${text}`}>
                      {SH_RESULT_LABELS[r.result]}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Custom message */}
        {data.customMessage && (
          <div className="bg-white rounded-2xl px-4 py-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Message</p>
            <p className="text-sm text-gray-700 leading-relaxed">"{data.customMessage}"</p>
          </div>
        )}

        {/* U=U information box */}
        {hasUndetectable && (
          <div className="bg-blue-50 rounded-2xl px-4 py-4 border border-blue-100">
            <p className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-1.5">U=U — What does this mean?</p>
            <p className="text-sm text-blue-700 leading-relaxed">
              <strong>Undetectable = Untransmittable.</strong> A person living with HIV who is on effective antiretroviral therapy
              and maintains an undetectable viral load cannot sexually transmit HIV to their partners.
              This is supported by extensive scientific evidence.
            </p>
          </div>
        )}

        {/* Disclaimer footer */}
        <div className="mt-2 pb-8">
          <div className="border-t border-gray-200 pt-4 flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <p className="text-[11px] text-gray-400">Generated by <strong>VaxPass</strong> · Secure health record sharing</p>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              ⚠️ These records are self-reported by the individual. They have not been independently verified by a medical authority.
              Always practise safe sex regardless of test results.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
