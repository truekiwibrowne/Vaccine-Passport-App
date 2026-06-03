import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useUserVaccines } from '../hooks/useUserVaccines'
import { toggleFavourite } from '../services/vaccineService'
import { QRCodeDisplay } from '../components/passport/QRCodeDisplay'
import { formatDate, isExpired } from '../utils/dateUtils'
import { useIsLg } from '../hooks/useMediaQuery'
import type { UserVaccine } from '../types/vaccine'

type Filter = 'all' | 'verified' | 'pending' | 'starred'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'verified', label: 'Verified' },
  { key: 'pending',  label: 'Pending' },
  { key: 'starred',  label: 'Starred' },
]

function statusInfo(v: UserVaccine) {
  if (v.pending_validation) return {
    dot: 'bg-yellow-400',
    text: 'Pending',
    badge: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300',
    colour: 'yellow',
  }
  if (v.Authenticated) return {
    dot: 'bg-green-400',
    text: `Verified${v.authentication_level ? ` · L${v.authentication_level}` : ''}`,
    badge: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
    colour: 'green',
  }
  return {
    dot: 'bg-gray-300 dark:bg-gray-600',
    text: 'Recorded',
    badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
    colour: 'blue',
  }
}

function computeAge(dob?: string): number | null {
  if (!dob) return null
  const birth = new Date(dob)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age
}

