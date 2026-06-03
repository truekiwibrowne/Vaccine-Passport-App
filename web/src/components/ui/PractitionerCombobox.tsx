/**
 * Shared practitioner combobox used on all Add Vaccine pages.
 * Accepts a pre-filtered list of Practitioner records and provides
 * type-ahead search with a free-text fallback.
 *
 * When a practitioner is selected, calls onSelect(name, clinicName)
 * so the parent can optionally update the clinic field too.
 */
import { useState, useEffect, useRef } from 'react'
import type { Practitioner } from '../../types/admin'
import { VERIFICATION_LEVEL_COLOURS } from '../../types/admin'

interface Props {
  value:        string
  onChange:     (name: string) => void
  /** Called when user picks a registered practitioner — supplies their clinic name too. */
  onSelect?:    (name: string, clinicName: string) => void
  practitioners: Practitioner[]
  label?:       string
  placeholder?: string
  /** If set, shows practitioners from this clinic first */
  preferClinic?: string
}

export function PractitionerCombobox({
  value,
  onChange,
  onSelect,
  practitioners,
  label = 'Doctor / Practitioner',
  placeholder = 'Search registered practitioners or type a name…',
  preferClinic,
}: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const q = value.toLowerCase().trim()
  let filtered = practitioners.filter(p =>
    !q ||
    p.name.toLowerCase().includes(q) ||
    p.speciality?.toLowerCase().includes(q) ||
    p.clinicName?.toLowerCase().includes(q),
  )

  // Sort so practitioners from the currently-selected clinic appear first
  if (preferClinic) {
    filtered = [
      ...filtered.filter(p => p.clinicName?.toLowerCase().includes(preferClinic.toLowerCase())),
      ...filtered.filter(p => !p.clinicName?.toLowerCase().includes(preferClinic.toLowerCase())),
    ]
  }

  filtered = filtered.slice(0, 10)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function select(p: Practitioner) {
    onChange(p.name)
    onSelect?.(p.name, p.clinicName ?? '')
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full px-3 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500 dark:placeholder-gray-400"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-xl max-h-52 overflow-y-auto">
          {filtered.map(p => (
            <li
              key={p.id}
              onMouseDown={e => { e.preventDefault(); select(p) }}
              className="px-4 py-2.5 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{p.name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                    {[p.speciality, p.clinicName].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <span className={`text-xs px-1.5 py-0.5 rounded font-semibold flex-shrink-0 ${VERIFICATION_LEVEL_COLOURS[p.verificationLevel]}`}>
                  L{p.verificationLevel}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
