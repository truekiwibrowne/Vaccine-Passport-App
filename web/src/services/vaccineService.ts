import {
  collection, doc, getDocs, updateDoc,
  onSnapshot, query, orderBy, writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { UserVaccine, PublicVaccineRecord } from '../types/vaccine'
import { isoNow } from '../utils/dateUtils'

function vaccinesRef(uid: string) {
  return collection(db, 'User_Data', uid, 'Vaccines')
}

function publicVaccinesRef(uid: string) {
  return collection(db, 'User_Data', uid, 'Public_Vaccines')
}

export async function getUserVaccines(uid: string): Promise<UserVaccine[]> {
  const snap = await getDocs(query(vaccinesRef(uid), orderBy('date_administration', 'desc')))
  return snap.docs.map(d => ({ ...d.data(), user_vaccine_id: d.id }) as UserVaccine)
}

export function subscribeToUserVaccines(uid: string, cb: (vaccines: UserVaccine[]) => void) {
  return onSnapshot(
    query(vaccinesRef(uid), orderBy('date_administration', 'desc')),
    snap => cb(snap.docs.map(d => ({ ...d.data(), user_vaccine_id: d.id }) as UserVaccine))
  )
}

export async function addUserVaccine(uid: string, data: Omit<UserVaccine, 'user_vaccine_id' | 'Created' | 'Updated'>): Promise<string> {
  const now = isoNow()
  const batch = writeBatch(db)

  const newRef = doc(vaccinesRef(uid))
  const vaccineData: Omit<UserVaccine, 'user_vaccine_id'> = { ...data, Created: now, Updated: now }
  batch.set(newRef, vaccineData)

  // Write-through to Public_Vaccines
  const pubRecord: PublicVaccineRecord = {
    vaccine_name: data.vaccine_name,
    Authenticated: data.Authenticated,
    authentication_level: data.authentication_level,
    Authentication_Date: data.Authentication_Date,
    Expiration_date: data.Expiration_date,
    ...(data.isEntryRequirement ? { isEntryRequirement: true } : {}),
  }
  batch.set(doc(publicVaccinesRef(uid), newRef.id), pubRecord)

  await batch.commit()
  return newRef.id
}

export async function updateUserVaccine(uid: string, vaccineId: string, data: Partial<UserVaccine>): Promise<void> {
  const batch = writeBatch(db)

  batch.update(doc(vaccinesRef(uid), vaccineId), { ...data, Updated: isoNow() })

  // Sync public fields if relevant ones changed
  const pubUpdates: Partial<PublicVaccineRecord> = {}
  if (data.vaccine_name !== undefined) pubUpdates.vaccine_name = data.vaccine_name
  if (data.Authenticated !== undefined) pubUpdates.Authenticated = data.Authenticated
  if (data.authentication_level !== undefined) pubUpdates.authentication_level = data.authentication_level
  if (data.Authentication_Date !== undefined) pubUpdates.Authentication_Date = data.Authentication_Date
  if (data.Expiration_date !== undefined) pubUpdates.Expiration_date = data.Expiration_date

  if (Object.keys(pubUpdates).length > 0) {
    batch.update(doc(publicVaccinesRef(uid), vaccineId), pubUpdates)
  }

  await batch.commit()
}

export async function deleteUserVaccine(uid: string, vaccineId: string): Promise<void> {
  const batch = writeBatch(db)
  batch.delete(doc(vaccinesRef(uid), vaccineId))
  batch.delete(doc(publicVaccinesRef(uid), vaccineId))
  await batch.commit()
}

export async function toggleFavourite(uid: string, vaccineId: string, current: boolean): Promise<void> {
  await updateDoc(doc(vaccinesRef(uid), vaccineId), { Favourited: !current, Updated: isoNow() })
}
