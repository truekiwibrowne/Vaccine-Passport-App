import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useIsLg } from '../hooks/useMediaQuery'
import { ResizableSplitPane } from '../components/layout/ResizableSplitPane'
import { QRCodeSVG } from 'qrcode.react'
import {
  getSHRecords, deleteSHRecord, updateSHRecord,
  getSHConfig, initSHConfig, updateSHConfig, publishSHSummary, unpublishSHSummary,
  isPinSet, isSessionUnlocked, verifyPin, savePin, unlockSession, lockSession,
  getSHQuickAccess, setSHQuickAccess, createSHValidationRequest,
  publishPHRToPassport, removePHRFromPassport,
} from '../services/sexualHealthService'
import {
  requestPHRAccess, listenForPHRApproval, deletePHRRequest, phrRequestSecondsRemaining,
} from '../services/phrAuthService'
import type { SexualHealthRecord, SexualHealthConfig } from '../types/sexualHealth'
import { SH_CONDITION_LABELS, SH_RESULT_LABELS, SH_RESULT_COLOURS, SH_CURABILITY, SH_CURABILITY_LABELS, SH_CURABILITY_COLOURS } from '../types/sexualHealth'
import { formatDate } from '../utils/dateUtils'

const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin

// ── PIN numpad ─────────────────────────────────────────────────────────────────

