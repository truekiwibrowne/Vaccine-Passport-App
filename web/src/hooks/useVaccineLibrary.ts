import { useEffect, useState } from 'react'
import { getAllVaccineLibraryEntries } from '../services/vaccineLibraryService'
import type { VaccineLibraryEntry } from '../types/vaccineLibrary'

export function useVaccineLibrary() {
  const [library, setLibrary] = useState<VaccineLibraryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAllVaccineLibraryEntries()
      .then(setLibrary)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return { library, loading, error }
}
