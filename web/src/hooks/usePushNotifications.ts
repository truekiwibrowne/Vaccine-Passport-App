import { useState, useEffect } from 'react'
import { getMessaging, getToken } from 'firebase/messaging'
import { app } from '../firebase'
import { saveFCMToken } from '../services/notificationsAdminService'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

export type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported'
export type TokenState = 'idle' | 'saving' | 'saved' | 'error'

export interface PushNotificationState {
  permissionState: PermissionState
  tokenState: TokenState
  errorMessage: string | null
  requestPermission: () => Promise<void>
}

export function usePushNotifications(uid: string | undefined): PushNotificationState {
  const [permissionState, setPermissionState] = useState<PermissionState>('default')
  const [tokenState, setTokenState] = useState<TokenState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (typeof Notification === 'undefined') {
      setPermissionState('unsupported')
      return
    }
    setPermissionState(Notification.permission as PermissionState)
  }, [])

  async function requestPermission() {
    if (typeof Notification === 'undefined') return
    setErrorMessage(null)

    try {
      const perm = await Notification.requestPermission()
      setPermissionState(perm as PermissionState)

      if (perm !== 'granted') return

      if (!uid) {
        setErrorMessage('Not signed in — cannot save notification token.')
        return
      }

      if (!VAPID_KEY) {
        setErrorMessage('VITE_FIREBASE_VAPID_KEY is not set. Add it to .env.production and redeploy.')
        setTokenState('error')
        return
      }

      setTokenState('saving')

      const messaging = getMessaging(app)
      let fcmToken: string
      try {
        fcmToken = await getToken(messaging, { vapidKey: VAPID_KEY })
      } catch (e: unknown) {
        const msg = (e as Error)?.message ?? String(e)
        // Service worker not found means the site needs a redeploy with the VAPID key baked in
        const swMissing = msg.includes('service-worker') || msg.includes('messaging/failed-service-worker')
        setErrorMessage(
          swMissing
            ? 'Service worker not found. The app needs to be rebuilt with your VAPID key — a new deploy should fix this. Try again after the latest build completes.'
            : `FCM token error: ${msg}`
        )
        setTokenState('error')
        return
      }

      if (!fcmToken) {
        setErrorMessage('Could not obtain FCM token. Check your VAPID key in Firebase Console → Project Settings → Cloud Messaging.')
        setTokenState('error')
        return
      }

      try {
        await saveFCMToken(uid, fcmToken)
        setTokenState('saved')
      } catch (e: unknown) {
        const code = (e as {code?: string})?.code
        setErrorMessage(
          code === 'permission-denied'
            ? 'Could not save token — Firestore rules not published. Go to Firebase Console → Firestore → Rules and publish the latest rules.'
            : `Could not save token: ${(e as Error)?.message ?? String(e)}`
        )
        setTokenState('error')
      }
    } catch (err: unknown) {
      setErrorMessage(`Unexpected error: ${(err as Error)?.message ?? String(err)}`)
      setTokenState('error')
    }
  }

  return { permissionState, tokenState, errorMessage, requestPermission }
}
