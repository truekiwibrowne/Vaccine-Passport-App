import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { useUserVaccines } from '../hooks/useUserVaccines'
import { QRCodeDisplay } from '../components/passport/QRCodeDisplay'
import { PageShell } from '../components/layout/PageShell'
import { FullPageSpinner } from '../components/ui/Spinner'
import { getDependents, getDependentVaccines } from '../services/dependentsService'
import { getPets, getPetVaccines } from '../services/petsService'
import type { Dependent } from '../types/dependent'
import type { Pet } from '../types/pet'
import { PET_SPECIES_EMOJI } from '../types/pet'
import type { PHRPassportSummary } from '../types/user'

const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin

type Selection = { kind: 'me' } | { kind: 'dep'; dep: Dependent } | { kind: 'pet'; pet: Pet }

export function PassportPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const { vaccines, loading } = useUserVaccines(user?.uid)

  const [dependents, setDependents] = useState<Dependent[]>([])
  const [pets, setPets] = useState<Pet[]>([])
  const [selected, setSelected] = useState<Selection>({ kind: 'me' })
  const [entityVaccineCount, setEntityVaccineCount] = useState<number | null>(null)
  const [entityLoading, setEntityLoading] = useState(false)
  const [phrSummary, setPhrSummary] = useState<PHRPassportSummary | undefined>(undefined)

  useEffect(() => {
    if (!user) return
    getDependents(user.uid).then(setDependents)
    getPets(user.uid).then(setPets)
  }, [user])

  // Load PHR summary and backfill any missing public-profile fields.
  // Accounts created before photo/fullName/passportNumber sync was added won't have
  // these in Public_Profile/summary — writing them here ensures the QR verify page
  // always shows up-to-date identity info without requiring a manual profile save.
  useEffect(() => {
    if (!user || !profile) return
    const summaryRef = doc(db, 'User_Data', user.uid, 'Public_Profile', 'summary')
    getDoc(summaryRef)
      .then(snap => {
        const data = snap.exists() ? snap.data() : {}
        setPhrSummary(data.phrSummary ?? undefined)

        // Backfill any fields the public summary is missing
        const updates: Record<string, unknown> = {}
        if (!data.fullName      && profile.Full_Name)        updates.fullName       = profile.Full_Name
        if (!data.firstName     && profile.Full_Name)        updates.firstName      = profile.Full_Name.split(' ')[0] || 'User'
        if (!data.photoURL      && profile.Profile_Image)    updates.photoURL       = profile.Profile_Image
        if (!data.passportNumber && profile.Passport_Number) updates.passportNumber = profile.Passport_Number
        if (Object.keys(updates).length > 0) {
          setDoc(summaryRef, updates, { merge: true }).catch(() => {/* non-critical */})
        }
      })
      .catch(() => {/* PHR summary unavailable — silently skip */})
  }, [user, profile])

  // Load vaccine count when non-me entity is selected
  useEffect(() => {
    if (!user) return
    if (selected.kind === 'me') {
      setEntityVaccineCount(null)
      return
    }
    setEntityLoading(true)
    if (selected.kind === 'dep') {
      getDependentVaccines(user.uid, selected.dep.id)
        .then(v => setEntityVaccineCount(v.length))
        .finally(() => setEntityLoading(false))
    } else if (selected.kind === 'pet') {
      getPetVaccines(user.uid, selected.pet.id)
        .then(v => setEntityVaccineCount(v.length))
        .finally(() => setEntityLoading(false))
    }
  }, [user, selected])

  if (loading) return <FullPageSpinner />

  const firstName = profile?.Full_Name?.split(' ')[0] ?? 'User'
  const verified = vaccines.filter(v => v.Authenticated === true).length

  const hasFamilyOrPets = dependents.length > 0 || pets.length > 0

  return (
    <PageShell title="My Passport" onBack={() => navigate(-1)}>
      <div className="flex flex-col items-center py-6 gap-5">

        {/* Entity selector — only shown if there are dependents or pets */}
        {hasFamilyOrPets && (
          <div className="w-full max-w-xs">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {/* Me pill */}
              <button
                onClick={() => setSelected({ kind: 'me' })}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selected.kind === 'me'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 shadow-sm border border-gray-100 dark:border-gray-700'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12a5 5 0 110-10 5 5 0 010 10zm0 2c-5.33 0-8 2.67-8 4v1h16v-1c0-1.33-2.67-4-8-4z"/>
                </svg>
                Me
              </button>

              {/* Dependent pills */}
              {dependents.map(dep => (
                <button
                  key={dep.id}
                  onClick={() => setSelected({ kind: 'dep', dep })}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selected.kind === 'dep' && selected.dep.id === dep.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 shadow-sm border border-gray-100 dark:border-gray-700'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {dep.name}
                </button>
              ))}

              {/* Pet pills */}
              {pets.map(pet => (
                <button
                  key={pet.id}
                  onClick={() => setSelected({ kind: 'pet', pet })}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selected.kind === 'pet' && selected.pet.id === pet.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 shadow-sm border border-gray-100 dark:border-gray-700'
                  }`}
                >
                  <span className="text-sm leading-none">{PET_SPECIES_EMOJI[pet.species]}</span>
                  {pet.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Passport content */}
        {selected.kind === 'me' && (
          <QRCodeDisplay
            uid={user?.uid ?? ''}
            firstName={firstName}
            vaccineCount={vaccines.length}
            verifiedCount={verified}
            phrSummary={phrSummary}
          />
        )}

        {selected.kind === 'dep' && (() => {
          const dep = selected.dep
          const qrUrl = `${APP_URL}/verify/dep/${user?.uid}/${dep.id}`
          return (
            <div className="flex flex-col items-center gap-4 w-full max-w-xs">
              <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-md p-6 flex flex-col items-center gap-4 w-full">
                <div className="flex flex-col items-center gap-1 text-center">
                  <p className="text-base font-semibold text-gray-900 dark:text-white">{dep.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {entityLoading ? 'Loading…' : `${entityVaccineCount ?? 0} vaccine${entityVaccineCount !== 1 ? 's' : ''} recorded`}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-2xl">
                  <QRCodeSVG value={qrUrl} size={200} level="M" includeMargin />
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center">Scan to verify vaccine status</p>
              </div>
              <button
                onClick={() => navigate(`/dependents/${dep.id}`)}
                className="w-full py-3 rounded-2xl bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium flex items-center justify-center gap-1.5 active:opacity-80 transition-opacity"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                View / Add Vaccines
              </button>
            </div>
          )
        })()}

        {selected.kind === 'pet' && (() => {
          const pet = selected.pet
          const qrUrl = `${APP_URL}/verify/pet/${user?.uid}/${pet.id}`
          const emoji = PET_SPECIES_EMOJI[pet.species]
          return (
            <div className="flex flex-col items-center gap-4 w-full max-w-xs">
              <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-md p-6 flex flex-col items-center gap-4 w-full">
                <div className="flex flex-col items-center gap-1 text-center">
                  <p className="text-2xl mb-1">{emoji}</p>
                  <p className="text-base font-semibold text-gray-900 dark:text-white">{pet.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {entityLoading ? 'Loading…' : `${entityVaccineCount ?? 0} vaccine${entityVaccineCount !== 1 ? 's' : ''} recorded`}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-2xl">
                  <QRCodeSVG value={qrUrl} size={200} level="M" includeMargin />
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center">Scan to verify vaccine status</p>
              </div>
              <button
                onClick={() => navigate(`/pets/${pet.id}`)}
                className="w-full py-3 rounded-2xl bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium flex items-center justify-center gap-1.5 active:opacity-80 transition-opacity"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                View / Add Vaccines
              </button>
            </div>
          )
        })()}

        <p className="text-xs text-gray-400 dark:text-gray-500 text-center max-w-xs">
          Only your name and vaccine statuses are shown to the scanner — no passport number or email is shared.
        </p>
      </div>
    </PageShell>
  )
}
