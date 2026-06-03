import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut,
  sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink,
  fetchSignInMethodsForEmail,
  type User,
} from 'firebase/auth'
import { auth, googleProvider, appleProvider } from '../firebase'
import { getUserProfile, createUserProfile, checkIsAdmin } from '../services/userService'
import type { UserProfile } from '../types/user'

const EMAIL_LINK_KEY = 'emailForSignIn'

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signInWithApple: () => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  sendMagicLink: (email: string) => Promise<void>
  completeMagicLinkSignIn: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(u: User) {
    try {
      let p = await getUserProfile(u.uid)
      if (!p) {
        // First sign-in — create stub profile from Google/Apple account data
        await createUserProfile(u.uid, {
          Full_Name: u.displayName ?? '',
          Email: u.email ?? '',
          Username: u.email?.split('@')[0] ?? '',
          Profile_Image: u.photoURL ?? '',
        })
        p = await getUserProfile(u.uid)
      }
      // Admin status comes from the Admins/{uid} collection — not the User_Data field.
      // This is reliable regardless of field types and avoids the get() rule issue.
      const admin = await checkIsAdmin(u.uid)
      setProfile(p ? { ...p, Admin: admin } : p)
    } catch (err) {
      console.error('loadProfile error:', err)
      setProfile(null)
    }
  }

  useEffect(() => {
    return onAuthStateChanged(auth, async u => {
      // Set loading TRUE immediately so AuthGuard never sees the brief
      // window of (loading=false, user≠null, profile=null) that causes a
      // spurious redirect to /onboarding on re-sign-in.
      setLoading(true)
      setUser(u)
      try {
        if (u) await loadProfile(u)
        else setProfile(null)
      } finally {
        setLoading(false)
      }
    })
  }, [])

  async function signInWithGoogle() {
    await signInWithPopup(auth, googleProvider)
  }

  async function signInWithApple() {
    await signInWithPopup(auth, appleProvider)
  }

  async function signOut() {
    await firebaseSignOut(auth)
    setUser(null)
    setProfile(null)
  }

  async function refreshProfile() {
    if (user) await loadProfile(user)
  }

  /**
   * Send a Firebase passwordless sign-in link to the given email.
   * Throws if the email has no existing account in Firebase Auth.
   */
  async function sendMagicLink(email: string): Promise<void> {
    // Check the email exists in Firebase Auth before sending
    const methods = await fetchSignInMethodsForEmail(auth, email)
    if (methods.length === 0) {
      throw new Error('No account found with that email address. Sign in with Google to create one.')
    }

    const actionCodeSettings = {
      url: window.location.origin + '/login',
      handleCodeInApp: true,
    }
    await sendSignInLinkToEmail(auth, email, actionCodeSettings)
    // Store email so we can retrieve it after the user clicks the link
    window.localStorage.setItem(EMAIL_LINK_KEY, email)
  }

  /**
   * Call this on page load (in LoginPage) to detect and complete a
   * magic-link sign-in when the user returns from their email.
   * Returns true if a sign-in was completed, false otherwise.
   */
  async function completeMagicLinkSignIn(): Promise<boolean> {
    if (!isSignInWithEmailLink(auth, window.location.href)) return false
    let email = window.localStorage.getItem(EMAIL_LINK_KEY)
    if (!email) {
      // Fallback: ask the user to re-enter their email (e.g. opened on different device)
      email = window.prompt('Please confirm your email address to sign in:')
    }
    if (!email) return false
    await signInWithEmailLink(auth, email, window.location.href)
    window.localStorage.removeItem(EMAIL_LINK_KEY)
    return true
  }

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      signInWithGoogle, signInWithApple, signOut, refreshProfile,
      sendMagicLink, completeMagicLinkSignIn,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
