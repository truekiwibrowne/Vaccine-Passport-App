import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, getDoc, query, orderBy } from 'firebase/firestore'
import { db } from '../firebase'
import { isoNow } from '../utils/dateUtils'
import type { STILibraryEntry } from '../types/stiLibrary'

const col = () => collection(db, 'STI_Library')
const docRef = (id: string) => doc(db, 'STI_Library', id)

export async function getSTILibrary(): Promise<STILibraryEntry[]> {
  const snap = await getDocs(query(col(), orderBy('name', 'asc')))
  return snap.docs.map(d => ({ ...d.data(), id: d.id }) as STILibraryEntry)
}

export async function getSTIEntry(id: string): Promise<STILibraryEntry | null> {
  const snap = await getDoc(docRef(id))
  if (!snap.exists()) return null
  return { ...snap.data(), id: snap.id } as STILibraryEntry
}

export async function addSTIEntry(data: Omit<STILibraryEntry, 'id' | 'Created' | 'Updated'>): Promise<string> {
  const now = isoNow()
  const ref = await addDoc(col(), { ...data, Created: now, Updated: now })
  return ref.id
}

export async function updateSTIEntry(id: string, data: Partial<Omit<STILibraryEntry, 'id' | 'Created'>>): Promise<void> {
  await updateDoc(docRef(id), { ...data, Updated: isoNow() })
}

export async function deleteSTIEntry(id: string): Promise<void> {
  await deleteDoc(docRef(id))
}
