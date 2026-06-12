import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import { useIsLg } from '../hooks/useMediaQuery'
import { ResizableSplitPane } from '../components/layout/ResizableSplitPane'
import { getSTILibrary } from '../services/stiLibraryService'
import type { STILibraryEntry } from '../types/stiLibrary'
import { SH_CURABILITY_LABELS, SH_CURABILITY_COLOURS } from '../types/sexualHealth'
import type { SHCurability } from '../types/sexualHealth'

type CurabilityFilter = 'all' | SHCurability

function CurabilityBadge({ curability }: { curability: SHCurability }) {
  const { bg, text } = SH_CURABILITY_COLOURS[curability]
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${bg} ${text}`}>
      {SH_CURABILITY_LABELS[curability]}
    </span>
  )
}

function EntryDetail({ entry }: { entry: STILibraryEntry }) {
  return (
    <div className="p-6 flex flex-col gap-5">
      <div>
        <CurabilityBadge curability={entry.curability as SHCurability} />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{entry.name}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 leading-relaxed">{entry.shortDescription}</p>
      </div>

      {entry.symptoms.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Symptoms</p>
          <ul className="flex flex-col gap-1">
            {entry.symptoms.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {entry.transmission.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Transmission</p>
          <ul className="flex flex-col gap-1">
            {entry.transmission.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}

      {entry.treatment && (
        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Treatment</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{entry.treatment}</p>
        </div>
      )}

      {entry.preventionTips.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Prevention</p>
          <ul className="flex flex-col gap-1">
            {entry.preventionTips.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {entry.whenToTest && (
        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">When to Test</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{entry.whenToTest}</p>
        </div>
      )}

      {entry.resources.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Resources</p>
          <div className="flex flex-col gap-1">
            {entry.resources.map((r, i) => (
              <a
                key={i}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1"
              >
                {r.label}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function STILibraryPage() {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const isLg = useIsLg()

  const [entries, setEntries]           = useState<STILibraryEntry[]>([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [curabilityFilter, setCurabilityFilter] = useState<CurabilityFilter>('all')
  const [selected, setSelected]         = useState<STILibraryEntry | null>(null)
  const [expandedId, setExpandedId]     = useState<string | null>(null)

  useEffect(() => {
    getSTILibrary()
      .then(setEntries)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = entries.filter(e => {
    const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.shortDescription.toLowerCase().includes(search.toLowerCase())
    const matchCurability = curabilityFilter === 'all' || e.curability === curabilityFilter
    return matchSearch && matchCurability
  })

  const stickyHeader = (
    <div
      className="sticky top-0 z-10 px-4 pt-safe border-b border-white/10"
      style={{
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        background: isDark ? 'rgba(15,15,15,0.50)' : 'rgba(242,242,247,0.50)',
      }}
    >
      <div className="flex items-center h-14 gap-2">
        <button onClick={() => navigate('/health/sexual')} className="p-2 -ml-2">
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="flex-1 font-semibold text-gray-900 dark:text-white text-lg">STI Health Library</h1>
      </div>
    </div>
  )

  const filterBar = (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 dark:placeholder-gray-500"
          placeholder="Search conditions…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Curability filter chips */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'curable', 'clearable', 'lifelong'] as CurabilityFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setCurabilityFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              curabilityFilter === f
                ? 'bg-violet-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600'
            }`}
          >
            {f === 'all' ? 'All' : SH_CURABILITY_LABELS[f]}
          </button>
        ))}
      </div>
    </div>
  )

  const entryList = (
    <div className="flex flex-col gap-2">
      {loading ? (
        <div className="flex justify-center py-12">
          <svg className="animate-spin w-6 h-6 text-violet-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm text-center">
          <p className="text-2xl mb-2">📚</p>
          <p className="font-medium text-gray-500 dark:text-gray-400">Library not yet populated</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">The STI library hasn't been populated yet. Check back soon.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">No conditions match your search.</p>
        </div>
      ) : (
        filtered.map(e => {
          const isExpanded = expandedId === e.id
          const isSelected = selected?.id === e.id
          return (
            <div
              key={e.id}
              className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden ${isLg && isSelected ? 'ring-2 ring-violet-500' : ''}`}
            >
              {/* Card header */}
              <button
                className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
                onClick={() => {
                  if (isLg) {
                    setSelected(isSelected ? null : e)
                  } else {
                    setExpandedId(isExpanded ? null : e.id)
                  }
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{e.name}</p>
                  {!isExpanded && !isSelected && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{e.shortDescription}</p>
                  )}
                </div>
                <CurabilityBadge curability={e.curability as SHCurability} />
                {!isLg && (
                  <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>

              {/* Expanded detail (mobile accordion) */}
              {!isLg && isExpanded && (
                <div className="border-t border-gray-100 dark:border-gray-700">
                  <EntryDetail entry={e} />
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )

  // ── Desktop split layout ───────────────────────────────────────────────────────
  if (isLg) {
    return (
      <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
        {stickyHeader}
        <ResizableSplitPane
          storageKey="splitPane:stiLibrary"
          leftClassName="overflow-y-auto bg-gray-50 dark:bg-gray-900"
          rightClassName="bg-white dark:bg-gray-800 overflow-y-auto"
          left={
            <div className="p-4 flex flex-col gap-4">
              {filterBar}
              {entryList}
            </div>
          }
          right={
            selected ? (
              <EntryDetail entry={selected} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center px-8">
                <div className="w-20 h-20 rounded-3xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center mb-4 text-4xl">📚</div>
                <p className="text-lg font-semibold text-gray-400 dark:text-gray-500">Select a condition</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Click a card to view details</p>
              </div>
            )
          }
        />
      </div>
    )
  }

  // ── Mobile layout ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {stickyHeader}
      <div className="px-4 py-4 pb-32 flex flex-col gap-4">
        {filterBar}
        {entryList}
      </div>
    </div>
  )
}
