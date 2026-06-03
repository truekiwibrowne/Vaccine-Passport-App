import {
  collection, getDocs, addDoc, doc, updateDoc, deleteDoc, getDoc, setDoc,
  query, orderBy, where,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Practitioner } from '../types/admin'
import { isoNow } from '../utils/dateUtils'
import type { PractitionerImportData } from '../utils/practitionersCsv'

export async function getPractitioners(): Promise<Practitioner[]> {
  const snap = await getDocs(query(collection(db, 'Practitioners'), orderBy('name')))
  return snap.docs.map(d => ({ ...d.data(), id: d.id }) as Practitioner)
}

/**
 * Return only active practitioners appropriate for the given vaccine context.
 * Legacy docs without practitionerType default to 'human'.
 */
export async function getPractitionersForVaccineType(
  vaccineType: 'human' | 'veterinary',
): Promise<Practitioner[]> {
  const all = await getPractitioners()
  return all.filter(p => {
    if (!p.active) return false
    const pt = p.practitionerType ?? 'human'
    return pt === vaccineType
  })
}

export async function getPractitionerByEmail(email: string): Promise<Practitioner | null> {
  const snap = await getDocs(
    query(collection(db, 'Practitioners'), where('email', '==', email.toLowerCase()), where('active', '==', true))
  )
  if (snap.empty) return null
  const d = snap.docs[0]
  return { ...d.data(), id: d.id } as Practitioner
}

export async function addPractitioner(data: Omit<Practitioner, 'id' | 'Created'>): Promise<string> {
  const ref = await addDoc(collection(db, 'Practitioners'), {
    ...data,
    email: data.email.toLowerCase(),
    Created: isoNow(),
  })
  return ref.id
}

export async function updatePractitioner(id: string, data: Partial<Omit<Practitioner, 'id' | 'Created'>>): Promise<void> {
  await updateDoc(doc(db, 'Practitioners', id), data)
}

export async function deletePractitioner(id: string): Promise<void> {
  await deleteDoc(doc(db, 'Practitioners', id))
}

/** Look up a practitioner whose Firestore doc ID equals the given UID (self-registered). */
export async function getPractitionerByUid(uid: string): Promise<Practitioner | null> {
  const snap = await getDoc(doc(db, 'Practitioners', uid))
  if (!snap.exists()) return null
  return { ...snap.data(), id: snap.id } as Practitioner
}

/**
 * Self-register the current user as a level-1 practitioner.
 * The Firestore doc ID is set to the user's UID so the security rule can verify it.
 */
export async function selfRegisterPractitioner(
  uid: string,
  data: { name: string; email: string; speciality?: string }
): Promise<void> {
  await setDoc(doc(db, 'Practitioners', uid), {
    uid,
    name: data.name,
    email: data.email.toLowerCase(),
    speciality: data.speciality ?? '',
    clinicId: '',
    clinicName: '',
    verificationLevel: 1,
    verifiedBy: 'Self-registered',
    verifiedAt: isoNow(),
    active: true,
    Created: isoNow(),
  })
}

/**
 * Bulk upsert: rows with an id are merged; rows without are added as new docs.
 * Does NOT overwrite verifiedBy/verifiedAt — those are preserved from existing docs.
 */
export async function bulkUpsertPractitioners(rows: PractitionerImportData[]): Promise<void> {
  await Promise.all(rows.map(row => {
    const { id, ...data } = row
    const payload = { ...data, email: (data.email ?? '').toLowerCase() }
    if (id) {
      return setDoc(doc(db, 'Practitioners', id), payload, { merge: true })
    }
    return addDoc(collection(db, 'Practitioners'), { ...payload, verifiedBy: '', verifiedAt: '', Created: isoNow() })
  }))
}

/**
 * Peer upgrade: an approver (level ≥ 2) upgrades someone to (approver level − 1).
 * Firestore rules enforce the caller has sufficient level.
 */
export async function peerUpgradePractitioner(
  targetUid: string,
  newLevel: number,
  approverName: string
): Promise<void> {
  await setDoc(doc(db, 'Practitioners', targetUid), {
    verificationLevel: newLevel,
    verifiedBy: approverName,
    verifiedAt: isoNow(),
  }, { merge: true })
}
