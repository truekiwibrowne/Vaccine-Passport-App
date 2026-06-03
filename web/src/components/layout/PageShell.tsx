import type { ReactNode } from 'react'
import { useTheme } from '../../contexts/ThemeContext'

interface PageShellProps {
  children: ReactNode
  title?: string
  action?: ReactNode
  noPad?: boolean
  onBack?: () => void
}

export function PageShell({ children, title, action, noPad, onBack }: PageShellProps) {
  const { isDark } = useTheme()
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-8">
      {title && (
        <header
          className="sticky top-0 z-40 px-4 pt-safe border-b border-white/20 dark:border-white/10"
          style={{
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            background: isDark ? 'rgba(15,15,15,0.50)' : 'rgba(242,242,247,0.50)',
          }}
        >
          <div className="flex items-center h-14 max-w-2xl mx-auto gap-2">
            {onBack && (
              <button onClick={onBack} className="p-2 -ml-2 flex-shrink-0">
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h1 className="flex-1 text-lg font-semibold text-gray-900 dark:text-white">{title}</h1>
            {action}
          </div>
        </header>
      )}
      <main className={noPad ? '' : 'px-4 py-4 max-w-2xl mx-auto'}>
        {children}
      </main>
    </div>
  )
}
