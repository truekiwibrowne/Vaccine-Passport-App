import {
  collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Clinic } from '../types/admin'
import { isoNow } from '../utils/dateUtils'

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
