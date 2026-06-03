import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { FullPageSpinner } from './components/ui/Spinner'
import { SideNav } from './components/layout/SideNav'

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
import { FarmImportPage } from './pages/FarmImportPage'
import { ShareInvitesPage } from './pages/ShareInvitesPage'
import { CalendarPage } from './pages/CalendarPage'
import { VaccinationReportPage } from './pages/VaccinationReportPage'

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify/:uid" element={<PublicVerifyPage />} />
          {/* Farm animal public verification — no auth needed */}
          <Route path="/verify/farm/:uid/:animalId" element={<PublicVerifyPage />} />
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
      {/* Farm / Commercial routes */}
      <Route path="/farm" element={<FarmPage />} />
      <Route path="/farm/import" element={<FarmImportPage />} />
      <Route path="/farm/add" element={<AddFarmAnimalPage />} />
      <Route path="/farm/:animalId" element={<FarmAnimalDetailPage />} />
      <Route path="/farm/:animalId/vaccines/add" element={<AddFarmAnimalVaccinePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </AppLayout>
  )
}

// ── Responsive layout shell ────────────────────────────────────────────────────
// On lg+ screens: fixed left sidebar + scrollable content column
// On mobile: transparent wrapper (pages handle their own layout)

function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  // No sidebar on onboarding
  const showSidebar = !location.pathname.startsWith('/onboarding')

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      {showSidebar && <SideNav />}
      {/* Content column — each page handles its own internal scroll */}
      <div className="flex-1 min-w-0 h-screen overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
