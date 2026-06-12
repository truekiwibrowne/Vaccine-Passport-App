/**
 * DiseaseRiskMap — interactive world map showing endemic / recommended zones
 * for a specific vaccine's disease target.
 *
 * Colours:
 *   Red    (#dc2626) — High risk: endemic / vaccination required or strongly recommended
 *   Amber  (#d97706) — Moderate risk: vaccination recommended for some travellers / areas
 *   Gray              — Low / no known risk for this disease
 */
import { useState, memo, useEffect } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import { getRiskForDisease, getCountryRisk } from '../../utils/diseaseRiskData'
import type { DiseaseRisk } from '../../utils/diseaseRiskData'
import { getDiseaseRisk } from '../../services/diseaseRiskService'
import type { VaccineLibraryEntry } from '../../types/vaccineLibrary'
import { useTheme } from '../../contexts/ThemeContext'

/** One-line summary of the risk-classification methodology shown in the expandable section */
const METHODOLOGY_LINES = [
  {
    colour: 'bg-red-600',
    label: 'High Risk',
    detail: 'Disease is endemic or actively circulating. Vaccination is required or strongly recommended by CDC / WHO for all travellers.',
  },
  {
    colour: 'bg-amber-500',
    label: 'Moderate Risk',
    detail: 'Risk exists in certain regions, seasons, or for specific activities (e.g. rural travel, outdoor workers). Vaccination recommended for some travellers.',
  },
  {
    colour: 'bg-gray-300 dark:bg-gray-600',
    label: 'Low / None',
    detail: 'No significant transmission reported. Routine vaccination may still be advised based on your home country schedule.',
  },
]

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

interface TooltipState {
  country: string
  risk: 'high' | 'medium' | 'none'
  x: number
  y: number
}

interface Props {
  entry: VaccineLibraryEntry
  /** Vaccine library entry ID — used to look up Firestore-managed risk data first */
  entryId?: string
}

