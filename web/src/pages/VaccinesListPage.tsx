import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useUserVaccines } from '../hooks/useUserVaccines'
import { toggleFavourite } from '../services/vaccineService'
import { formatDate, isExpired } from '../utils/dateUtils'
import type { UserVaccine } from '../types/vaccine'

type Filter = 'all' | 'verified' | 'pending' | 'favourites'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',        label: 'All' },
  { key: 'verified',   label: 'Verified' },
  { key: 'pending',    label: 'Pending' },
  { key: 'favourites', label: 'Starred' },
]

// ── Status dot ─────────────────────────────────────────────────────────────────

function statusInfo(v: UserVaccine) {
  if (v.pending_validation) return { dot: 'bg-yellow-400', text: 'Pending review' }
  if (v.Authenticated)      return { dot: 'bg-green-400',  text: `Verified${v.authentication_level ? ` · L${v.authentication_level}` : ''}` }
  return { dot: 'bg-gray-300 dark:bg-gray-600', text: 'Self-reported' }
}

// ── Vaccine row ─────────────────────────────────────────────────────────────────

function VaccineRow({ vaccine, onFav }: { vaccine: UserVaccine; onFav: () => void }) {
  const navigate = useNavigate()
  const { dot, text } = statusInfo(vaccine)
  const expired = isExpired(vaccine.Expiration_date)

  return (
    <button
      onClick={() => navigate(`/vaccines/${vaccine.user_vaccine_id}`)}
      className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 dark:active:bg-gray-800/60 transition-colors text-left"
    >
      {/* icon */}
      <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
        <svg className="w-4.5 h-4.5 text-blue-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      </div>

      {/* text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{vaccine.vaccine_name}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
          <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
          <span>{text}</span>
          {vaccine.date_administration && <span>· {formatDate(vaccine.date_administration)}</span>}
          {vaccine.Clinic && <span>· {vaccine.Clinic}</span>}
          {expired && <span className="text-red-400 font-medium">· Expired</span>}
        </p>
      </div>

      {/* star */}
      <button
        onClick={e => { e.stopPropagation(); onFav() }}
        className="p-1.5 flex-shrink-0"
      >
        <svg
          className={`w-4 h-4 ${vaccine.Favourited ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 dark:text-gray-700'}`}
          stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      </button>
    </button>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function VaccinesListPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { vaccines, loading } = useUserVaccines(user?.uid)
  const [filter, setFilter] = useState<Filter>('all')
  const [favOverrides, setFavOverrides] = useState<Record<string, boolean>>({})

  const withOverrides = vaccines.map(v => ({
    ...v,
    Favourited: favOverrides[v.user_vaccine_id] ?? v.Favourited,
  }))

  const filtered = withOverrides.filter(v => {
    if (filter === 'verified')   return v.Authenticated === true
    if (filter === 'pending')    return v.pending_validation === true
    if (filter === 'favourites') return v.Favourited
    return true
  })

  async function handleFav(vaccine: UserVaccine) {
    if (!user) return
    const current = favOverrides[vaccine.user_vaccine_id] ?? vaccine.Favourited
    setFavOverrides(p => ({ ...p, [vaccine.user_vaccine_id]: !current }))
    await toggleFavourite(user.uid, vaccine.user_vaccine_id, !current)
  }

  const counts: Record<Filter, number> = {
    all:        vaccines.length,
    verified:   vaccines.filter(v => v.Authenticated === true).length,
    pending:    vaccines.filter(v => v.pending_validation === true).length,
    favourites: withOverrides.filter(v => v.Favourited).length,
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-black">

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-10 bg-[#F2F2F7] dark:bg-black border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between px-4 h-14 pt-safe">
          <div className="flex items-center gap-2.5">
            <button onClick={() => navigate(-1)} className="p-1 -ml-1">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-base font-semibold text-gray-900 dark:text-white">My Vaccines</h1>
          </div>
          <button
            onClick={() => navigate('/vaccines/add')}
            className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center active:scale-95 transition-transform"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex px-4 border-t border-gray-200 dark:border-gray-800">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-xs font-medium transition-colors border-b-2 ${
                filter === f.key
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-400 dark:text-gray-500 border-transparent'
              }`}
            >
              <span>{f.label}</span>
              {counts[f.key] > 0 && (
                <span className={`text-[10px] ${filter === f.key ? 'text-blue-500' : 'text-gray-300 dark:text-gray-600'}`}>
                  {counts[f.key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── List ── */}
      <div className="pb-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <svg className="animate-spin w-5 h-5 text-gray-300 dark:text-gray-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 px-8">
            <p className="text-3xl mb-2">💉</p>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {filter === 'all' ? 'No vaccines added yet' : `No ${filter} vaccines`}
            </p>
            {filter === 'all' && (
              <button
                onClick={() => navigate('/vaccines/add')}
                className="mt-3 text-sm font-medium text-blue-500"
              >
                + Add your first vaccine
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 mx-0 mt-3 rounded-2xl overflow-hidden mx-4 shadow-sm">
            {filtered.map((v, i) => (
              <div key={v.user_vaccine_id}>
                {i > 0 && <div className="h-px bg-gray-100 dark:bg-gray-700/60 ml-16" />}
                <VaccineRow vaccine={v} onFav={() => handleFav(v)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
