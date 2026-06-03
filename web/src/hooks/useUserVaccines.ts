import { useEffect, useState } from 'react'
import { subscribeToUserVaccines } from '../services/vaccineService'
import type { UserVaccine } from '../types/vaccine'

export function useUserVaccines(uid: string | undefined) {
  const [vaccines, setVaccines] = useState<UserVaccine[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) { setLoading(false); return }
    const unsub = subscribeToUserVaccines(uid, data => {
      setVaccines(data)
      setLoading(false)
    })
    return unsub
  }, [uid])

  return { vaccines, loading }
}
