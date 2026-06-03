import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy,
} from 'firebase/firestore'
import { db } from '../firebase'
import { isoNow } from '../utils/dateUtils'

export type CustomEventType = 'appointment' | 'reminder' | 'treatment' | 'other'

export interface CalendarCustomEvent {
  id: string
  title: string
  date: string            // YYYY-MM-DD
  eventType: CustomEventType
  notes?: string
  ownerId: string
  Created: string
  Updated: string
}

export const CUSTOM_EVENT_LABELS: Record<CustomEventType, string> = {
  appointment: 'Appointment',
  reminder:    'Reminder',
  treatment:   'Treatment',
  other:       'Other',
}

export const CUSTOM_EVENT_EMOJI: Record<CustomEventType, string> = {
  appointment: '🏥',
  reminder:    '🔔',
  treatment:   '💊',
  other:       '📌',
}

const COL = 'CalendarEvents'

export async function getCalendarEvents(uid: string): Promise<CalendarCustomEvent[]> {
  const snap = await getDocs(
    query(collection(db, COL), where('ownerId', '==', uid), orderBy('date', 'asc')),
  )
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as CalendarCustomEvent)
}

export async function addCalendarEvent(
  uid: string,
  data: Omit<CalendarCustomEvent, 'id' | 'ownerId' | 'Created' | 'Updated'>,
): Promise<string> {
  const now = isoNow()
  const ref = await addDoc(collection(db, COL), { ...data, ownerId: uid, Created: now, Updated: now })
  return ref.id
}

export async function updateCalendarEvent(
  id: string,
  data: Partial<Omit<CalendarCustomEvent, 'id' | 'ownerId' | 'Created'>>,
): Promise<void> {
  await updateDoc(doc(db, COL, id), { ...data, Updated: isoNow() })
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id))
}
