export function buildVerifyUrl(uid: string): string {
  const base = import.meta.env.VITE_APP_URL || window.location.origin
  return `${base}/verify/${uid}`
}
