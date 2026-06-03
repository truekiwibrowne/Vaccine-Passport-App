import { useNavigate } from 'react-router-dom'
import type { UserVaccine } from '../../types/vaccine'
import { VaccineStatusPill } from './VaccineStatusPill'
import { formatDate, isExpired } from '../../utils/dateUtils'
import { toggleFavourite } from '../../services/vaccineService'
import { useAuth } from '../../contexts/AuthContext'

interface Props { vaccine: UserVaccine }

export function VaccineCard({ vaccine }: Props) {
  const navigate = useNavigate()
  const { user } = useAuth()

  async function handleFav(e: React.MouseEvent) {
    e.stopPropagation()
    if (user) await toggleFavourite(user.uid, vaccine.user_vaccine_id, vaccine.Favourited)
  }

  const expired = isExpired(vaccine.Expiration_date)

  return (
    <div
      onClick={() => navigate(`/vaccines/${vaccine.user_vaccine_id}`)}
      className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 cursor-pointer active:scale-[0.98] transition-transform"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white truncate">{vaccine.vaccine_name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{vaccine.Clinic} · {formatDate(vaccine.date_administration)}</p>
          </div>
        </div>
        <button onClick={handleFav} className="flex-shrink-0 p-1">
          <svg
            className={`w-5 h-5 ${vaccine.Favourited ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}
            stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <VaccineStatusPill
          authenticated={vaccine.Authenticated}
          pending={vaccine.pending_validation}
          level={vaccine.authentication_level}
        />
        {expired && vaccine.Expiration_date && (
          <span className="text-xs text-red-500 font-medium">Expired</span>
        )}
      </div>
    </div>
  )
}