// ── Inline detail panel (desktop right column) ─────────────────────────────────
function VaccineDetailPanel({
  vaccine,
  onNavigate,
  onFav,
  favOverride,
}: {
  vaccine: UserVaccine
  onNavigate: () => void
  onFav: () => void
  favOverride?: boolean
}) {
  const { text, badge, colour } = statusInfo(vaccine)
  const expired = isExpired(vaccine.Expiration_date)
  const fav = favOverride ?? vaccine.Favourited

  const Field = ({ label, value }: { label: string; value?: string | null }) =>
    value ? (
      <div className="py-2.5 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
        <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-sm text-gray-800 dark:text-gray-200">{value}</p>
      </div>
    ) : null

  return (
    <div className="p-6 flex flex-col gap-5">
      {/* Title row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
            {vaccine.vaccine_name}
          </h2>
          {vaccine.Vaccine_Reference && vaccine.Vaccine_Reference !== vaccine.vaccine_name && (
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{vaccine.Vaccine_Reference}</p>
          )}
        </div>
        <button onClick={onFav} className="p-1.5 flex-shrink-0 mt-0.5">
          <svg
            className={`w-5 h-5 ${fav ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 dark:text-gray-700'}`}
            stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </button>
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-sm px-3 py-1 rounded-full font-semibold ${badge}`}>
          {text.split(' ·')[0]}
        </span>
        {vaccine.authentication_level > 0 && (
          <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
            Trust level {vaccine.authentication_level}
          </span>
        )}
        {expired && (
          <span className="text-xs bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 px-2 py-0.5 rounded-full font-medium">
            Expired
          </span>
        )}
      </div>

      {/* Fields */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl px-4 divide-y divide-gray-50 dark:divide-gray-700/50">
        <Field label="Date Administered" value={vaccine.date_administration ? formatDate(vaccine.date_administration) : null} />
        <Field label="Clinic / Hospital" value={vaccine.Clinic || null} />
        <Field label={colour === 'green' ? 'Verified by' : 'Requested validator'} value={vaccine.Authenticator ?? (vaccine.validator_email || null)} />
        {vaccine.Authentication_Date && (
          <Field label="Verified on" value={formatDate(vaccine.Authentication_Date)} />
        )}
        <Field label="Expiry Date" value={vaccine.Expiration_date ? formatDate(vaccine.Expiration_date) : null} />
      </div>

      {/* Photo evidence */}
      {vaccine.Photo_Evidence && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden">
          <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide px-4 pt-3 pb-2">
            Photo Evidence
          </p>
          <img
            src={vaccine.Photo_Evidence}
            alt="Vaccine evidence"
            className="w-full max-h-48 object-cover"
          />
        </div>
      )}

      {/* Actions */}
      <button
        onClick={onNavigate}
        className="w-full py-3 rounded-2xl bg-blue-600 text-white font-semibold text-sm active:bg-blue-700 transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        View / Edit Full Record
      </button>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export function MyVaccinesPage() {
  const { user, profile } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const isLg = useIsLg()
  const { vaccines, loading } = useUserVaccines(user?.uid)
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [favOverrides, setFavOverrides] = useState<Record<string, boolean>>({})

  const firstName = profile?.Full_Name?.split(' ')[0] ?? 'User'
  const age = computeAge(profile?.Date_of_Birth)
  const verifiedCount = vaccines.filter(v => v.Authenticated === true).length

  const filtered = vaccines.filter(v => {
    const fav = favOverrides[v.user_vaccine_id] ?? v.Favourited
    if (filter === 'verified') return v.Authenticated === true
    if (filter === 'pending')  return v.pending_validation === true
    if (filter === 'starred')  return fav
    return true
  })

  const counts: Record<Filter, number> = {
    all:      vaccines.length,
    verified: vaccines.filter(v => v.Authenticated).length,
    pending:  vaccines.filter(v => v.pending_validation).length,
    starred:  vaccines.filter(v => favOverrides[v.user_vaccine_id] ?? v.Favourited).length,
  }

  const selectedVaccine = vaccines.find(v => v.user_vaccine_id === selectedId) ?? null

  async function handleFav(v: UserVaccine) {
    if (!user) return
    const next = !(favOverrides[v.user_vaccine_id] ?? v.Favourited)
    setFavOverrides(p => ({ ...p, [v.user_vaccine_id]: next }))
    try { await toggleFavourite(user.uid, v.user_vaccine_id, next) }
    catch { setFavOverrides(p => ({ ...p, [v.user_vaccine_id]: !next })) }
  }

  const avatarSrc = profile?.Profile_Image ?? null

  // ── Reusable sub-components ─────────────────────────────────────────────────

  const userInfoCard = (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm flex items-center gap-3 ${isLg ? '' : ''}`}>
      <div className="w-11 h-11 rounded-full overflow-hidden bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
        {avatarSrc
          ? <img src={avatarSrc} alt="Profile" className="w-full h-full object-cover" />
          : <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 dark:text-white truncate">{profile?.Full_Name ?? 'User'}</p>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {age !== null && (
            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
              {age} yr{age !== 1 ? 's' : ''}
            </span>
          )}
          {profile?.Passport_Issuing_Country && (
            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
              {profile.Passport_Issuing_Country}
            </span>
          )}
          <span className="text-xs bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
            {vaccines.length} vaccine{vaccines.length !== 1 ? 's' : ''}
          </span>
          {verifiedCount > 0 && (
            <span className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
              {verifiedCount} verified
            </span>
          )}
        </div>
      </div>
    </div>
  )

  const filterTabs = (
    <div className="flex bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
      {FILTERS.map(f => (
        <button
          key={f.key}
          onClick={() => setFilter(f.key)}
          className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
            filter === f.key
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-400 dark:text-gray-500 border-b-2 border-transparent'
          }`}
        >
          {f.label}
          {counts[f.key] > 0 && (
            <span className={`ml-1 text-[10px] ${filter === f.key ? 'text-blue-500' : 'text-gray-300 dark:text-gray-600'}`}>
              {counts[f.key]}
            </span>
          )}
        </button>
      ))}
    </div>
  )

  const vaccineList = (
    <>
      {loading ? (
        <div className="flex justify-center py-10">
          <svg className="animate-spin w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm text-center">
          <p className="font-medium text-gray-500 dark:text-gray-400">
            {vaccines.length === 0 ? 'No vaccines yet' : `No ${filter} vaccines`}
          </p>
          {vaccines.length === 0 && (
            <button
              onClick={() => navigate('/vaccines/add')}
              className="mt-3 text-sm font-medium text-blue-600 dark:text-blue-400 py-2 px-4 rounded-xl bg-blue-50 dark:bg-blue-900/20"
            >
              Add your first vaccine
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
          {filtered.map((v, i) => {
            const { dot, text, badge } = statusInfo(v)
            const fav = favOverrides[v.user_vaccine_id] ?? v.Favourited
            const expired = isExpired(v.Expiration_date)
            const isSelected = isLg && v.user_vaccine_id === selectedId
            return (
              <div key={v.user_vaccine_id}>
                {i > 0 && <div className="h-px bg-gray-100 dark:bg-gray-700/60 mx-4" />}
                <div
                  onClick={() => {
                    if (isLg) setSelectedId(v.user_vaccine_id)
                    else navigate(`/vaccines/${v.user_vaccine_id}`)
                  }}
                  className={`flex items-center gap-3 px-4 py-3.5 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : 'active:bg-gray-50 dark:active:bg-gray-800/60'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'bg-blue-100 dark:bg-blue-800/50' : 'bg-blue-50 dark:bg-blue-900/30'
                  }`}>
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{v.vaccine_name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
                      <span>{text}</span>
                      {v.date_administration && <span>· {formatDate(v.date_administration)}</span>}
                      {expired && <span className="text-red-400 font-medium">· Expired</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {!isLg && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge}`}>{text.split(' ·')[0]}</span>}
                    <button
                      onClick={e => { e.stopPropagation(); handleFav(v) }}
                      className="p-1"
                    >
                      <svg
                        className={`w-4 h-4 ${fav ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 dark:text-gray-700'}`}
                        stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )

  const qrCard = (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 pt-4 pb-2">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-center mb-3">
          Vaccination Passport
        </p>
      </div>
      <div className="px-4 pb-4 flex justify-center">
        <QRCodeDisplay
          uid={user?.uid ?? ''}
          firstName={firstName}
          vaccineCount={vaccines.length}
          verifiedCount={verifiedCount}
        />
      </div>
    </div>
  )

  // ── Sticky header ─────────────────────────────────────────────────────────
  const header = (
    <div
      className="sticky top-0 z-10 px-4 pt-safe border-b border-white/10 flex-shrink-0"
      style={{
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        background: isDark ? 'rgba(15,15,15,0.50)' : 'rgba(242,242,247,0.50)',
      }}
    >
      <div className="flex items-center h-14 gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2">
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="flex-1 font-semibold text-gray-900 dark:text-white text-lg truncate">
          {profile?.Full_Name ?? 'My Vaccines'}
        </h1>
        {/* Download vaccination report */}
        <button
          onClick={() => navigate('/report')}
          className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          title="Download vaccination report"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </button>
        {/* Add vaccine */}
        <button
          onClick={() => navigate('/vaccines/add')}
          className="w-9 h-9 bg-blue-600 text-white rounded-full flex items-center justify-center active:scale-95 transition-transform"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </div>
  )

  // ── Desktop split-pane layout ──────────────────────────────────────────────
  if (isLg) {
    return (
      <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
        {header}

        <div className="flex flex-1 overflow-hidden">
          {/* Left panel — list */}
          <div className="w-80 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto bg-white dark:bg-gray-800/50">
            <div className="p-4 flex flex-col gap-3">
              {userInfoCard}
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide px-1">
                Vaccine Records
              </p>
              {filterTabs}
              {vaccineList}

              {/* QR passport — below the list */}
              <div className="mt-2">
                {qrCard}
              </div>
            </div>
          </div>

          {/* Right panel — detail */}
          <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
            {selectedVaccine ? (
              <VaccineDetailPanel
                vaccine={selectedVaccine}
                onNavigate={() => navigate(`/vaccines/${selectedVaccine.user_vaccine_id}`)}
                onFav={() => handleFav(selectedVaccine)}
                favOverride={favOverrides[selectedVaccine.user_vaccine_id]}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center px-8">
                <div className="w-20 h-20 rounded-3xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-4">
                  <svg className="w-10 h-10 text-blue-300 dark:text-blue-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <p className="text-lg font-semibold text-gray-400 dark:text-gray-500">Select a vaccine</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  Click any vaccine from the list to view its details here
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Mobile layout ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {header}

      <div className="px-4 py-4 pb-32 flex flex-col gap-4">
        {userInfoCard}

        {/* Vaccine records */}
        <div>
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
            Vaccine Records
          </p>
          {filterTabs}
          <div className="mt-3">
            {vaccineList}
          </div>
        </div>

        {/* QR passport — below the list */}
        {qrCard}
      </div>
    </div>
  )
}
