import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom'
import { useRef, useState, useCallback, useEffect } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { lockSession } from './services/sexualHealthService'
import { ThemeProvider } from './contexts/ThemeContext'
import { FullPageSpinner } from './components/ui/Spinner'
import { SideNav } from './components/layout/SideNav'
import { PHRApprovalBanner } from './components/phr/PHRApprovalBanner'

import { LoginPage } from './pages/LoginPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { HomePage } from './pages/HomePage'
import { PassportPage } from './pages/PassportPage'
import { AddVaccinePage } from './pages/AddVaccinePage'
import { VaccineDetailPage } from './pages/VaccineDetailPage'
import { LibraryPage } from './pages/LibraryPage'
import { LibraryDetailPage } from './pages/LibraryDetailPage'
import { ValidationInboxPage } from './pages/ValidationInboxPage'
import { ProfilePage } from './pages/ProfilePage'
import { PublicVerifyPage } from './pages/PublicVerifyPage'
import { AdminPage } from './pages/AdminPage'
import { PeerVerificationInboxPage } from './pages/PeerVerificationInboxPage'
import { DependentsPage } from './pages/DependentsPage'
import { DependentVaccinesPage } from './pages/DependentVaccinesPage'
import { AddDependentVaccinePage } from './pages/AddDependentVaccinePage'
import { PetsPage } from './pages/PetsPage'
import { PetVaccinesPage } from './pages/PetVaccinesPage'
import { AddPetVaccinePage } from './pages/AddPetVaccinePage'
import { MyVaccinesPage } from './pages/MyVaccinesPage'
import { DependentVaccineDetailPage } from './pages/DependentVaccineDetailPage'
import { PetVaccineDetailPage } from './pages/PetVaccineDetailPage'
import { FarmPage } from './pages/FarmPage'
import { AddFarmAnimalPage } from './pages/AddFarmAnimalPage'
import { FarmAnimalDetailPage } from './pages/FarmAnimalDetailPage'
import { AddFarmAnimalVaccinePage } from './pages/AddFarmAnimalVaccinePage'
import { AddHerdVaccinePage } from './pages/AddHerdVaccinePage'
import { FarmImportPage } from './pages/FarmImportPage'
import { FarmArchivePage } from './pages/FarmArchivePage'
import { ShareInvitesPage } from './pages/ShareInvitesPage'
import { CalendarPage } from './pages/CalendarPage'
import { VaccinationReportPage } from './pages/VaccinationReportPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { SexualHealthPage } from './pages/SexualHealthPage'
import { AddSexualHealthRecordPage } from './pages/AddSexualHealthRecordPage'
import { PublicSexualHealthPage } from './pages/PublicSexualHealthPage'
import { STILibraryPage } from './pages/STILibraryPage'

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify/:uid" element={<PublicVerifyPage />} />
          {/* Dependent public verification — no auth needed */}
          <Route path="/verify/dep/:uid/:depId" element={<PublicVerifyPage />} />
          {/* Pet public verification — no auth needed */}
          <Route path="/verify/pet/:uid/:petId" element={<PublicVerifyPage />} />
          {/* Farm animal public verification — no auth needed */}
          <Route path="/verify/farm/:uid/:animalId" element={<PublicVerifyPage />} />
          {/* Sexual health QR public page — no auth needed */}
          <Route path="/sh/:token" element={<PublicSexualHealthPage />} />
          <Route path="*" element={<AuthGuard />} />
        </Routes>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

