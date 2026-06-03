/**
 * Shared clinic combobox used on all Add Vaccine pages.
 * Accepts a pre-filtered list of Clinic records and provides
 * type-ahead search with a free-text fallback.
 */
import { useState, useEffect, useRef } from 'react'
import type { Clinic } from '../../types/admin'

interface Props {
  value:    string
  onChange: (name: string) => void
  clinics:  Clinic[]
  label?:   string
  placeholder?: string
}

export function ClinicCombobox({ value, onChange, clinics, label = 'Clinic / Hospital', placeholder = 'Search registered clinics or type any name…' }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const filtered = clinics
    .filter(c => !value.trim() || c.name.toLowerCase().includes(value.toLowerCase()))
    .slice(0, 10)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

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
          {filtered.map(c => (
            <li
              key={c.id}
              onMouseDown={e => { e.preventDefault(); onChange(c.name); setOpen(false) }}
              className="px-4 py-2.5 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{c.name}</p>
                  {(c.city || c.country) && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{[c.city, c.country].filter(Boolean).join(', ')}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {c.verified && (
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">✓ Verified</span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
