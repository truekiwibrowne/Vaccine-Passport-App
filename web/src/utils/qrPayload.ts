/**
 * Builds the public verify URL for a user's QR code.
 *
 * Always uses window.location.origin so the URL is correct on every deployment:
 *   - Production (Netlify):  https://vaxpass-app.netlify.app/verify/:uid
 *   - Local dev via LAN IP:  http://192.168.x.x:5173/verify/:uid  ← works on phone
 *
 * TIP: when testing QR scanning locally, open the app at the LAN IP
 * (e.g. http://192.168.100.197:5173) rather than localhost — the QR will then
 * encode the LAN address and your phone can reach the dev server directly.
 */
export function buildVerifyUrl(uid: string): string {
  return `${window.location.origin}/verify/${uid}`
}

/**
 * The app's canonical public URL — used in PDFs, emails, and server functions
 * where window is not available. Falls back to the Netlify URL.
 */
export const APP_PUBLIC_URL =
  import.meta.env.VITE_APP_URL ?? 'https://vaxpass-app.netlify.app'
