import { useState, useRef, useEffect } from 'react'
import { COUNTRIES } from '../../data/countries'

interface Props {
  label?: string
  value: string
  onChange: (country: string) => void
  placeholder?: string
  className?: string
}

export function CountryPicker({ label, value, onChange, placeholder = 'Select country…', className = '' }: Props) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Keep query in sync with external value changes
  useEffect(() => { setQuery(value) }, [value])

  // Close on outside click / scroll
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        // If query doesn't match a real country, revert to the last valid value
        if (!COUNTRIES.includes(query)) setQuery(value)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [query, value])

  const filtered = query.length === 0
    ? COUNTRIES
    : COUNTRIES.filter(c => c.toLowerCase().includes(query.toLowerCase()))

  function select(country: string) {
    setQuery(country)
    onChange(country)
    setOpen(false)
  }

  function handleClear() {
    setQuery('')
    onChange('')
    setOpen(false)
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <div className="relative">
        {/* Globe icon */}
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 004 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
        </svg>
        <input
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          placeholder={placeholder}
          className="w-full pl-9 pr-8 py-3 bg-white rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoComplete="off"
        />
        {/* Clear button */}
        {query && (
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); handleClear() }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
          {filtered.map(country => (
            <li
              key={country}
              onMouseDown={e => { e.preventDefault(); select(country) }}
              className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                country === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-800 hover:bg-gray-50'
              }`}
            >
              {country}
            </li>
          ))}
        </ul>
      )}
      {open && filtered.length === 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl px-4 py-3 text-sm text-gray-400">
          No countries match "{query}"
        </div>
      )}
    </div>
  )
}
