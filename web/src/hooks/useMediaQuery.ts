import { useState, useEffect } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    const mq = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [query])

  return matches
}

/** True when viewport is ≥ 768px (md breakpoint) */
export function useIsMd() { return useMediaQuery('(min-width: 768px)') }

/** True when viewport is ≥ 1024px (lg breakpoint) */
export function useIsLg() { return useMediaQuery('(min-width: 1024px)') }
