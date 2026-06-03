import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'

const HomeIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
)
const FarmIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
)
const LibraryIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
)
const PassportIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
  </svg>
)
const ValidateIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
)
const VaccinesIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12l-7.5-7.5L4.5 12M12 4.5v15" />
  </svg>
)
const ProfileIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
)
const CalendarIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)
const AdminIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  exact?: boolean
}

export function SideNav() {
  const { profile, user } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const isFarmMode = profile?.appMode === 'farm'
  const avatarSrc = profile?.Profile_Image ?? null

  const farmNavItems: NavItem[] = [
    { to: '/', label: 'Dashboard', icon: <HomeIcon />, exact: true },
    { to: '/farm', label: 'My Farm', icon: <FarmIcon /> },
    { to: '/library?category=animal', label: 'Vaccine Library', icon: <LibraryIcon /> },
    { to: '/calendar', label: 'Calendar', icon: <CalendarIcon /> },
    { to: '/validate', label: 'Validation', icon: <ValidateIcon /> },
  ]

  const personalNavItems: NavItem[] = [
    { to: '/', label: 'Home', icon: <HomeIcon />, exact: true },
    { to: '/vaccines', label: 'My Vaccines', icon: <VaccinesIcon /> },
    { to: '/library', label: 'Library', icon: <LibraryIcon /> },
    { to: '/passport', label: 'Passport', icon: <PassportIcon /> },
    { to: '/calendar', label: 'Calendar', icon: <CalendarIcon /> },
    { to: '/validate', label: 'Validation', icon: <ValidateIcon /> },
  ]

  const navItems = isFarmMode ? farmNavItems : personalNavItems

  const bg = isDark ? 'bg-gray-900 border-gray-700/60' : 'bg-white border-gray-200/80'
  const activeClass = isDark
    ? 'bg-blue-900/40 text-blue-400'
    : isFarmMode
      ? 'bg-green-50 text-green-700'
      : 'bg-blue-50 text-blue-600'
  const inactiveClass = isDark
    ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'

  return (
    <aside className={`hidden lg:flex flex-col w-56 h-screen border-r flex-shrink-0 ${bg}`}>
      {/* Logo / App name */}
      <div className="px-5 pt-7 pb-5">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isFarmMode ? 'bg-green-600' : 'bg-blue-600'}`}>
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">VacciPass</p>
            {isFarmMode && (
              <p className="text-[10px] font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide">Farm Mode</p>
            )}
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact ?? false}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive ? activeClass : inactiveClass
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Admin link */}
      {profile?.Admin && (
        <div className="px-3 pb-2">
          <button
            onClick={() => navigate('/admin')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${inactiveClass}`}
          >
            <AdminIcon />
            Admin Panel
          </button>
        </div>
      )}

      {/* Profile footer */}
      <div className={`px-3 pb-5 pt-2 border-t ${isDark ? 'border-gray-700/60' : 'border-gray-200/80'}`}>
        <button
          onClick={() => navigate('/profile')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${inactiveClass}`}
        >
          <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0 flex items-center justify-center">
            {avatarSrc
              ? <img src={avatarSrc} alt="Profile" className="w-full h-full object-cover" />
              : <ProfileIcon />
            }
          </div>
          <span className="truncate">{profile?.Username ?? user?.email ?? 'Profile'}</span>
        </button>
      </div>
    </aside>
  )
}
