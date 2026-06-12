import { useRef, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { VaccineLibraryEntry } from '../../types/vaccineLibrary'
import { VACCINE_CATEGORY_LABELS, VACCINE_CATEGORY_COLOURS } from '../../types/vaccineLibrary'
import { DiseaseRiskMap } from './DiseaseRiskMap'
import { Button } from '../ui/Button'

// ── Destination types ─────────────────────────────────────────────────────────

export interface AddDestination {
  type: 'self' | 'dependent' | 'pet' | 'farm' | 'farm_herd'
  /** Animal ID for 'farm'; undefined for 'self' and 'farm_herd' */
  id?: string
  /** Populated for 'farm_herd' — IDs of every animal in the herd */
  herdAnimalIds?: string[]
  label: string
  /** e.g. species name or "N animals" — shown in smaller text below the label */
  sublabel?: string
  emoji: string
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  entry: VaccineLibraryEntry
  /** If true, renders the add button / dropdown */
  showAddButton?: boolean
  /**
   * Legacy single-target callback. Used only when `destinations` is NOT provided.
   * Defaults to navigating to /vaccines/add.
   */
  onAdd?: () => void
  /** Compact mode — removes sticky header, used when embedded in split pane */
  embedded?: boolean
  /**
   * When provided, the single "Add to My Vaccines" button is replaced by an
   * "Add to…" dropdown listing these destinations.
   * Pass an empty array to show a "no destinations" message.
   */
  destinations?: AddDestination[]
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LibraryDetail({
  entry,
  showAddButton = true,
  onAdd,
  embedded = false,
  destinations,
}: Props) {
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [dropdownOpen])

  const rows = [
    { label: 'Disease Target',       value: entry['Disease Target'] },
    { label: 'Brand Name',           value: entry['Brand Name'] },
    { label: 'Manufacturer',         value: entry.Manufacturer },
    { label: 'Type / Technology',    value: entry['Type/Technology'] },
    { label: 'Administration',       value: entry.Administration },
    { label: 'Dosing Schedule',      value: entry['Dosing Schedule'] },
    { label: 'Storage Requirements', value: entry['Storage Requirements'] },
    { label: 'Efficacy Rate',        value: entry['Efficacy Rate'] },
    { label: 'Age Group',            value: entry['Age Group'] },
    { label: 'Target Population',    value: entry['Target Population'] },
    { label: 'Geographic Priority',  value: entry['Geographic Priority'] },
    { label: 'Disease Prevalence',   value: entry['Disease Prevalence'] },
  ]

  // ── Legacy single-target handler (used when destinations prop is absent) ───
  const handleAdd = onAdd ?? (() => navigate('/vaccines/add', { state: { preselected: entry } }))

  // ── Destination select ────────────────────────────────────────────────────
  function handleDestinationSelect(dest: AddDestination) {
    setDropdownOpen(false)
    switch (dest.type) {
      case 'self':
        navigate('/vaccines/add', { state: { preselected: entry } })
        break
      case 'dependent':
        navigate(`/dependents/${dest.id}/vaccines/add`, { state: { preselected: entry } })
        break
      case 'pet':
        navigate(`/pets/${dest.id}/vaccines/add`, { state: { preselected: entry } })
        break
      case 'farm':
        navigate(`/farm/${dest.id}/vaccines/add`, { state: { preselected: entry } })
        break
      case 'farm_herd':
        navigate('/farm/herd/vaccines/add', {
          state: { herdName: dest.label, animalIds: dest.herdAnimalIds, preselected: entry },
        })
        break
    }
  }

  // ── Group destinations for display ───────────────────────────────────────
  const groups: { heading?: string; items: AddDestination[] }[] = []
  if (destinations) {
    const selfItems = destinations.filter(d => d.type === 'self')
    const depItems  = destinations.filter(d => d.type === 'dependent')
    const petItems  = destinations.filter(d => d.type === 'pet')
    const herdItems = destinations.filter(d => d.type === 'farm_herd')
    const farmItems = destinations.filter(d => d.type === 'farm')

    const sectionCount =
      (selfItems.length > 0 ? 1 : 0) +
      (depItems.length  > 0 ? 1 : 0) +
      (petItems.length  > 0 ? 1 : 0) +
      (herdItems.length > 0 ? 1 : 0) +
      (farmItems.length > 0 ? 1 : 0)
    const needsHeadings = sectionCount > 1

    if (selfItems.length)  groups.push({ heading: needsHeadings ? 'My Records'         : undefined, items: selfItems })
    if (depItems.length)   groups.push({ heading: needsHeadings ? 'Dependants'         : undefined, items: depItems })
    if (petItems.length)   groups.push({ heading: needsHeadings ? 'Pets'               : undefined, items: petItems })
    if (herdItems.length)  groups.push({ heading: needsHeadings ? 'Herds'              : undefined, items: herdItems })
    if (farmItems.length)  groups.push({ heading: needsHeadings ? 'Individual Animals' : undefined, items: farmItems })
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={`space-y-3 ${embedded ? 'pb-6' : 'pb-32'}`}>
      {/* Title card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-snug flex-1">{entry.Vac_Name}</h2>
          {entry.category && (
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0 ${VACCINE_CATEGORY_COLOURS[entry.category]}`}>
              {VACCINE_CATEGORY_LABELS[entry.category]}
            </span>
          )}
        </div>
        {entry['Short Description'] && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">{entry['Short Description']}</p>
        )}
        {entry['Long Description'] && (
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">{entry['Long Description']}</p>
        )}
      </div>

      {/* ── Entry requirement banner — shown prominently when set ── */}
      {entry.entryRequirementCountries?.trim() && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-2xl overflow-hidden shadow-sm">
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 pt-3 pb-2 border-b border-amber-100 dark:border-amber-700/40">
            <span className="text-xl">🛂</span>
            <div>
              <p className="text-sm font-bold text-amber-800 dark:text-amber-300 leading-snug">Required for Entry</p>
              <p className="text-xs text-amber-600 dark:text-amber-400">Proof of vaccination required for entry into these countries</p>
            </div>
          </div>
          {/* Country tags */}
          <div className="px-4 py-3 flex flex-wrap gap-1.5">
            {entry.entryRequirementCountries.split(',').map(c => c.trim()).filter(Boolean).map(country => (
              <span
                key={country}
                className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50"
              >
                {country}
              </span>
            ))}
          </div>
          {/* Optional clarifying note */}
          {entry.entryRequirementNote?.trim() && (
            <p className="px-4 pb-3 text-xs text-amber-700 dark:text-amber-400 leading-relaxed italic">
              {entry.entryRequirementNote}
            </p>
          )}
        </div>
      )}

      {/* Data rows */}
      <div className="grid grid-cols-1 gap-2">
        {rows.filter(r => r.value).map(row => (
          <div key={row.label} className="bg-white dark:bg-gray-800 rounded-2xl px-4 py-3 shadow-sm">
            <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">{row.label}</p>
            <p className="text-sm text-gray-900 dark:text-white mt-0.5">{row.value}</p>
          </div>
        ))}
      </div>

      {/* Geographic risk map — shown for all categories; Firestore data takes precedence over static */}
      <DiseaseRiskMap entry={entry} entryId={entry.id} />

      {/* Special notes */}
      {entry['Special Notes'] && (
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-4 border border-amber-100 dark:border-amber-700">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">Special Notes</p>
          <p className="text-sm text-amber-800 dark:text-amber-200">{entry['Special Notes']}</p>
        </div>
      )}

      {/* Add button / dropdown */}
      {showAddButton && (
        destinations ? (
          /* ── Destination-aware dropdown ── */
          <div ref={dropdownRef} className="relative">
            {destinations.length === 0 ? (
              /* No valid destinations for this category */
              <div className="rounded-2xl bg-gray-100 dark:bg-gray-700 px-4 py-3 text-center">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {entry.category === 'animal'
                    ? 'Add a pet or animal to your farm first to record this vaccine'
                    : entry.category === 'human_child'
                    ? 'Add a dependant first to record this vaccine'
                    : 'No record destinations found'}
                </p>
              </div>
            ) : (
              <>
                {/* Trigger button */}
                <button
                  onClick={() => setDropdownOpen(o => !o)}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-2xl px-4 py-3.5 transition-colors"
                >
                  <span>Add to…</span>
                  <svg
                    className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown panel — opens upward */}
                {dropdownOpen && (
                  <div className="absolute bottom-full mb-2 left-0 right-0 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50">
                    {groups.map((group, gi) => (
                      <div key={gi}>
                        {group.heading && (
                          <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                            {group.heading}
                          </p>
                        )}
                        {group.items.map(dest => (
                          <button
                            key={`${dest.type}-${dest.id ?? 'self'}`}
                            onClick={() => handleDestinationSelect(dest)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 transition-colors text-left"
                          >
                            <span className="text-xl flex-shrink-0 w-7 text-center">{dest.emoji}</span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{dest.label}</p>
                              {dest.sublabel && (
                                <p className="text-xs text-gray-400 dark:text-gray-500">{dest.sublabel}</p>
                              )}
                            </div>
                            <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 ml-auto flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        ))}
                        {gi < groups.length - 1 && (
                          <div className="mx-4 border-t border-gray-100 dark:border-gray-700" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          /* ── Legacy single-target button ── */
          <Button size="lg" fullWidth onClick={handleAdd}>
            Add to My Vaccines
          </Button>
        )
      )}
    </div>
  )
}
