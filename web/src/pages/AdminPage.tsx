import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminClinicsPage } from './AdminClinicsPage'
import { AdminPractitionersPage } from './AdminPractitionersPage'
import { AdminLibraryPage } from './AdminLibraryPage'
import { AdminNotificationsPage } from './AdminNotificationsPage'
import { AdminFeedPage } from './AdminFeedPage'

type AdminTab = 'clinics' | 'practitioners' | 'library' | 'notifications' | 'feed'

export function AdminPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<AdminTab>('clinics')

  const tabs: { key: AdminTab; label: string; icon: React.ReactNode }[] = [
    {
      key: 'clinics',
      label: 'Clinics',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      key: 'practitioners',
      label: 'Practitioners',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      key: 'library',
      label: 'Library',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      key: 'notifications',
      label: 'Notifications',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
    },
    {
      key: 'feed',
      label: 'Feed',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="h-screen overflow-hidden bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center h-14 px-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="ml-2 flex items-center gap-2">
            <span className="font-semibold text-gray-900 dark:text-white">Admin Panel</span>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">Admin</span>
          </div>
        </div>

        {/* Tab bar — scrollable on narrow screens */}
        <div className="flex overflow-x-auto no-scrollbar border-t border-gray-100 dark:border-gray-700">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-shrink-0 flex items-center justify-center gap-1.5 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content — full-width so split panes use the whole screen */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {tab === 'clinics' && <AdminClinicsPage />}
        {tab === 'practitioners' && <AdminPractitionersPage />}
        {tab === 'library' && <AdminLibraryPage />}
        {tab === 'notifications' && <AdminNotificationsPage />}
        {tab === 'feed' && <AdminFeedPage />}
      </div>
    </div>
  )
}
