export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

export function isExpired(iso: string | null | undefined): boolean {
  if (!iso) return false
  return new Date(iso) < new Date()
}

export function isoNow(): string {
  return new Date().toISOString()
}
