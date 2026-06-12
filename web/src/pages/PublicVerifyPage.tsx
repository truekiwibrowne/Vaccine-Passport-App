/**
 * PublicVerifyPage — shown when someone scans a VaxPass QR code.
 *
 * Designed for quick identity + vaccine verification (e.g. border control):
 *   - Large photo for face matching + full name + passport number
 *   - Colour-coded summary badge: green / amber / red
 *   - Priority entry-requirement vaccines (Yellow Fever, COVID) always visible
 *   - All other vaccines collapsed in an expandable section
 *   - Optional private health section (opt-in, no condition names)
 *
 * No authentication required — fully public.
 */

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { collection, getDocs, getDoc, doc } from 'firebase/firestore'
import { db } from '../firebase'
import type { PublicVaccineRecord } from '../types/vaccine'
import type { PublicProfile } from '../types/user'
import { formatDate, isExpired } from '../utils/dateUtils'

// ── Entity routing ─────────────────────────────────────────────────────────────

type EntityKind = 'self' | 'dependent' | 'pet' | 'farm'

function detectKind(params: Record<string, string | undefined>): EntityKind {
  if (params.depId)    return 'dependent'
  if (params.petId)    return 'pet'
  if (params.animalId) return 'farm'
  return 'self'
}

// ── Trust level labels ─────────────────────────────────────────────────────────

function trustLabel(level: number): { label: string; colour: string } {
  switch (level) {
    case 5: return { label: 'WHO Affiliated',   colour: 'text-purple-700 bg-purple-50' }
    case 4: return { label: 'Board Registered', colour: 'text-blue-700 bg-blue-50' }
    case 3: return { label: 'Clinic Verified',  colour: 'text-teal-700 bg-teal-50' }
    case 2: return { label: 'Admin Verified',   colour: 'text-indigo-700 bg-indigo-50' }
    default: return { label: 'Self Reported',   colour: 'text-gray-500 bg-gray-100' }
  }
}

// ── Priority vaccine detection ─────────────────────────────────────────────────
// A vaccine is shown in the always-visible "Entry Requirements" section when:
//   (a) its Public_Vaccines record has isEntryRequirement === true  (set at
//       record-creation time from the library entry — most reliable), OR
//   (b) its name matches a known keyword (fallback for records added before
//       the entryRequirementCountries field was introduced).

const PRIORITY_KEYWORDS = ['yellow fever', 'covid-19', 'covid', 'coronavirus', 'meningococcal', 'polio', 'cholera']

function isPriority(v: PublicVaccineRecord & { id: string }): boolean {
  if (v.isEntryRequirement) return true
  const lower = v.vaccine_name.toLowerCase()
  return PRIORITY_KEYWORDS.some(k => lower.includes(k))
}

// ── Vaccine row sub-component ──────────────────────────────────────────────────