function PinPad({
  title, subtitle, onComplete, error, onError,
}: {
  title: string
  subtitle?: string
  onComplete: (pin: string) => void
  error?: string
  onError: (e: string) => void
}) {
  const [digits, setDigits] = useState<string[]>([])

  function press(d: string) {
    onError('')
    if (digits.length >= 4) return
    const next = [...digits, d]
    setDigits(next)
    if (next.length === 4) {
      setTimeout(() => {
        onComplete(next.join(''))
        setDigits([])
      }, 120)
    }
  }

  function del() { onError(''); setDigits(p => p.slice(0, -1)) }

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white text-center">{title}</h2>
        {subtitle && <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 text-center max-w-xs">{subtitle}</p>}
      </div>
      <div className="flex gap-4">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-all ${
              i < digits.length ? 'bg-violet-600 border-violet-600' : 'border-gray-300 dark:border-gray-600'
            }`}
          />
        ))}
      </div>
      {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
      <div className="grid grid-cols-3 gap-3 w-64">
        {['1','2','3','4','5','6','7','8','9'].map(d => (
          <button
            key={d}
            onClick={() => press(d)}
            className="h-14 rounded-2xl bg-white dark:bg-gray-800 shadow-sm text-xl font-semibold text-gray-900 dark:text-white active:bg-gray-100 dark:active:bg-gray-700 transition-colors select-none"
          >
            {d}
          </button>
        ))}
        <div />
        <button
          onClick={() => press('0')}
          className="h-14 rounded-2xl bg-white dark:bg-gray-800 shadow-sm text-xl font-semibold text-gray-900 dark:text-white active:bg-gray-100 dark:active:bg-gray-700 transition-colors select-none"
        >
          0
        </button>
        <button
          onClick={del}
          className="h-14 rounded-2xl bg-white dark:bg-gray-800 shadow-sm text-lg text-gray-500 dark:text-gray-400 active:bg-gray-100 dark:active:bg-gray-700 transition-colors select-none flex items-center justify-center"
        >
          ⌫
        </button>
      </div>
    </div>
  )
}

// ── Overall status helper ──────────────────────────────────────────────────────

function overallStatus(records: SexualHealthRecord[]) {
  if (records.length === 0) return { label: 'No records', colour: 'text-gray-400', bg: 'bg-gray-50 dark:bg-gray-800', icon: '📋', supersededCount: 0 }

  // Group records by condition, sort each group newest-first
  const byCondition = new Map<string, SexualHealthRecord[]>()
  for (const r of records) {
    const arr = byCondition.get(r.condition) ?? []
    arr.push(r)
    byCondition.set(r.condition, arr)
  }

  let supersededCount = 0
  const effectiveResults: string[] = []

  for (const [condition, recs] of byCondition) {
    const sorted = [...recs].sort((a, b) => b.testDate.localeCompare(a.testDate))
    const latest = sorted[0]
    const curability = SH_CURABILITY[condition as keyof typeof SH_CURABILITY] ?? 'curable'

    if (curability === 'curable' || curability === 'clearable') {
      // Only the most recent result matters; older positives superseded by later negatives
      effectiveResults.push(latest.result)
      const laterNeg = (r: SexualHealthRecord) =>
        (r.result === 'negative' || r.result === 'immune') &&
        r.testDate > sorted[sorted.length - 1]?.testDate
      // count records that are superseded (not the latest AND there's a later negative/immune)
      for (let i = 1; i < sorted.length; i++) {
        const older = sorted[i]
        const hasLaterNegative = sorted.slice(0, i).some(
          newer => newer.result === 'negative' || newer.result === 'immune'
        )
        if (hasLaterNegative && (older.result === 'positive' || older.result === 'on_treatment')) {
          supersededCount++
        }
        void laterNeg
      }
    } else {
      // lifelong: most recent still matters
      effectiveResults.push(latest.result)
    }
  }

  if (effectiveResults.includes('positive'))     return { label: 'Positive results recorded',             colour: 'text-red-600 dark:text-red-400',    bg: 'bg-red-50 dark:bg-red-900/20',    icon: '⚠️', supersededCount }
  if (effectiveResults.includes('undetectable')) return { label: 'On treatment — undetectable viral load', colour: 'text-blue-600 dark:text-blue-400',  bg: 'bg-blue-50 dark:bg-blue-900/20',  icon: 'ℹ️', supersededCount }
  if (effectiveResults.includes('on_treatment')) return { label: 'On treatment',                           colour: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', icon: 'ℹ️', supersededCount }
  if (effectiveResults.includes('pending'))      return { label: 'Results pending',                        colour: 'text-gray-500 dark:text-gray-400',   bg: 'bg-gray-50 dark:bg-gray-700',      icon: '⏳', supersededCount }
  return { label: 'All recent tests negative', colour: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20', icon: '✓', supersededCount }
}

// ── Superseded helper ──────────────────────────────────────────────────────────
// Returns true if a LATER record exists for the same condition with a negative/immune result
// AND the condition is curable or clearable
function isSuperseded(record: SexualHealthRecord, allRecords: SexualHealthRecord[]): boolean {
  const curability = SH_CURABILITY[record.condition as keyof typeof SH_CURABILITY] ?? 'curable'
  if (curability === 'lifelong') return false
  return allRecords.some(
    r =>
      r.condition === record.condition &&
      r.id !== record.id &&
      r.testDate > record.testDate &&
      (r.result === 'negative' || r.result === 'immune')
  )
}

function latestTestDate(records: SexualHealthRecord[]): string | null {
  if (records.length === 0) return null
  const dates = records.map(r => r.testDate).filter(Boolean).sort((a, b) => b.localeCompare(a))
  return dates[0] ?? null
}

// ── Record detail panel ────────────────────────────────────────────────────────

function RecordDetailPanel({
  record, uid, requestorEmail, onDelete, onRecordUpdated,
}: {
  record: SexualHealthRecord
  uid: string
  requestorEmail: string
  onDelete: (r: SexualHealthRecord) => void
  onRecordUpdated: () => void
}) {
  const condLabel  = SH_CONDITION_LABELS[record.condition as keyof typeof SH_CONDITION_LABELS] ?? record.condition
  const { bg, text } = SH_RESULT_COLOURS[record.result]
  const curability = SH_CURABILITY[record.condition as keyof typeof SH_CURABILITY] ?? 'curable'
  const curColour  = SH_CURABILITY_COLOURS[curability]

  const [valEmail,     setValEmail]     = useState('')
  const [valSubmitting, setValSubmitting] = useState(false)
  const [valError,     setValError]     = useState('')

  async function submitValidation() {
    if (!valEmail.trim() || !valEmail.includes('@')) {
      setValError('Please enter a valid email address.')
      return
    }
    setValSubmitting(true)
    setValError('')
    try {
      await createSHValidationRequest(uid, record.id, condLabel, valEmail.trim(), requestorEmail)
      onRecordUpdated()
    } catch (e) {
      setValError(e instanceof Error ? e.message : 'Failed to send request. Please try again.')
    } finally {
      setValSubmitting(false)
    }
  }

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: 'Result',    value: <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${bg} ${text}`}>{SH_RESULT_LABELS[record.result]}</span> },
    { label: 'Test Date', value: formatDate(record.testDate) },
    { label: 'Curability', value: <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${curColour.bg} ${curColour.text}`}>{SH_CURABILITY_LABELS[curability]}</span> },
    ...(record.clinic       ? [{ label: 'Clinic',         value: record.clinic }]             : []),
    ...(record.practitioner ? [{ label: 'Doctor / Nurse', value: record.practitioner }]        : []),
    ...(record.medication   ? [{ label: 'Medication',     value: `💊 ${record.medication}` }] : []),
    ...(record.viralLoad    ? [{ label: 'Viral Load',     value: record.viralLoad }]           : []),
    ...(record.notes        ? [{ label: 'Notes',          value: record.notes }]               : []),
  ]

  // ── Validation status badge ────────────────────────────────────────────────
  const validationBadge = record.Authenticated ? (
    <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-4 flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-800/50 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-green-600 dark:text-green-300" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold text-green-700 dark:text-green-300">Verified — Level {record.authentication_level}</p>
        <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">{record.Authenticator}</p>
        {record.Authentication_Date && (
          <p className="text-xs text-green-500 dark:text-green-500 mt-0.5">{formatDate(record.Authentication_Date)}</p>
        )}
      </div>
    </div>
  ) : record.pending_validation ? (
    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-4 flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-800/50 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-amber-600 dark:text-amber-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">Validation pending</p>
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Sent to: {record.validator_email}</p>
        <button
          onClick={async () => {
            await updateSHRecord(uid, record.id, { pending_validation: false, validator_email: undefined })
            onRecordUpdated()
          }}
          className="text-xs text-amber-600 dark:text-amber-400 underline mt-1"
        >
          Cancel request
        </button>
      </div>
    </div>
  ) : (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Request Verification</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
          Send a verification request to a registered clinic or practitioner. They'll confirm this record using their VacciPass account.
        </p>
      </div>
      <input
        type="email"
        value={valEmail}
        onChange={e => { setValEmail(e.target.value); setValError('') }}
        placeholder="practitioner@clinic.com"
        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
      />
      {valError && <p className="text-xs text-red-500">{valError}</p>}
      <button
        onClick={submitValidation}
        disabled={valSubmitting || !valEmail.trim()}
        className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
      >
        {valSubmitting ? 'Sending…' : 'Send Verification Request'}
      </button>
    </div>
  )

  return (
    <div className="p-6 flex flex-col gap-5">
      <div>
        <p className="text-xs font-semibold text-violet-500 uppercase tracking-wide mb-1">Record Details</p>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{condLabel}</h2>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
        {rows.map((row, i) => (
          <div key={row.label}>
            {i > 0 && <div className="h-px bg-gray-100 dark:bg-gray-700/60 mx-4" />}
            <div className="flex items-start justify-between gap-4 px-4 py-3">
              <span className="text-sm text-gray-500 dark:text-gray-400 shrink-0">{row.label}</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white text-right">{row.value}</span>
            </div>
          </div>
        ))}
      </div>

      {validationBadge}

      <div className={`rounded-xl px-3 py-2.5 flex items-center gap-2 ${record.includeInShare ? 'bg-violet-50 dark:bg-violet-900/20' : 'bg-gray-50 dark:bg-gray-800'}`}>
        <span className="text-base">{record.includeInShare ? '📡' : '🔒'}</span>
        <p className={`text-xs font-medium ${record.includeInShare ? 'text-violet-700 dark:text-violet-300' : 'text-gray-500 dark:text-gray-400'}`}>
          {record.includeInShare ? 'Included in QR share' : 'Not included in QR share'}
        </p>
      </div>

      <button
        onClick={() => onDelete(record)}
        className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 dark:hover:text-red-400 font-medium transition-colors pt-4 border-t border-gray-100 dark:border-gray-700"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Delete Record
      </button>
    </div>
  )
}

// ── Share + settings panel (desktop right, mobile accordion) ──────────────────

function ShareAndSettingsPanel({
  config, records, qrUrl, publishing, quickAccess, uid,
  onToggle, onUpdateField, onPublish, onShare,
  onQuickAccessChange, onChangePinClick, onTogglePassport,
}: {
  config: SexualHealthConfig
  records: SexualHealthRecord[]
  qrUrl: string
  publishing: boolean
  quickAccess: boolean
  uid: string
  onToggle: (enabled: boolean) => void
  onUpdateField: (key: keyof SexualHealthConfig, value: unknown) => void
  onPublish: () => void
  onShare: () => void
  onQuickAccessChange: (v: boolean) => void
  onChangePinClick: () => void
  onTogglePassport: (enabled: boolean) => void
}) {
  return (
    <div className="flex flex-col gap-5">
      {/* ── QR Share ── */}
      <div>
        <p className="text-xs font-semibold text-violet-500 uppercase tracking-wide mb-3">QR Share</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mb-3">
          Generate a QR code a partner can scan to see your test results. You control exactly what is shown.
        </p>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden mb-3">
          {([
            { key: 'shareEnabled',       label: 'Enable QR sharing',       desc: 'Generate a shareable QR code' },
            { key: 'showConditionNames', label: 'Show condition names',    desc: '"HIV: Negative" vs just "Negative"' },
            { key: 'showMedication',     label: 'Show medication details', desc: 'Include treatment name when applicable' },
          ] as { key: keyof SexualHealthConfig; label: string; desc: string }[]).map(({ key, label, desc }, i) => (
            <div key={key}>
              {i > 0 && <div className="h-px bg-gray-100 dark:bg-gray-700/60 mx-4" />}
              <div className="flex items-start justify-between gap-3 px-4 py-3.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{desc}</p>
                </div>
                <button
                  onClick={() => key === 'shareEnabled' ? onToggle(!(config[key] as boolean)) : onUpdateField(key, !(config[key] as boolean))}
                  className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors mt-0.5 ${config[key] ? 'bg-violet-600' : 'bg-gray-200 dark:bg-gray-600'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${config[key] ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mb-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1.5">Message on QR page (optional)</label>
          <textarea
            defaultValue={config.customMessage ?? ''}
            onBlur={e => onUpdateField('customMessage', e.target.value || undefined)}
            placeholder="e.g. I get tested every 3 months. Always use protection."
            rows={2}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none dark:placeholder-gray-500"
          />
        </div>

        {config.shareEnabled ? (
          <div className="flex flex-col items-center gap-3">
            <div className="p-4 bg-white dark:bg-gray-700 rounded-2xl shadow-sm">
              <QRCodeSVG value={qrUrl} size={150} level="M" includeMargin />
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
              {records.filter(r => r.includeInShare).length} record{records.filter(r => r.includeInShare).length !== 1 ? 's' : ''} included
              {config.lastPublished && ` · Updated ${formatDate(config.lastPublished)}`}
            </p>
            <button
              onClick={onPublish}
              disabled={publishing}
              className="w-full py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {publishing ? (
                <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Updating…</>
              ) : 'Update QR'}
            </button>
            <button
              onClick={onShare}
              className="w-full py-2.5 rounded-xl border border-violet-300 dark:border-violet-700 text-violet-600 dark:text-violet-400 text-sm font-semibold flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share Link
            </button>
          </div>
        ) : (
          <button onClick={() => onToggle(true)} className="w-full py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold">
            Enable QR Sharing
          </button>
        )}
      </div>

      {/* ── Section Settings ── */}
      <div>
        <p className="text-xs font-semibold text-violet-500 uppercase tracking-wide mb-3">Section Settings</p>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
          {/* Quick access tile toggle */}
          <div className="flex items-start justify-between gap-3 px-4 py-3.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white">Quick access tile</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Show a shortcut tile on the home screen and sidebar</p>
            </div>
            <button
              onClick={() => { setSHQuickAccess(uid, !quickAccess); onQuickAccessChange(!quickAccess) }}
              className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors mt-0.5 ${quickAccess ? 'bg-violet-600' : 'bg-gray-200 dark:bg-gray-600'}`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${quickAccess ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
          <div className="h-px bg-gray-100 dark:bg-gray-700/60 mx-4" />
          {/* Include in Passport QR */}
          <div className="h-px bg-gray-100 dark:bg-gray-700/60 mx-4" />
          <div className="flex items-start justify-between gap-3 px-4 py-3.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white">Include in Passport QR</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Shows a "Clear / Last tested" summary on your passport scan page — no conditions are named
              </p>
              {config.includeInPassport && config.passportLastPublished && (
                <p className="text-xs text-violet-500 mt-0.5">
                  Last synced {new Date(config.passportLastPublished).toLocaleDateString()}
                </p>
              )}
            </div>
            <button
              onClick={() => onTogglePassport(!config.includeInPassport)}
              className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors mt-0.5 ${config.includeInPassport ? 'bg-violet-600' : 'bg-gray-200 dark:bg-gray-600'}`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${config.includeInPassport ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
          <div className="h-px bg-gray-100 dark:bg-gray-700/60 mx-4" />
          {/* Change PIN */}
          <button
            onClick={onChangePinClick}
            className="w-full flex items-center justify-between px-4 py-3.5 text-left group"
          >
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Change PIN</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Update your 4-digit access PIN</p>
            </div>
            <svg className="w-4 h-4 text-gray-400 group-hover:text-violet-500 transition-colors" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

type PinGateState = 'init' | 'setup' | 'setup_confirm' | 'enter' | 'unlocked'
type ChangePinPhase = 'idle' | 'new' | 'confirm'
type SHFilter = 'all' | 'negative' | 'detected' | 'pending'

export function SexualHealthPage() {
  const { user, profile } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const isLg = useIsLg()

  // ── PIN gate ─────────────────────────────────────────────────────────────────
  const [pinState, setPinState]   = useState<PinGateState>('init')
  const [pinError, setPinError]   = useState('')
  const [setupPin, setSetupPin]   = useState('')

  // ── Change-PIN overlay ───────────────────────────────────────────────────────
  const [changePinPhase, setChangePinPhase] = useState<ChangePinPhase>('idle')
  const [changePinFirst, setChangePinFirst] = useState('')
  const [changePinError, setChangePinError] = useState('')

  // ── Cross-device PIN approval ─────────────────────────────────────────────
  // 'idle'     — not requested yet (default when pinState === 'setup')
  // 'waiting'  — request sent, listening for approval
  // 'approved' — computer approved; one-time window to create PIN
  // 'denied'   — computer denied or expired
  type CrossDeviceState = 'idle' | 'waiting' | 'approved' | 'denied'
  const [crossDevice, setCrossDevice]         = useState<CrossDeviceState>('idle')
  const [crossRequestId, setCrossRequestId]   = useState<string | null>(null)
  const [crossSecsLeft, setCrossSecsLeft]     = useState(300)
  const [crossRequesting, setCrossRequesting] = useState(false)

  // ── Content ──────────────────────────────────────────────────────────────────
  const [records, setRecords]               = useState<SexualHealthRecord[]>([])
  const [config, setConfig]                 = useState<SexualHealthConfig | null>(null)
  const [loadingContent, setLoadingContent] = useState(false)
  const [filter, setFilter]                 = useState<SHFilter>('all')
  const [selectedRecord, setSelectedRecord] = useState<SexualHealthRecord | null>(null)
  const [shareOpen, setShareOpen]           = useState(false)
  const [publishing, setPublishing]         = useState(false)
  const [quickAccess, setQuickAccess]       = useState(false)

  // ── On mount: determine PIN state ────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    setQuickAccess(getSHQuickAccess(user.uid))
    if (isSessionUnlocked(user.uid)) {
      setPinState('unlocked')
    } else if (isPinSet(user.uid)) {
      setPinState('enter')
    } else {
      setPinState('setup')
    }
  }, [user])

  // ── Load content once unlocked ───────────────────────────────────────────────
  const loadContent = useCallback(async () => {
    if (!user) return
    setLoadingContent(true)
    try {
      const [recs, cfg] = await Promise.all([
        getSHRecords(user.uid),
        getSHConfig(user.uid),
      ])
      setRecords(recs)
      setConfig(cfg ?? await initSHConfig(user.uid))
    } catch (e) {
      console.error('Failed to load sexual health content:', e)
    } finally {
      setLoadingContent(false)
    }
  }, [user])

  useEffect(() => {
    if (pinState === 'unlocked') loadContent()
  }, [pinState, loadContent])

  // ── PIN gate handlers ─────────────────────────────────────────────────────────
  async function handleSetupFirst(pin: string) { setSetupPin(pin); setPinState('setup_confirm') }

  async function handleSetupConfirm(pin: string) {
    if (pin !== setupPin) { setPinError("PINs don't match — try again"); setPinState('setup'); setSetupPin(''); return }
    try {
      await savePin(pin, user!.uid)
      unlockSession(user!.uid)
      setPinState('unlocked')
    } catch (e) {
      console.error('[PHR] savePin failed:', e)
      setPinError('Could not save PIN — please try again.')
    }
  }

  async function handleEnterPin(pin: string) {
    const ok = await verifyPin(pin, user!.uid)
    if (!ok) { setPinError('Incorrect PIN'); return }
    unlockSession(user!.uid)
    setPinState('unlocked')
  }

  function handleLock() { lockSession(user!.uid); navigate('/profile') }

  // ── Cross-device PIN request ──────────────────────────────────────────────
  async function handleRequestCrossDevice() {
    if (!user) return
    setCrossRequesting(true)
    try {
      const id = await requestPHRAccess(user.uid)
      setCrossRequestId(id)
      setCrossDevice('waiting')
      setCrossSecsLeft(300)
    } catch {
      alert('Could not send request. Check your connection and try again.')
    } finally {
      setCrossRequesting(false)
    }
  }

  // Listen for the approval while in 'waiting' state
  useEffect(() => {
    if (crossDevice !== 'waiting' || !user || !crossRequestId) return

    // Countdown ticker
    const ticker = setInterval(() => {
      setCrossSecsLeft(s => {
        if (s <= 1) {
          clearInterval(ticker)
          setCrossDevice('denied')   // expired
          return 0
        }
        return s - 1
      })
    }, 1000)

    // Firestore listener
    const unsub = listenForPHRApproval(user.uid, crossRequestId, req => {
      if (!req) return   // doc doesn't exist yet or was deleted
      if (req.status === 'approved') {
        clearInterval(ticker)
        setCrossDevice('approved')
        // Clean up the Firestore doc
        deletePHRRequest(user.uid, crossRequestId)
      } else if (req.status === 'denied') {
        clearInterval(ticker)
        setCrossDevice('denied')
        deletePHRRequest(user.uid, crossRequestId)
      }
    })

    return () => { clearInterval(ticker); unsub() }
  }, [crossDevice, user, crossRequestId])

  // ── Change-PIN handlers ───────────────────────────────────────────────────────
  function startChangePin() { setChangePinPhase('new'); setChangePinError('') }

  function handleChangePinNew(pin: string) { setChangePinFirst(pin); setChangePinPhase('confirm') }

  async function handleChangePinConfirm(pin: string) {
    if (pin !== changePinFirst) {
      setChangePinError("PINs don't match — try again")
      setChangePinPhase('new')
      setChangePinFirst('')
      return
    }
    await savePin(pin, user!.uid)
    setChangePinPhase('idle')
    setChangePinError('')
    alert('PIN updated successfully.')
  }

  // ── Record actions ─────────────────────────────────────────────────────────────
  async function handleDelete(r: SexualHealthRecord) {
    if (!user || !window.confirm(`Remove ${SH_CONDITION_LABELS[r.condition as keyof typeof SH_CONDITION_LABELS] ?? r.condition} record?`)) return
    await deleteSHRecord(user.uid, r.id)
    setRecords(prev => prev.filter(x => x.id !== r.id))
    if (selectedRecord?.id === r.id) setSelectedRecord(null)
  }

  async function handlePublish() {
    if (!user || !config || !profile) return
    setPublishing(true)
    try {
      const firstName = profile.Full_Name?.split(' ')[0] ?? ''
      await publishSHSummary(user.uid, firstName, config, records)
      setConfig(prev => prev ? { ...prev, lastPublished: new Date().toISOString() } : prev)
      alert('QR updated. Anyone with your link will see the latest records.')
    } catch (e) { console.error(e); alert('Error publishing. Please try again.') }
    finally { setPublishing(false) }
  }

  async function toggleSharing(enabled: boolean) {
    if (!user || !config) return
    const updated = { ...config, shareEnabled: enabled }
    setConfig(updated)
    await updateSHConfig(user.uid, { shareEnabled: enabled })
    if (!enabled) { try { await unpublishSHSummary(config.shareToken) } catch { /* ok */ } }
  }

  async function updateConfigField(field: keyof SexualHealthConfig, value: unknown) {
    if (!user || !config) return
    setConfig(prev => prev ? { ...prev, [field]: value } as SexualHealthConfig : prev)
    await updateSHConfig(user.uid, { [field]: value })
  }

  async function handleTogglePassport(enabled: boolean) {
    if (!user || !config) return
    setConfig(prev => prev ? { ...prev, includeInPassport: enabled } : prev)
    await updateSHConfig(user.uid, { includeInPassport: enabled })
    if (enabled) {
      await publishPHRToPassport(user.uid, records)
    } else {
      await removePHRFromPassport(user.uid)
    }
  }

  function handleShare() {
    if (!config) return
    const url = `${APP_URL}/sh/${config.shareToken}`
    if (navigator.share) { navigator.share({ title: 'My Sexual Health Records', url }) }
    else { navigator.clipboard.writeText(url); alert('Link copied!') }
  }

  // ── Filtered records ──────────────────────────────────────────────────────────
  const filtered = records.filter(r => {
    if (filter === 'negative') return r.result === 'negative' || r.result === 'immune'
    if (filter === 'detected') return ['positive', 'undetectable', 'on_treatment'].includes(r.result)
    if (filter === 'pending')  return r.result === 'pending'
    return true
  })

  const status   = overallStatus(records)
  const lastDate = latestTestDate(records)
  const qrUrl    = config ? `${APP_URL}/sh/${config.shareToken}` : ''

  // ── Shared header ──────────────────────────────────────────────────────────────
  const stickyHeader = (
    <div
      className="sticky top-0 z-10 px-4 pt-safe border-b border-white/10"
      style={{
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        background: isDark ? 'rgba(15,15,15,0.50)' : 'rgba(242,242,247,0.50)',
      }}
    >
      <div className="flex items-center h-14 gap-2">
        <button onClick={() => navigate('/profile')} className="p-2 -ml-2">
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center gap-2 flex-1">
          <svg className="w-4 h-4 text-violet-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h1 className="font-semibold text-gray-900 dark:text-white text-lg truncate">Private Health Records</h1>
        </div>
        {pinState === 'unlocked' && (
          <>
            <button onClick={handleLock} className="p-2 text-violet-500 hover:text-violet-700 transition-colors" title="Lock">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </button>
            <button
              onClick={() => navigate('/health/sexual/add')}
              className="w-9 h-9 bg-violet-600 text-white rounded-full flex items-center justify-center active:scale-95 transition-transform"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  )

  // ── Loading / PIN gate screens ────────────────────────────────────────────────
  if (pinState === 'init') return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <svg className="animate-spin w-6 h-6 text-violet-600" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  )

  if (pinState === 'setup') {
    // ── Waiting for computer approval ──────────────────────────────────────
    if (crossDevice === 'waiting') {
      const mm = String(Math.floor(crossSecsLeft / 60)).padStart(1, '0')
      const ss = String(crossSecsLeft % 60).padStart(2, '0')
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          {stickyHeader}
          <div className="px-4 pb-32 max-w-sm mx-auto flex flex-col items-center gap-6 pt-12">
            <div className="w-20 h-20 rounded-3xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <svg className="animate-pulse w-10 h-10 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Waiting for approval…</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                Open the app on your signed-in computer and tap <span className="font-semibold text-violet-600 dark:text-violet-400">Approve</span> when the notification appears.
              </p>
            </div>
            {/* Countdown */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl px-6 py-4 shadow-sm text-center">
              <p className="text-3xl font-mono font-bold text-gray-900 dark:text-white tabular-nums">
                {mm}:{ss}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Request expires</p>
            </div>
            {/* Animated dots */}
            <div className="flex gap-2">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-violet-400 dark:bg-violet-600 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <button
              onClick={() => { setCrossDevice('idle'); setCrossRequestId(null) }}
              className="text-sm text-gray-400 dark:text-gray-500 underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )
    }

    // ── Approved — now let them create the PIN ─────────────────────────────
    if (crossDevice === 'approved') return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {stickyHeader}
        <div className="px-4 pb-32 max-w-sm mx-auto">
          <div className="mt-6 bg-green-50 dark:bg-green-900/20 rounded-2xl px-4 py-3 flex items-center gap-3">
            <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-xs text-green-700 dark:text-green-300 font-medium">
              Approved by your signed-in device. Create your PIN below.
            </p>
          </div>
          <PinPad title="Create a PIN" subtitle="Choose a 4-digit PIN to protect your private health records" onComplete={handleSetupFirst} error={pinError} onError={setPinError} />
        </div>
      </div>
    )

    // ── Denied or expired ──────────────────────────────────────────────────
    if (crossDevice === 'denied') return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {stickyHeader}
        <div className="px-4 pb-32 max-w-sm mx-auto flex flex-col items-center gap-6 pt-12">
          <div className="w-20 h-20 rounded-3xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <svg className="w-10 h-10 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {crossSecsLeft === 0 ? 'Request expired' : 'Request denied'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {crossSecsLeft === 0
                ? 'The 5-minute window passed. Please try again.'
                : 'The request was denied on your other device.'}
            </p>
          </div>
          <button
            onClick={() => setCrossDevice('idle')}
            className="px-6 py-3 bg-violet-600 text-white text-sm font-semibold rounded-2xl"
          >
            Try again
          </button>
        </div>
      </div>
    )

    // ── Default setup screen (idle) ────────────────────────────────────────
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {stickyHeader}
        <div className="px-4 pb-32 max-w-sm mx-auto">
          <div className="mt-6 bg-violet-50 dark:bg-violet-900/20 rounded-2xl px-4 py-3">
            <p className="text-xs text-violet-700 dark:text-violet-300">
              This section stores sensitive health records separately from your vaccination records.
              Your PIN is stored only on this device and never uploaded.
            </p>
          </div>
          <PinPad title="Create a PIN" subtitle="Choose a 4-digit PIN to protect your private health records" onComplete={handleSetupFirst} error={pinError} onError={setPinError} />

          {/* Cross-device approval option */}
          <div className="mt-2 border-t border-gray-200 dark:border-gray-700 pt-6 flex flex-col items-center gap-3">
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
              Already have Private Health records set up on another device?
            </p>
            <button
              onClick={handleRequestCrossDevice}
              disabled={crossRequesting}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl border border-violet-200 dark:border-violet-700 text-sm font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors disabled:opacity-50"
            >
              {crossRequesting ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              )}
              Request approval from another device
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (pinState === 'setup_confirm') return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {stickyHeader}
      <div className="px-4 pb-32 max-w-sm mx-auto">
        <PinPad title="Confirm PIN" subtitle="Enter the same PIN again to confirm" onComplete={handleSetupConfirm} error={pinError} onError={setPinError} />
      </div>
    </div>
  )

  if (pinState === 'enter') return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {stickyHeader}
      <div className="px-4 pb-32 max-w-sm mx-auto">
        <PinPad title="Enter PIN" subtitle="Enter your PIN to access your private health records" onComplete={handleEnterPin} error={pinError} onError={setPinError} />
      </div>
    </div>
  )

  // ── Change-PIN overlay (shown on top of unlocked content) ─────────────────────
  if (changePinPhase !== 'idle') return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div
        className="sticky top-0 z-10 px-4 pt-safe border-b border-white/10"
        style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', background: isDark ? 'rgba(15,15,15,0.50)' : 'rgba(242,242,247,0.50)' }}
      >
        <div className="flex items-center h-14 gap-2">
          <button onClick={() => { setChangePinPhase('idle'); setChangePinFirst('') }} className="p-2 -ml-2">
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="flex-1 font-semibold text-gray-900 dark:text-white text-lg">Change PIN</h1>
        </div>
      </div>
      <div className="px-4 pb-32 max-w-sm mx-auto">
        {changePinPhase === 'new' ? (
          <PinPad title="New PIN" subtitle="Choose a new 4-digit PIN" onComplete={handleChangePinNew} error={changePinError} onError={setChangePinError} />
        ) : (
          <PinPad title="Confirm New PIN" subtitle="Enter your new PIN again to confirm" onComplete={handleChangePinConfirm} error={changePinError} onError={setChangePinError} />
        )}
      </div>
    </div>
  )

  // ── Shared record list UI ─────────────────────────────────────────────────────

  const statusCard = (
    <div className={`rounded-2xl px-4 py-3.5 ${status.bg}`}>
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none mt-0.5">{status.icon}</span>
        <div>
          <p className={`font-semibold text-sm ${status.colour}`}>{status.label}</p>
          {lastDate && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Last tested: {formatDate(lastDate)}</p>}
        </div>
      </div>
    </div>
  )

  const filterTabs = (
    <div className="flex bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
      {([
        { key: 'all',      label: 'All',      count: records.length },
        { key: 'negative', label: 'Negative', count: records.filter(r => r.result === 'negative' || r.result === 'immune').length },
        { key: 'detected', label: 'Detected', count: records.filter(r => ['positive','undetectable','on_treatment'].includes(r.result)).length },
        { key: 'pending',  label: 'Pending',  count: records.filter(r => r.result === 'pending').length },
      ] as { key: SHFilter; label: string; count: number }[]).map(f => (
        <button
          key={f.key}
          onClick={() => setFilter(f.key)}
          className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${filter === f.key ? 'text-violet-600 border-b-2 border-violet-600' : 'text-gray-400 dark:text-gray-500 border-b-2 border-transparent'}`}
        >
          {f.label}
          {f.count > 0 && <span className={`ml-1 text-[10px] ${filter === f.key ? 'text-violet-500' : 'text-gray-300 dark:text-gray-600'}`}>{f.count}</span>}
        </button>
      ))}
    </div>
  )

  const recordsList = filtered.length === 0 ? (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm text-center">
      {records.length === 0 ? (
        <>
          <p className="text-2xl mb-2">🩺</p>
          <p className="font-medium text-gray-500 dark:text-gray-400">No records yet</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 mb-4">Add your first sexual health test result</p>
          <button onClick={() => navigate('/health/sexual/add')} className="text-sm font-medium text-violet-600 dark:text-violet-400 py-2 px-4 rounded-xl bg-violet-50 dark:bg-violet-900/20">
            Add Record
          </button>
        </>
      ) : (
        <p className="font-medium text-gray-500 dark:text-gray-400">No {filter} records</p>
      )}
    </div>
  ) : (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
      {filtered.map((r, i) => {
        const condLabel   = SH_CONDITION_LABELS[r.condition as keyof typeof SH_CONDITION_LABELS] ?? r.condition
        const { bg, text, dot } = SH_RESULT_COLOURS[r.result]
        const isSelected  = selectedRecord?.id === r.id
        const superseded  = isSuperseded(r, records)
        return (
          <div key={r.id}>
            {i > 0 && <div className="h-px bg-gray-100 dark:bg-gray-700/60 mx-4" />}
            <div
              className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors ${superseded ? 'opacity-60' : ''} ${isSelected ? 'bg-violet-50 dark:bg-violet-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'}`}
              onClick={() => setSelectedRecord(isSelected ? null : r)}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${dot}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{condLabel}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {formatDate(r.testDate)}{r.clinic ? ` · ${r.clinic}` : ''}
                </p>
                {r.medication && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">💊 {r.medication}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {superseded && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">Superseded</span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${bg} ${text}`}>{SH_RESULT_LABELS[r.result]}</span>
                <svg className="w-4 h-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )

  const shareAndSettingsProps = config && user ? {
    config, records, qrUrl, publishing, quickAccess, uid: user.uid,
    onToggle: toggleSharing,
    onUpdateField: updateConfigField,
    onPublish: handlePublish,
    onShare: handleShare,
    onQuickAccessChange: setQuickAccess,
    onChangePinClick: startChangePin,
    onTogglePassport: handleTogglePassport,
  } : null

  // ── Desktop split-pane layout ─────────────────────────────────────────────────
  if (isLg) {
    return (
      <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
        {stickyHeader}
        {loadingContent ? (
          <div className="flex-1 flex items-center justify-center">
            <svg className="animate-spin w-6 h-6 text-violet-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : (
          <ResizableSplitPane
            storageKey="splitPane:sexualHealth"
            leftClassName="overflow-y-auto bg-white dark:bg-gray-800/50"
            rightClassName="bg-gray-50 dark:bg-gray-900"
            left={
              <div className="p-4 flex flex-col gap-3">
                {statusCard}
                {status.supersededCount > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl px-3 py-2.5 text-xs text-amber-700 dark:text-amber-300">
                    ℹ️ {status.supersededCount} old record{status.supersededCount !== 1 ? 's have' : ' has'} been superseded by a later negative test result.
                  </div>
                )}
                <div className="flex items-center justify-between px-1 mt-1">
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Health Records</p>
                  <button
                    onClick={() => navigate('/health/sexual/library')}
                    className="text-xs font-medium text-violet-600 dark:text-violet-400 flex items-center gap-1"
                  >
                    STI Library
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                {filterTabs}
                {recordsList}
                <p className="text-xs text-gray-300 dark:text-gray-700 text-center px-4 mt-2">
                  🔒 Records protected by PIN · QR sharing is opt-in
                </p>
              </div>
            }
            right={
              <div className="flex flex-col h-full">
                {/* Fixed nav bar */}
                <div className="h-12 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 px-4 flex items-center justify-between">
                  {selectedRecord ? (
                    <>
                      <button
                        onClick={() => setSelectedRecord(null)}
                        className="flex items-center gap-1 text-sm font-medium text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-200 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                        Settings
                      </button>
                      <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[50%] text-right">
                        {SH_CONDITION_LABELS[selectedRecord.condition as keyof typeof SH_CONDITION_LABELS] ?? selectedRecord.condition}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">Share &amp; Settings</span>
                  )}
                </div>
                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto">
                  {selectedRecord ? (
                    <RecordDetailPanel
                      record={selectedRecord}
                      uid={user!.uid}
                      requestorEmail={user!.email ?? ''}
                      onDelete={handleDelete}
                      onRecordUpdated={loadContent}
                    />
                  ) : shareAndSettingsProps ? (
                    <div className="p-6">
                      <ShareAndSettingsPanel {...shareAndSettingsProps} />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center px-8">
                      <div className="w-20 h-20 rounded-3xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center mb-4 text-4xl">🔒</div>
                      <p className="text-lg font-semibold text-gray-400 dark:text-gray-500">Select a record</p>
                      <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Click a record to view details</p>
                    </div>
                  )}
                </div>
              </div>
            }
          />
        )}
      </div>
    )
  }

  // ── Mobile record detail (replaces list when a record is tapped) ──────────────
  if (!isLg && selectedRecord) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Detail header */}
        <div
          className="sticky top-0 z-10 px-4 pt-safe border-b border-white/10"
          style={{
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            background: isDark ? 'rgba(15,15,15,0.50)' : 'rgba(242,242,247,0.50)',
          }}
        >
          <div className="flex items-center h-14 gap-2">
            <button onClick={() => setSelectedRecord(null)} className="p-2 -ml-2">
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="flex-1 font-semibold text-gray-900 dark:text-white text-lg truncate">
              {SH_CONDITION_LABELS[selectedRecord.condition as keyof typeof SH_CONDITION_LABELS] ?? selectedRecord.condition}
            </h1>
          </div>
        </div>
        {/* Reuse RecordDetailPanel content inline */}
        <div className="py-4 pb-32">
          <RecordDetailPanel
            record={selectedRecord}
            uid={user!.uid}
            requestorEmail={user!.email ?? ''}
            onDelete={r => { handleDelete(r); setSelectedRecord(null) }}
            onRecordUpdated={() => { loadContent(); setSelectedRecord(null) }}
          />
        </div>
      </div>
    )
  }

  // ── Mobile layout ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {stickyHeader}
      {loadingContent ? (
        <div className="flex justify-center py-16">
          <svg className="animate-spin w-6 h-6 text-violet-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : (
        <div className="px-4 py-4 pb-32 flex flex-col gap-4">
          {statusCard}

          {config?.shareEnabled && config.lastPublished && records.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-violet-50 dark:bg-violet-900/20 rounded-xl">
              <svg className="w-4 h-4 text-violet-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <p className="text-xs text-violet-700 dark:text-violet-300 flex-1">
                QR sharing on · Updated {formatDate(config.lastPublished)}
              </p>
              <button onClick={() => setShareOpen(v => !v)} className="text-xs font-semibold text-violet-600 dark:text-violet-400">Manage</button>
            </div>
          )}

          {status.supersededCount > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl px-3 py-2.5 text-xs text-amber-700 dark:text-amber-300">
              ℹ️ {status.supersededCount} old record{status.supersededCount !== 1 ? 's have' : ' has'} been superseded by a later negative test result.
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Health Records</p>
              <button
                onClick={() => navigate('/health/sexual/library')}
                className="text-xs font-medium text-violet-600 dark:text-violet-400 flex items-center gap-1"
              >
                STI Health Library
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            {filterTabs}
            <div className="mt-3">{recordsList}</div>
          </div>

          {/* QR Share + Settings accordion */}
          {shareAndSettingsProps && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
              <button
                onClick={() => setShareOpen(v => !v)}
                className="w-full flex items-center justify-between px-4 py-4"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-violet-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Share &amp; Settings</p>
                </div>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${shareOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {shareOpen && (
                <div className="px-4 pb-5 border-t border-gray-100 dark:border-gray-700 pt-4">
                  <ShareAndSettingsPanel {...shareAndSettingsProps} />
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-gray-300 dark:text-gray-700 text-center px-4">
            🔒 Records protected by PIN · Stored securely in your account · QR sharing is opt-in
          </p>
        </div>
      )}
    </div>
  )
}
