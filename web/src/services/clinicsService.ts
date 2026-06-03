import {
  collection, getDocs, addDoc, doc, updateDoc, deleteDoc, setDoc, query, orderBy,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Clinic } from '../types/admin'
import { isoNow } from '../utils/dateUtils'
import type { ClinicImportData } from '../utils/clinicsCsv'

export async function getClinics(): Promise<Clinic[]> {
  const snap = await getDocs(query(collection(db, 'Clinics'), orderBy('name')))
  return snap.docs.map(d => ({ ...d.data(), id: d.id }) as Clinic)
}

export async function addClinic(data: Omit<Clinic, 'id' | 'Created'>): Promise<string> {
  const ref = await addDoc(collection(db, 'Clinics'), { ...data, Created: isoNow() })
  return ref.id
}

export async function updateClinic(id: string, data: Partial<Omit<Clinic, 'id' | 'Created'>>): Promise<void> {
  await updateDoc(doc(db, 'Clinics', id), data)
}

export async function deleteClinic(id: string): Promise<void> {
  await deleteDoc(doc(db, 'Clinics', id))
}

/**
 * Bulk upsert: rows with an id are merged into existing docs;
 * rows without an id are added as new docs.
 */
export async function bulkUpsertClinics(rows: ClinicImportData[]): Promise<void> {
  await Promise.all(rows.map(row => {
    const { id, ...data } = row
    if (id) {
      return updateDoc(doc(db, 'Clinics', id), data)
    }
    return addDoc(collection(db, 'Clinics'), { ...data, Created: isoNow() })
  }))
}

/** Upsert by name+country — used when importing rows that lack an id.
 *  If a clinic with the same name already exists, it merges; otherwise inserts. */
export async function bulkUpsertClinicsById(rows: ClinicImportData[]): Promise<void> {
  const updates = rows.filter(r => r.id)
  const inserts = rows.filter(r => !r.id)
  await Promise.all([
    ...updates.map(({ id, ...data }) =>
      setDoc(doc(db, 'Clinics', id!), { ...data }, { merge: true })
    ),
    ...inserts.map(({ id: _id, ...data }) =>
      addDoc(collection(db, 'Clinics'), { ...data, Created: isoNow() })
    ),
  ])
}
