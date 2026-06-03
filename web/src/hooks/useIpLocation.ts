import { useState, useEffect } from 'react'

interface IpLocation {
  country: string       // e.g. "Kenya"
  countryCode: string   // e.g. "KE"
  loading: boolean
}

const cache: IpLocation | null = null

export function useIpLocation(): IpLocation {
  const [state, setState] = useState<IpLocation>({
    country: '',
    countryCode: '',
    loading: true,
  })

  useEffect(() => {
    // Return cached result if already fetched this session
    if (cache) { setState(cache); return }

    fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(5000) })
      .then(r => r.json())
      .then((data: { country_name?: string; country_code?: string }) => {
        setState({
          country: data.country_name ?? '',
          countryCode: data.country_code ?? '',
          loading: false,
        })
      })
      .catch(() => {
        // Silently fail — IP location is best-effort
        setState({ country: '', countryCode: '', loading: false })
      })
  }, [])

  return state
}