function AuthGuard() {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageSpinner />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (!profile?.onboardingComplete && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  // Admin-only guard
  if (location.pathname.startsWith('/admin') && !profile?.Admin) {
    return <Navigate to="/" replace />
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/" element={<HomePage />} />
      <Route path="/passport" element={<PassportPage />} />
      <Route path="/vaccines" element={<MyVaccinesPage />} />
      <Route path="/vaccines/add" element={<AddVaccinePage />} />
      <Route path="/vaccines/:id" element={<VaccineDetailPage />} />
      <Route path="/library" element={<LibraryPage />} />
      <Route path="/library/:id" element={<LibraryDetailPage />} />
      <Route path="/validate" element={<ValidationInboxPage />} />
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/share-invites" element={<ShareInvitesPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/peer-verify" element={<PeerVerificationInboxPage />} />
      <Route path="/dependents" element={<DependentsPage />} />
      <Route path="/dependents/:depId" element={<DependentVaccinesPage />} />
      <Route path="/dependents/:depId/vaccines/add" element={<AddDependentVaccinePage />} />
      <Route path="/dependents/:depId/vaccines/:vaccineId" element={<DependentVaccineDetailPage />} />
      <Route path="/pets" element={<PetsPage />} />
      <Route path="/pets/:petId" element={<PetVaccinesPage />} />
      <Route path="/pets/:petId/vaccines/add" element={<AddPetVaccinePage />} />
      <Route path="/pets/:petId/vaccines/:vaccineId" element={<PetVaccineDetailPage />} />
      <Route path="/calendar" element={<CalendarPage />} />
      <Route path="/report" element={<VaccinationReportPage />} />
      {/* Private sexual health — nested so SexualHealthLayout auto-locks on exit */}
      <Route path="/health/sexual" element={<SexualHealthLayout />}>
        <Route index element={<SexualHealthPage />} />
        <Route path="library" element={<STILibraryPage />} />
        <Route path="add" element={<AddSexualHealthRecordPage />} />
      </Route>
      {/* Farm / Commercial routes */}
      <Route path="/farm" element={<FarmPage />} />
      <Route path="/farm/import" element={<FarmImportPage />} />
      <Route path="/farm/archive" element={<FarmArchivePage />} />
      <Route path="/farm/add" element={<AddFarmAnimalPage />} />
      <Route path="/farm/herd/vaccines/add" element={<AddHerdVaccinePage />} />
      <Route path="/farm/:animalId" element={<FarmAnimalDetailPage />} />
      <Route path="/farm/:animalId/vaccines/add" element={<AddFarmAnimalVaccinePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </AppLayout>
  )
}

// ── Sexual health layout — locks session when user navigates away ──────────────
// All /health/sexual/* routes are children of this layout. Because React Router
// keeps the layout mounted while navigating between child routes but unmounts it
// when leaving the /health/sexual section entirely, the cleanup effect locks the
// session automatically — no PIN re-entry needed between sub-pages.

function SexualHealthLayout() {
  const { user } = useAuth()
  useEffect(() => {
    return () => {
      if (user) lockSession(user.uid)
    }
  }, [user])
  return <Outlet />
}

// ── Responsive layout shell ────────────────────────────────────────────────────
// On lg+ screens: fixed left sidebar + scrollable content column
// On mobile: transparent wrapper (pages handle their own layout)

const SIDEBAR_MIN = 180
const SIDEBAR_MAX = 400
const SIDEBAR_DEFAULT = 240

function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const showSidebar = !location.pathname.startsWith('/onboarding')

  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem('sidebarWidth')
    const n = saved ? parseInt(saved, 10) : SIDEBAR_DEFAULT
    return isNaN(n) ? SIDEBAR_DEFAULT : Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, n))
  })

  const isResizing = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(sidebarWidth)

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return
    const delta = e.clientX - startX.current
    const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startWidth.current + delta))
    setSidebarWidth(next)
  }, [])

  const onMouseUp = useCallback(() => {
    if (!isResizing.current) return
    isResizing.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    setSidebarWidth(w => {
      localStorage.setItem('sidebarWidth', String(w))
      return w
    })
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }, [onMouseMove])

  const startResize = useCallback((e: React.MouseEvent) => {
    isResizing.current = true
    startX.current = e.clientX
    startWidth.current = sidebarWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [sidebarWidth, onMouseMove, onMouseUp])

  // Clean up listeners if component unmounts mid-drag
  useEffect(() => () => {
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }, [onMouseMove, onMouseUp])

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      {showSidebar && (
        <>
          <SideNav width={sidebarWidth} />
          {/* Drag handle */}
          <div
            onMouseDown={startResize}
            className="hidden lg:flex w-1 flex-shrink-0 cursor-col-resize group relative"
          >
            <div className="absolute inset-y-0 -left-0.5 -right-0.5 group-hover:bg-blue-400/40 dark:group-hover:bg-blue-500/30 transition-colors rounded-full" />
          </div>
        </>
      )}
      {/* Content column — each page handles its own internal scroll */}
      <div className="flex-1 min-w-0 h-screen overflow-y-auto">
        {children}
      </div>

      {/* Global PHR cross-device approval banner — renders on top when a PIN setup request arrives */}
      <PHRApprovalBanner />
    </div>
  )
}
