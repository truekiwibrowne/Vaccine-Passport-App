/**
 * User notifications page — shows in-app approval and rejection notifications.
 * Accessible from the Profile tab (badge appears when there are unread items).
 * All notifications are marked read when the page mounts.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  getUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/userNotificationsService'
import type { UserNotification } from '../types/notifications'
import { formatDate } from '../utils/dateUtils'

export function NotificationsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function load() {
      const items = await getUserNotifications(user!.uid)
      if (!cancelled) {
        setNotifications(items)
        setLoading(false)
        // Mark all read after displaying
        if (items.some(n => !n.read)) {
          await markAllNotificationsRead(user!.uid)
        }
      }
    }

    load().catch(console.error)
    return () => { cancelled = true }
  }, [user])

  async function handleDismiss(notif: UserNotification) {
    if (!user) return
    if (!notif.read) {
      await markNotificationRead(user.uid, notif.id)
    }
    setNotifications(prev => prev.filter(n => n.id !== notif.id))
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center h-14 px-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="ml-2 text-lg font-semibold text-gray-900 dark:text-white">Notifications</span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">No notifications yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Updates about your requests will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map(notif => (
              <NotificationCard
                key={notif.id}
                notif={notif}
                onNavigate={notif.userVaccineId
                  ? () => navigate(`/vaccines/${notif.userVaccineId}`)
                  : undefined
                }
                onDismiss={() => handleDismiss(notif)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Notification card ────────────────────────────────────────────────────────

function NotificationCard({
  notif,
  onNavigate,
  onDismiss,
}: {
  notif: UserNotification
  onNavigate?: () => void
  onDismiss: () => void
}) {
  const isApproval  = notif.type === 'approval'
  const isRejection = notif.type === 'rejection'

  return (
    <div className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-sm border overflow-hidden ${
      !notif.read
        ? 'border-blue-200 dark:border-blue-700'
        : 'border-gray-100 dark:border-gray-700'
    }`}>
      {/* Unread dot */}
      {!notif.read && (
        <span className="absolute top-3.5 right-3.5 w-2 h-2 rounded-full bg-blue-500" />
      )}

      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center ${
            isApproval
              ? 'bg-green-100 dark:bg-green-900/30'
              : 'bg-red-100 dark:bg-red-900/30'
          }`}>
            {isApproval ? (
              <svg className="w-4.5 h-4.5 text-green-600 dark:text-green-400 w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 pr-4">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{notif.title}</p>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5 leading-relaxed">{notif.body}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">{formatDate(notif.createdAt)}</p>

            {/* CTA for vaccine approvals — link to the auto-created record */}
            {isApproval && onNavigate && (
              <button
                onClick={onNavigate}
                className="mt-2.5 text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1"
              >
                View vaccine record
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
