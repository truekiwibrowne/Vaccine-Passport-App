/**
 * Returns the count of unread in-app notifications for the current user.
 * Re-checks whenever the user navigates (via a focus event on the window).
 */
import { useState, useEffect, useCallback } from 'react'
import { getUnreadNotificationCount } from '../services/userNotificationsService'

export function useUnreadNotifications(uid: string | undefined): number {
  const [count, setCount] = useState(0)

  const refresh = useCallback(async () => {
    if (!uid) { setCount(0); return }
    try {
      const n = await getUnreadNotificationCount(uid)
      setCount(n)
    } catch {
      // Silently fail — badge disappears gracefully if Firestore is unreachable
    }
  }, [uid])

  useEffect(() => {
    refresh()
    // Re-check when the user returns to the tab (e.g. after reading notifications)
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [refresh])

  return count
}
