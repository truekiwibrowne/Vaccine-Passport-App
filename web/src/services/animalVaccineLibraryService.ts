import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore'
import { db } from '../firebase'
import type { AnimalVaccineEntry } from '../types/animalVaccine'

const COL = 'Animal_Vaccine_Library'

export async function getAllAnimalVaccines(): Promise<AnimalVaccineEntry[]> {
  const snap = await getDocs(query(collection(db, COL), orderBy('Vac_Name', 'asc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as AnimalVaccineEntry)
}

export function searchAnimalLibrary(entries: AnimalVaccineEntry[], q: string, species?: string): AnimalVaccineEntry[] {
  let results = entries
  if (species && species !== 'other') {
    results = results.filter(e => e.Species?.includes('all') || e.Species?.includes(species))
  }
  if (!q.trim()) return results
  const lq = q.toLowerCase()
  return results.filter(e =>
    e.Vac_Name?.toLowerCase().includes(lq) ||
    e.Disease_Target?.toLowerCase().includes(lq) ||
    e.Manufacturer?.toLowerCase().includes(lq)
  )
}

export async function addAnimalVaccine(data: Omit<AnimalVaccineEntry, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, COL), data)
  return ref.id
}

export async function updateAnimalVaccine(id: string, data: Partial<Omit<AnimalVaccineEntry, 'id'>>): Promise<void> {
  await updateDoc(doc(db, COL, id), data)
}

export async function deleteAnimalVaccine(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id))
}
