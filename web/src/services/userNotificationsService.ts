/**
 * Service for user-facing in-app notifications and push notification queuing.
 *
 * In-app notifications live at:
 *   User_Notifications/{uid}/items/{notifId}
 *
 * Push notifications are queued by writing to Scheduled_Notifications with a
 * { type: 'specificUser', uid } target rule. The notifier/process-notifications.js
 * script picks these up (via GitHub Actions) and sends the FCM push.
 */

import {
  collection, addDoc, getDocs, updateDoc, doc,
  query, orderBy, where, getCountFromServer,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { UserNotification, NotificationType, NotificationSubject } from '../types/notifications'
import { isoNow } from '../utils/dateUtils'

// ── In-app notifications ─────────────────────────────────────────────────────

type NewNotifData = {
  type:             NotificationType
  subject:          NotificationSubject
  title:            string
  body:             string
  vaccineLibraryId?: string
  userVaccineId?:   string
}

export async function addUserNotification(uid: string, data: NewNotifData): Promise<string> {
  const payload: Omit<UserNotification, 'id'> = {
    ...data,
    read: false,
    createdAt: isoNow(),
  }
  // Strip undefined fields — Firestore rejects them
  const clean = Object.fromEntries(
    Object.entries(payload).filter(([, v]) => v !== undefined)
  ) as Omit<UserNotification, 'id'>

  const ref = await addDoc(collection(db, 'User_Notifications', uid, 'items'), clean)
  return ref.id
}

export async function getUserNotifications(uid: string): Promise<UserNotification[]> {
  const snap = await getDocs(
    query(
      collection(db, 'User_Notifications', uid, 'items'),
      orderBy('createdAt', 'desc'),
    ),
  )
  return snap.docs.map(d => ({ ...d.data(), id: d.id }) as UserNotification)
}

export async function markNotificationRead(uid: string, notifId: string): Promise<void> {
  await updateDoc(doc(db, 'User_Notifications', uid, 'items', notifId), { read: true })
}

export async function markAllNotificationsRead(uid: string): Promise<void> {
  const snap = await getDocs(
    query(
      collection(db, 'User_Notifications', uid, 'items'),
      where('read', '==', false),
    ),
  )
  await Promise.all(snap.docs.map(d => updateDoc(d.ref, { read: true })))
}

export async function getUnreadNotificationCount(uid: string): Promise<number> {
  const snap = await getCountFromServer(
    query(
      collection(db, 'User_Notifications', uid, 'items'),
      where('read', '==', false),
    ),
  )
  return snap.data().count
}

// ── Push notification queuing ────────────────────────────────────────────────

/**
 * Queue a push notification for a specific user.
 * Writes to Scheduled_Notifications with target { type: 'specificUser', uid }.
 * The notifier script (run via GitHub Actions every 30 min) sends the FCM push.
 */
export async function queueUserPush(
  uid: string,
  title: string,
  body: string,
  actionUrl?: string,
): Promise<void> {
  const data: Record<string, unknown> = {
    title,
    body,
    targets:     [{ type: 'specificUser', uid }],
    status:      'scheduled',
    scheduledAt: isoNow(),
    createdAt:   isoNow(),
  }
  if (actionUrl) data.actionUrl = actionUrl
  await addDoc(collection(db, 'Scheduled_Notifications'), data)
}
