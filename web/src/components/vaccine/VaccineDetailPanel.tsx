/**
 * VaccineDetailPanel — read-only detail view for a user vaccine record.
 * Used in the desktop split-pane layout of VaccinesListPage. Edit navigates
 * to the full VaccineDetailPage; delete calls onDeleted() so the parent can
 * clear the selection.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { deleteUserVaccine } from '../../services/vaccineService'
import { createValidationRequest } from '../../services/validationService'
import { getPractitionerByEmail } from '../../services/practitionersService'
import type { Practitioner } from '../../types/admin'
import { VERIFICATION_LEVEL_LABELS, VERIFICATION_LEVEL_COLOURS } from '../../types/admin'
import { VaccineStatusPill } from './VaccineStatusPill'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { formatDate, isExpired } from '../../utils/dateUtils'
import type { UserVaccine } from '../../types/vaccine'

interface Props {
  vaccine: UserVaccine
  uid: string
  onDeleted: () => void
}

export function VaccineDetailPanel({ vaccine, uid, onDeleted }: Props) {
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [validationModal, setValidationModal] = useState(false)
  const [validatorEmail, setValidatorEmail]   = useState('')
  const [submitting, setSubmitting]           = useState(false)
  const [deleting, setDeleting]               = useState(false)

  const [chainOpen, setChainOpen]       = useState(false)
  const [chain, setChain]               = useState<Practitioner[]>([])
  const [chainLoading, setChainLoading] = useState(false)

  const expired = isExpired(vaccine.Expiration_date)
  const canEdit = vaccine.Authenticated !== true && !expired

  // Reset chain state when selected vaccine changes
  useEffect(() => {
    setChainOpen(false)
    setChain([])
  }, [vaccine.user_vaccine_id])

  async function loadChain() {
    if (!vaccine.Authenticator) return
    setChainLoading(true)
    const result: Practitioner[] = []
    let email: string | null = vaccine.Authenticator
    const seen = new Set<string>()
    while (email && !seen.has(email) && result.length < 5) {
      seen.add(email)
      const p = await getPractitionerByEmail(email)
      if (!p) break
      result.push(p)
      email = p.verifiedBy || null
    }
    setChain(result)
    setChainLoading(false)
  }

  useEffect(() => {
    if (chainOpen) loadChain()
  }, [chainOpen])

  async function requestValidation() {
    if (!validatorEmail) return
    setSubmitting(true)
    try {
      await createValidationRequest({
        user_vaccine_id: vaccine.user_vaccine_id,
        user_id:         uid,
        vaccine_name:    vaccine.vaccine_name,
        requested_at:    new Date().toISOString(),
        requestor_email: profile?.Email ?? '',
        validator_email: validatorEmail,
      })
      setValidationModal(false)
      setValidatorEmail('')
      alert('Validation request sent! The validator will see it when they log in.')
    } catch (e) {
      console.error(e)
      alert('Error sending request.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this vaccine record?')) return
    setDeleting(true)
    try {
      await deleteUserVaccine(uid, vaccine.user_vaccine_id)
      onDeleted()
    } catch {
      alert('Error deleting.')
      setDeleting(false)
    }
  }

  return (
    <div className="px-4 py-4 space-y-3 pb-16">

      {/* ── Action bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-1">
        {canEdit && (
          <button
            onClick={() => navigate(`/vaccines/${vaccine.user_vaccine_id}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>
        )}
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>

      {/* ── Hero card ──────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{vaccine.vaccine_name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{vaccine.Vaccine_Reference}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <VaccineStatusPill
            authenticated={vaccine.Authenticated}
            pending={vaccine.pending_validation}
            level={vaccine.authentication_level}
          />
          {expired && <span className="text-xs text-red-500 font-semibold">Expired</span>}
          {vaccine.Authenticated === true && (
            <span className="text-xs text-gray-400 dark:text-gray-500">Cannot be edited after verification</span>
          )}
        </div>
      </div>

      {/* ── Detail rows ────────────────────────────────────────────────────── */}
      {([
        { label: 'Date Administered',  value: formatDate(vaccine.date_administration) },
        { label: 'Expiry Date',        value: formatDate(vaccine.Expiration_date) },
        { label: 'Clinic',             value: vaccine.Clinic },
        { label: 'Doctor / Nurse',     value: vaccine.Doctor },
        vaccine.Authenticated === true && { label: 'Verified By',        value: vaccine.Authenticator },
        vaccine.Authenticated === true && { label: 'Verification Date',  value: formatDate(vaccine.Authentication_Date) },
        (vaccine.authentication_level ?? 0) > 0 && { label: 'Authentication Level', value: `Level ${vaccine.authentication_level}` },
      ] as Array<{ label: string; value: string } | false>)
        .filter(Boolean)
        .map(item => (
          <div
            key={(item as { label: string }).label}
            className="bg-white dark:bg-gray-800 rounded-2xl px-4 py-3 shadow-sm flex justify-between items-center"
          >
            <span className="text-sm text-gray-500 dark:text-gray-400">{(item as any).label}</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white text-right max-w-[60%]">
              {(item as any).value || '—'}
            </span>
          </div>
        ))
      }

      {/* ── Verification chain ─────────────────────────────────────────────── */}
      {vaccine.Authenticated === true && (
        <div>
          <button
            onClick={() => setChainOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">Verification Chain</span>
              <span className="text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
                Level {vaccine.authentication_level}
              </span>
            </div>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${chainOpen ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {chainOpen && (
            <div className="mt-2 space-y-3">
              {chainLoading && (
                <p className="text-xs text-gray-400 text-center py-4">Loading chain…</p>
              )}
              {!chainLoading && chain.length === 0 && (
                <p className="text-xs text-gray-400 px-4 py-2">
                  Verified by {vaccine.Authenticator} — not yet registered as a practitioner.
                </p>
              )}
              {chain.map((p, i) => (
                <div key={p.id} className="rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                  <div className="px-4 py-3 bg-white dark:bg-gray-800">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{p.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{p.email}</p>
                        {p.clinicName && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{p.clinicName}</p>}
                        {p.speciality && <p className="text-xs text-gray-400 dark:text-gray-500">{p.speciality}</p>}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${VERIFICATION_LEVEL_COLOURS[p.verificationLevel]}`}>
                        L{p.verificationLevel} · {VERIFICATION_LEVEL_LABELS[p.verificationLevel]}
                      </span>
                    </div>
                    {i === 0 && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                        Verified your vaccine on {formatDate(vaccine.Authentication_Date)}
                      </p>
                    )}
                    {i > 0 && p.verifiedAt && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                        Verified by {chain[i - 1]?.name ?? '—'} on {formatDate(p.verifiedAt)}
                      </p>
                    )}
                  </div>
                  {p.verifiedBy && i < chain.length - 1 && (
                    <div className="px-4 py-1.5 bg-gray-50 dark:bg-gray-700/40 flex items-center gap-1.5">
                      <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                      </svg>
                      <p className="text-xs text-gray-400 dark:text-gray-500">Verified by ↑</p>
                    </div>
                  )}
                  {p.verifiedBy && i === chain.length - 1 && !chainLoading && (
                    <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/40">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Chain root: verified by <span className="font-medium">{p.verifiedBy}</span>
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Photo evidence ─────────────────────────────────────────────────── */}
      {vaccine.Photo_Evidence && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Photo Evidence</p>
          <img
            src={vaccine.Photo_Evidence}
            alt="Vaccine record"
            className="w-full rounded-xl object-cover max-h-60"
          />
        </div>
      )}

      {/* ── Notes ──────────────────────────────────────────────────────────── */}
      {vaccine.Notes && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">Notes</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{vaccine.Notes}</p>
        </div>
      )}

      {/* ── Library link ───────────────────────────────────────────────────── */}
      {vaccine.vaccine_id && (
        <button
          onClick={() => navigate(`/library/${vaccine.vaccine_id}`)}
          className="w-full bg-blue-50 dark:bg-blue-900/30 rounded-2xl px-4 py-3.5 flex items-center justify-between shadow-sm"
        >
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Read about this vaccine</span>
          </div>
          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* ── Validation ─────────────────────────────────────────────────────── */}
      {!vaccine.Authenticated && !vaccine.pending_validation && (
        <Button size="lg" fullWidth onClick={() => setValidationModal(true)}>
          Request Medical Validation
        </Button>
      )}
      {vaccine.pending_validation && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-2xl p-4 text-center border border-yellow-100 dark:border-yellow-800">
          <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
            ⏳ Awaiting review by {vaccine.validator_email}
          </p>
          <p className="text-xs text-yellow-500 dark:text-yellow-400 mt-1">
            Ask them to sign in to the app and check their Validation Inbox
          </p>
        </div>
      )}

      {/* ── Validation request modal ───────────────────────────────────────── */}
      <Modal open={validationModal} onClose={() => setValidationModal(false)} title="Request Medical Validation">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
          Enter the email address of the medical professional who administered or can verify this vaccine.
        </p>
        <p className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg p-2 mb-4">
          They'll need to sign in to this app with that email address to see and approve your request in their Validation Inbox.
        </p>
        <Input
          label="Validator's email address"
          type="email"
          value={validatorEmail}
          onChange={e => setValidatorEmail(e.target.value)}
          placeholder="doctor@clinic.com"
        />
        <div className="mt-4 flex gap-3">
          <Button variant="secondary" fullWidth onClick={() => setValidationModal(false)}>Cancel</Button>
          <Button fullWidth loading={submitting} onClick={requestValidation} disabled={!validatorEmail}>
            Send Request
          </Button>
        </div>
      </Modal>
    </div>
  )
}
