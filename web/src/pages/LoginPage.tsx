import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export function LoginPage() {
  const {
    user, loading: authLoading,
    signInWithGoogle, signInWithApple, sendMagicLink, completeMagicLinkSignIn,
  } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState<'google' | 'apple' | 'link' | 'completing' | null>(null)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [linkSent, setLinkSent] = useState(false)

  // Navigate away once Firebase auth + profile loading is fully complete.
  // This replaces the inline navigate('/') calls that raced with onAuthStateChanged.
  useEffect(() => {
    if (!authLoading && user) {
      navigate('/', { replace: true })
    }
  }, [user, authLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  // On mount: check if this page load is a magic-link redirect
  useEffect(() => {
    async function tryComplete() {
      setLoading('completing')
      try {
        const done = await completeMagicLinkSignIn()
        // Navigation is handled by the authLoading/user effect above
        if (!done) setLoading(null)
      } catch (e: unknown) {
        setError((e as Error).message)
        setLoading(null)
      }
    }
    tryComplete()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGoogle() {
    setLoading('google'); setError('')
    try {
      await signInWithGoogle()
      // Don't navigate here — the authLoading/user effect above handles it
      // once onAuthStateChanged fires and loadProfile completes.
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(null)
    }
  }

  async function handleApple() {
    setLoading('apple'); setError('')
    try {
      await signInWithApple()
      // Same — navigation deferred to authLoading/user effect
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(null)
    }
  }

  async function handleMagicLink() {
    if (!email.trim()) return
    setLoading('link'); setError('')
    try {
      await sendMagicLink(email.trim().toLowerCase())
      setLinkSent(true)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(null)
    }
  }

  // Full-screen spinner while completing a magic-link redirect
  if (loading === 'completing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-600 to-blue-800">
        <div className="text-center text-white">
          <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="font-medium">Signing you in…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-600 to-blue-800 flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-16 text-center">
        <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Vaccine Passport</h1>
        <p className="text-blue-200 text-base">Your secure digital health record</p>
      </div>

      {/* Sign-in card */}
      <div className="bg-white dark:bg-gray-800 rounded-t-3xl px-6 pt-8 pb-10 pb-safe">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">Get started</h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Sign in securely to access your vaccine records</p>

        <div className="flex flex-col gap-3">
          {/* Google */}
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            loading={loading === 'google'}
            onClick={handleGoogle}
            className="border border-gray-200"
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
            Continue with Google
          </Button>

          {/* Apple */}
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={loading === 'apple'}
            onClick={handleApple}
            className="bg-black hover:bg-gray-900"
          >
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            Continue with Apple
          </Button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-600" />
            <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">or sign in with email link</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-600" />
          </div>

          {/* Email magic link */}
          {linkSent ? (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="font-semibold text-green-800 text-sm">Check your email</p>
              <p className="text-green-600 text-xs mt-1">
                A sign-in link was sent to <strong>{email}</strong>.<br />
                The link expires in 1 hour. Open it on this device.
              </p>
              <button
                onClick={() => { setLinkSent(false); setEmail('') }}
                className="mt-3 text-xs text-green-600 underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Input
                label="Your email address"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              <Button
                size="lg"
                fullWidth
                loading={loading === 'link'}
                onClick={handleMagicLink}
                disabled={!email.trim()}
                variant="secondary"
                className="border border-blue-200 text-blue-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Send sign-in link
              </Button>
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                Only works with an existing account. New users sign in with Google.
              </p>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-500 text-center">{error}</p>
        )}

        <p className="mt-6 text-xs text-gray-400 dark:text-gray-500 text-center">
          By continuing you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  )
}