export const DiseaseRiskMap = memo(function DiseaseRiskMap({ entry, entryId }: Props) {
  const { isDark } = useTheme()
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [showMethodology, setShowMethodology] = useState(false)

  // Firestore-managed risk data takes precedence over the static fallback.
  // null = not yet loaded; undefined = no Firestore doc found (use static).
  const [firestoreRisk, setFirestoreRisk] = useState<DiseaseRisk | null | undefined>(null)

  const diseaseTarget = entry['Disease Target'] ?? ''

  useEffect(() => {
    if (!entryId) { setFirestoreRisk(undefined); return }
    setFirestoreRisk(null) // reset on entryId change
    getDiseaseRisk(entryId)
      .then(doc => {
        if (!doc) { setFirestoreRisk(undefined); return }
        setFirestoreRisk({ high: doc.high, medium: doc.medium, note: doc.note || undefined })
      })
      .catch(() => setFirestoreRisk(undefined))
  }, [entryId])

  // While Firestore is loading (null) we show a skeleton; once resolved use
  // Firestore data if found, otherwise fall back to the static lookup.
  const isLoading = firestoreRisk === null && !!entryId
  const staticRisk = getRiskForDisease(diseaseTarget)
  const riskData: DiseaseRisk | null = firestoreRisk ?? staticRisk

  // Don't render the map if there's no risk data at all and loading is done
  if (!isLoading && !riskData) return null

  // Loading skeleton while Firestore fetch is in-flight
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm animate-pulse">
        <div className="px-4 pt-3 pb-2 border-b border-gray-50 dark:border-gray-700/60">
          <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
        <div className="h-[240px] bg-gray-100 dark:bg-gray-700/50" />
      </div>
    )
  }

  const geo      = (entry['Geographic Priority'] ?? '').toLowerCase()
  const isGlobal = geo.includes('global') || geo.includes('worldwide')

  const fillNone = isDark ? '#1f2937' : '#e5e7eb'
  const stroke   = isDark ? '#111827' : '#ffffff'

  const highCount = riskData!.high.length
  const medCount  = riskData!.medium.length

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 border-b border-gray-50 dark:border-gray-700/60">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-snug">
              Geographic Risk — {diseaseTarget}
            </p>
            {isGlobal && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                This vaccine has global relevance; risk levels vary by region
              </p>
            )}
          </div>
          {/* Legend */}
          <div className="flex flex-col gap-1 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-red-600 flex-shrink-0" />
              <span className="text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                High Risk ({highCount})
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-amber-500 flex-shrink-0" />
              <span className="text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                Moderate ({medCount})
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: fillNone }} />
              <span className="text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                Low / None
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="relative select-none">
        <ComposableMap
          projectionConfig={{ scale: 140, center: [10, 10] }}
          style={{ width: '100%', height: 'auto' }}
          height={240}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map(geo => {
                const name = geo.properties.name as string
                const risk = getCountryRisk(name, riskData!)
                const fill =
                  risk === 'high'   ? '#dc2626'
                  : risk === 'medium' ? '#d97706'
                  : fillNone

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={0.4}
                    onMouseEnter={e => {
                      const rect = (e.target as SVGElement)
                        .closest('svg')
                        ?.getBoundingClientRect()
                      setTooltip({
                        country: name,
                        risk,
                        x: e.clientX - (rect?.left ?? 0),
                        y: e.clientY - (rect?.top ?? 0),
                      })
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    style={{
                      default: { outline: 'none' },
                      hover:   {
                        outline: 'none',
                        fill:
                          risk === 'high'   ? '#b91c1c'
                          : risk === 'medium' ? '#b45309'
                          : isDark ? '#374151' : '#d1d5db',
                        cursor: 'default',
                      },
                      pressed: { outline: 'none' },
                    }}
                  />
                )
              })
            }
          </Geographies>
        </ComposableMap>

        {/* Hover tooltip */}
        {tooltip && (
          <div
            className="pointer-events-none absolute z-20 px-2.5 py-1.5 rounded-lg text-xs font-medium shadow-lg border whitespace-nowrap"
            style={{
              left:  Math.min(tooltip.x + 10, 260),
              top:   Math.max(tooltip.y - 36, 4),
              background: isDark ? '#1f2937' : '#ffffff',
              borderColor: isDark ? '#374151' : '#e5e7eb',
              color:
                tooltip.risk === 'high'   ? '#dc2626'
                : tooltip.risk === 'medium' ? '#d97706'
                : isDark ? '#9ca3af' : '#6b7280',
            }}
          >
            {tooltip.country}
            {tooltip.risk !== 'none' && (
              <span className="ml-1.5 opacity-70">
                — {tooltip.risk === 'high' ? 'High Risk' : 'Moderate Risk'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Data source */}
      <p className="text-[10px] text-gray-300 dark:text-gray-600 text-right px-3 pb-1 pt-1">
        CDC Travelers' Health · WHO International Travel &amp; Health 2024
      </p>

      {/* Contextual note (e.g. eradicated diseases, no-vaccine diseases, globally endemic) */}
      {riskData!.note && (
        <div className="mx-3 mb-3 flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 rounded-xl px-3 py-2.5">
          <svg className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
          </svg>
          <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">{riskData!.note}</p>
        </div>
      )}

      {/* How risk is classified — expandable methodology */}
      <div className="mx-3 mb-3 border border-gray-100 dark:border-gray-700/60 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowMethodology(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
        >
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            How risk levels are classified
          </span>
          <svg
            className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showMethodology ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showMethodology && (
          <div className="px-3 pb-3 pt-1 flex flex-col gap-2.5 border-t border-gray-100 dark:border-gray-700/60">
            {METHODOLOGY_LINES.map(({ colour, label, detail }) => (
              <div key={label} className="flex items-start gap-2.5">
                <div className={`w-3 h-3 rounded-sm flex-shrink-0 mt-0.5 ${colour}`} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{label}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">{detail}</p>
                </div>
              </div>
            ))}
            <p className="text-[10px] text-gray-400 dark:text-gray-500 pt-1 border-t border-gray-100 dark:border-gray-700/40">
              Risk classifications are based on CDC Travelers' Health recommendations, WHO International Travel &amp; Health (2024), and ECDC surveillance data. Individual risk may vary based on specific itinerary, activities, and underlying health conditions.
            </p>
          </div>
        )}
      </div>
    </div>
  )
})