function VaccineRow({ v }: { v: PublicVaccineRecord & { id: string } }) {
  const trust = trustLabel(v.authentication_level ?? 1)
  return (
    <div className="py-3 flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 leading-snug">{v.vaccine_name}</p>
        <div className="flex flex-wrap gap-x-3 mt-0.5">
          {v.Authentication_Date && (
            <p className="text-xs text-gray-400">Verified {formatDate(v.Authentication_Date)}</p>
          )}
          {v.Expiration_date && (
            <p className="text-xs text-gray-400">Exp {formatDate(v.Expiration_date)}</p>
          )}
        </div>
        <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 ${trust.colour}`}>
          {trust.label}
        </span>
      </div>
      <div className="flex-shrink-0 mt-0.5">
        {v.Authenticated === true ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Verified
          </span>
        ) : (
          <span className="text-xs text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full">Unverified</span>
        )}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function PublicVerifyPage() {
  const params   = useParams<{ uid: string; depId?: string; petId?: string; animalId?: string }>()
  const uid      = params.uid!
  const kind     = detectKind(params)
  const entityId = params.depId ?? params.petId ?? params.animalId

  const [profile,  setProfile]  = useState<PublicProfile | null>(null)
  const [name,     setName]     = useState<string | null>(null)
  const [vaccines, setVaccines] = useState<(PublicVaccineRecord & { id: string })[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [showOtherVaxes, setShowOtherVaxes] = useState(false)

  const scanTime = new Date()

  useEffect(() => {
    if (!uid) return
    async function load() {
      try {
        if (kind === 'self') {
          const [profileSnap, vaccinesSnap] = await Promise.all([
            getDoc(doc(db, 'User_Data', uid, 'Public_Profile', 'summary')),
            getDocs(collection(db, 'User_Data', uid, 'Public_Vaccines')),
          ])
          if (profileSnap.exists()) setProfile(profileSnap.data() as PublicProfile)
          setVaccines(vaccinesSnap.docs.map(d => ({ ...d.data() as PublicVaccineRecord, id: d.id })))

        } else if (kind === 'dependent' && entityId) {
          const [depSnap, vaccinesSnap] = await Promise.all([
            getDoc(doc(db, 'Dependents', entityId)),
            getDocs(collection(db, 'Dependents', entityId, 'Vaccines')),
          ])
          if (depSnap.exists()) setName(depSnap.data().name ?? null)
          setVaccines(vaccinesSnap.docs.map(d => ({ ...d.data() as PublicVaccineRecord, id: d.id })))

        } else if (kind === 'pet' && entityId) {
          const [petSnap, vaccinesSnap] = await Promise.all([
            getDoc(doc(db, 'Pets', entityId)),
            getDocs(collection(db, 'Pets', entityId, 'Vaccines')),
          ])
          if (petSnap.exists()) setName(petSnap.data().name ?? null)
          setVaccines(vaccinesSnap.docs.map(d => ({ ...d.data() as PublicVaccineRecord, id: d.id })))

        } else if (kind === 'farm' && entityId) {
          const [animalSnap, vaccinesSnap] = await Promise.all([
            getDoc(doc(db, 'FarmAnimals', entityId)),
            getDocs(collection(db, 'FarmAnimals', entityId, 'Vaccines')),
          ])
          if (animalSnap.exists()) setName(animalSnap.data().name ?? null)
          setVaccines(vaccinesSnap.docs.map(d => ({ ...d.data() as PublicVaccineRecord, id: d.id })))
        }
      } catch {
        setError('Could not load this passport. The link may be invalid.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [uid, kind, entityId])

  // ── Loading / error states ───────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      </div>
      <p className="text-gray-700 font-semibold text-center">{error}</p>
      <p className="text-gray-400 text-sm text-center mt-1">Ask the holder to share their QR code again</p>
    </div>
  )

  // ── Derived values ───────────────────────────────────────────────────────────

  const displayName  = kind === 'self' ? (profile?.fullName ?? profile?.firstName ?? 'Unknown') : (name ?? 'Unknown')
  const passportNum  = kind === 'self' ? profile?.passportNumber : undefined
  const photoURL     = kind === 'self' ? profile?.photoURL : undefined
  const phrSummary   = kind === 'self' ? profile?.phrSummary : undefined
  const currentVaxes = vaccines.filter(v => !isExpired(v.Expiration_date))

  // Verification summary
  const verifiedCount = currentVaxes.filter(v => v.Authenticated === true).length
  const allVerified   = currentVaxes.length > 0 && verifiedCount === currentVaxes.length
  const someVerified  = !allVerified && verifiedCount > 0

  // Split into priority (always visible) vs other (collapsible)
  const priorityVaxes = currentVaxes.filter(v => isPriority(v))
  const otherVaxes    = currentVaxes.filter(v => !isPriority(v))
  // If no priority vaccines matched, show all in the main list with no dropdown
  const mainVaxes  = priorityVaxes.length > 0 ? priorityVaxes : currentVaxes
  const extraVaxes = priorityVaxes.length > 0 ? otherVaxes    : []

  // Status colour tokens
  const statusRing  = allVerified ? 'ring-green-200'  : someVerified ? 'ring-amber-200'  : 'ring-gray-200'
  const statusBg    = allVerified ? 'bg-green-50'     : someVerified ? 'bg-amber-50'     : 'bg-gray-50'
  const statusStrip = allVerified ? 'bg-green-400'    : someVerified ? 'bg-amber-400'    : 'bg-red-400'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-sm mx-auto px-4 pt-6 pb-12">

        {/* ── Header: branding + live scan time ── */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="font-bold text-sm text-gray-800 tracking-tight">VaxPass</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              {scanTime.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              {' · '}
              {scanTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wide">Live</span>
          </div>
        </div>

        {/* ── Identity card ── */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-3">
          {/* Status colour strip across the top */}
          <div className={`h-1.5 w-full ${statusStrip}`} />

          <div className="px-5 py-5 flex items-center gap-5">
            {/* Photo — large for face matching */}
            <div className={`w-24 h-24 rounded-2xl flex-shrink-0 overflow-hidden ring-2 ${statusRing} ${statusBg} flex items-center justify-center`}>
              {photoURL ? (
                <img
                  src={photoURL}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl font-bold text-gray-300 select-none">
                  {displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>

            {/* Identity details */}
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-gray-900 leading-snug tracking-wide">
                {displayName.toUpperCase()}
              </p>
              {passportNum ? (
                <p className="text-sm font-mono text-gray-500 mt-1 tracking-wider">{passportNum}</p>
              ) : (
                <p className="text-xs text-gray-300 mt-1 italic">No passport number on file</p>
              )}

              {/* Quick status pill */}
              <div className={`inline-flex items-center gap-1.5 mt-2.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                allVerified  ? 'bg-green-100 text-green-700' :
                someVerified ? 'bg-amber-100 text-amber-700' :
                               'bg-red-100   text-red-700'
              }`}>
                {allVerified ? (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                )}
                {allVerified
                  ? 'Fully Verified'
                  : someVerified
                    ? `${verifiedCount} of ${currentVaxes.length} Verified`
                    : currentVaxes.length === 0 ? 'No Records' : 'Not Verified'}
              </div>
            </div>
          </div>
        </div>

        {/* ── Vaccine status card ── */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-3">
          <div className="px-4 pt-4 pb-2">

            {/* Summary badge */}
            {allVerified ? (
              <div className="flex items-center gap-3 bg-green-50 rounded-2xl px-4 py-3 mb-4">
                <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-green-700">Fully Verified</p>
                  <p className="text-xs text-green-600">All {currentVaxes.length} current vaccine{currentVaxes.length !== 1 ? 's' : ''} medically verified</p>
                </div>
              </div>
            ) : someVerified ? (
              <div className="flex items-center gap-3 bg-amber-50 rounded-2xl px-4 py-3 mb-4">
                <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-amber-700">Partially Verified</p>
                  <p className="text-xs text-amber-600">{verifiedCount} of {currentVaxes.length} vaccines verified — some are self-reported</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-red-50 rounded-2xl px-4 py-3 mb-4">
                <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-red-700">
                    {currentVaxes.length === 0 ? 'No Current Records' : 'Not Verified'}
                  </p>
                  <p className="text-xs text-red-600">
                    {currentVaxes.length === 0
                      ? 'No non-expired vaccine records on file'
                      : 'No vaccines have been verified by a medical professional'}
                  </p>
                </div>
              </div>
            )}

            {/* Vaccine list */}
            {currentVaxes.length > 0 && (
              <>
                {/* Section heading */}
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-1 mb-1">
                  {priorityVaxes.length > 0 ? 'Entry Requirements' : 'Current Vaccines'}
                </p>

                {/* Priority / main vaccines — always shown */}
                <div className="flex flex-col divide-y divide-gray-50">
                  {mainVaxes.map(v => <VaccineRow key={v.id} v={v} />)}
                </div>

                {/* Other vaccines — collapsible */}
                {extraVaxes.length > 0 && (
                  <>
                    <button
                      onClick={() => setShowOtherVaxes(p => !p)}
                      className="w-full mt-2 flex items-center justify-between px-1 py-2.5 border-t border-gray-50"
                    >
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                        Other Vaccines ({extraVaxes.length})
                      </p>
                      <svg
                        className={`w-4 h-4 text-gray-300 transition-transform duration-200 ${showOtherVaxes ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {showOtherVaxes && (
                      <div className="flex flex-col divide-y divide-gray-50">
                        {extraVaxes.map(v => <VaccineRow key={v.id} v={v} />)}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Private Health section (only if user has opted in) ── */}
        {phrSummary && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-3">
            <div className="px-4 pt-4 pb-1 flex items-center gap-2 border-b border-gray-50">
              <svg className="w-4 h-4 text-violet-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Private Health</p>
            </div>

            <div className="px-4 py-4 flex flex-col gap-3">
              {phrSummary.isClear && !phrSummary.isOnTreatment ? (
                <div className="flex items-center gap-3 bg-green-50 rounded-2xl px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-green-700">Clear</p>
                    <p className="text-xs text-green-600">All recent results negative</p>
                  </div>
                </div>
              ) : phrSummary.isOnTreatment ? (
                <div className="flex items-center gap-3 bg-blue-50 rounded-2xl px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-blue-700">Receiving Treatment</p>
                    <p className="text-xs text-blue-600">Managed and under medical care</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-amber-50 rounded-2xl px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-amber-700">Results on File</p>
                    <p className="text-xs text-amber-600">Some results require attention</p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between px-1">
                <p className="text-xs text-gray-500">Last tested</p>
                <p className="text-xs font-semibold text-gray-900">{formatDate(phrSummary.lastTestedDate)}</p>
              </div>

              <p className="text-[10px] text-gray-400 text-center leading-snug">
                Condition names are never shown · Shared voluntarily by the record holder
              </p>
            </div>
          </div>
        )}

        {/* ── Share + footer ── */}
        {navigator.share && (
          <button
            onClick={() => navigator.share({ title: `${displayName} — VaxPass`, url: window.location.href })}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white border border-gray-100 shadow-sm text-sm font-medium text-gray-600 mb-4 active:opacity-70 transition-opacity"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share this record
          </button>
        )}

        <p className="text-[10px] text-gray-400 text-center leading-relaxed">
          Verified by <span className="font-semibold text-gray-500">VaxPass</span> · Only status information is shown — no personal details beyond what the holder has chosen to share
        </p>

      </div>
    </div>
  )
}
