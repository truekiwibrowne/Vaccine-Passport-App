import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { collection, getDocs, getDoc, doc } from 'firebase/firestore'
import { db } from '../firebase'
import type { PublicVaccineRecord } from '../types/vaccine'
import type { PublicProfile } from '../types/user'
import { formatDate, isExpired } from '../utils/dateUtils'

type OverallStatus = 'green' | 'amber' | 'red'

function computeStatus(vaccines: PublicVaccineRecord[]): { status: OverallStatus; message: string } {
  if (vaccines.length === 0) {
    return { status: 'amber', message: 'No vaccine records on file' }
  }

  const verified = vaccines.filter(v => v.Authenticated === true)
  const expiredVerified = verified.filter(v => isExpired(v.Expiration_date))
  const validVerified = verified.filter(v => !isExpired(v.Expiration_date))

  if (expiredVerified.length > 0) {
    return { status: 'red', message: `${expiredVerified.length} verified vaccine${expiredVerified.length > 1 ? 's have' : ' has'} expired` }
  }
  if (validVerified.length === vaccines.length) {
    return { status: 'green', message: 'All vaccines verified and up to date' }
  }
  if (validVerified.length > 0) {
    return { status: 'amber', message: `${validVerified.length} of ${vaccines.length} vaccines verified` }
  }
  return { status: 'amber', message: 'No verified vaccines — self-reported only' }
}

const STATUS_STYLES = {
  green: {
    bg: 'bg-green-500',
    light: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
    icon: (
      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  amber: {
    bg: 'bg-amber-400',
    light: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    icon: (
      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  red: {
    bg: 'bg-red-500',
    light: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    icon: (
      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
}

export function PublicVerifyPage() {
  const { uid } = useParams<{ uid: string }>()
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [vaccines, setVaccines] = useState<(PublicVaccineRecord & { id: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!uid) return
    async function load() {
      try {
        const [profileSnap, vaccinesSnap] = await Promise.all([
          getDoc(doc(db, 'User_Data', uid!, 'Public_Profile', 'summary')),
          getDocs(collection(db, 'User_Data', uid!, 'Public_Vaccines')),
        ])
        if (profileSnap.exists()) setProfile(profileSnap.data() as PublicProfile)
        setVaccines(vaccinesSnap.docs.map(d => ({ ...d.data() as PublicVaccineRecord, id: d.id })))
      } catch {
        setError('Could not load this passport. The link may be invalid.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [uid])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
      <div className="w-8 h-8 border-4 border-gray-200 dark:border-gray-700 border-t-blue-600 rounded-full animate-spin" />
    </div>
  )

  if (error || !profile) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center px-6">
      <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
      <p className="text-gray-500 dark:text-gray-400 font-medium text-center">{error || 'Passport not found'}</p>
      <p className="text-gray-400 dark:text-gray-500 text-sm text-center mt-1">Ask the holder to share their QR code again</p>
    </div>
  )

  const { status, message } = computeStatus(vaccines)
  const style = STATUS_STYLES[status]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-sm mx-auto px-4 pt-10 pb-10">

        {/* App header */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="text-gray-700 dark:text-gray-300 font-semibold">Vaccine Passport</span>
        </div>

        {/* Person + big status */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden mb-4">
          {/* Status banner */}
          <div className={`${style.bg} px-5 py-5 flex items-center gap-4`}>
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
              {style.icon}
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-tight">{profile.firstName}</p>
              <p className="text-white/90 text-sm mt-0.5">{message}</p>
            </div>
          </div>

          {/* Status detail chip */}
          <div className={`mx-4 my-3 ${style.light} ${style.border} border rounded-xl px-3 py-2`}>
            <p className={`text-xs font-semibold ${style.text} text-center`}>
              {status === 'green' && '✓ Vaccines verified by registered medical professionals'}
              {status === 'amber' && '⚠ Some records are self-reported and not yet medically verified'}
              {status === 'red' && '✕ One or more verified vaccines have passed their expiry date'}
            </p>
          </div>

          {/* Vaccine list */}
          {vaccines.length > 0 && (
            <div className="px-4 pb-4">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Vaccine Records</p>
              <div className="flex flex-col divide-y divide-gray-50 dark:divide-gray-700">
                {vaccines.map(v => {
                  const exp = isExpired(v.Expiration_date)
                  return (
                    <div key={v.id} className="flex items-center justify-between py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{v.vaccine_name}</p>
                        {v.Authentication_Date && (
                          <p className="text-xs text-gray-400 dark:text-gray-500">Verified {formatDate(v.Authentication_Date)}</p>
                        )}
                        {v.Expiration_date && (
                          <p className={`text-xs ${exp ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                            {exp ? '⚠ Expired ' : 'Expires '}{formatDate(v.Expiration_date)}
                          </p>
                        )}
                      </div>
                      <div className="ml-3 flex-shrink-0">
                        {v.Authenticated === true && !exp ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Valid
                          </span>
                        ) : v.Authenticated === true && exp ? (
                          <span className="text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">Expired</span>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700 px-2.5 py-1 rounded-full">Unverified</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
          Scanned {new Date().toLocaleDateString()} · Only status shown, no personal details shared
        </p>
      </div>
    </div>
  )
}
