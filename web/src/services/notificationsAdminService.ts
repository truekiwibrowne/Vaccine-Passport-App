import { db } from '../firebase'
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, orderBy, setDoc,
} from 'firebase/firestore'
import type { ScheduledNotification } from '../types/admin'

const COL = 'Scheduled_Notifications'

export async function getScheduledNotifications(): Promise<ScheduledNotification[]> {
  const snap = await getDocs(query(collection(db, COL), orderBy('scheduledAt', 'desc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ScheduledNotification))
}

export async function createScheduledNotification(
  data: Omit<ScheduledNotification, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  return ref.id
}

export async function updateScheduledNotification(
  id: string,
  data: Partial<Omit<ScheduledNotification, 'id'>>
): Promise<void> {
  await updateDoc(doc(db, COL, id), { ...data, updatedAt: new Date().toISOString() })
}

export async function deleteScheduledNotification(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id))
}

/** Count how many devices have registered FCM tokens (admin diagnostic) */
export async function getFCMTokenCount(): Promise<number> {
  const snap = await getDocs(collection(db, 'FCM_Tokens'))
  return snap.size
}

/** Save an FCM token for the current user (creates or updates the doc) */
export async function saveFCMToken(uid: string, token: string): Promise<void> {
  await setDoc(doc(db, 'FCM_Tokens', uid), {
    token,
    uid,
    updatedAt: new Date().toISOString(),
  }, { merge: true })
}
