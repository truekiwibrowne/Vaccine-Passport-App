/**
 * GeoTagInput — multi-value geographic selector.
 * Stores comma-separated values like "Kenya, East Africa, Global".
 * Used for vaccine library Geographic Priority and Disease Prevalence fields.
 */
import { useState } from 'react'
import { COUNTRIES, GEO_PRESETS } from '../../data/countries'

interface Props {
  label?: string
  value: string          // comma-separated string, e.g. "Kenya, East Africa"
  onChange: (v: string) => void
  placeholder?: string
}

function parseTags(value: string): string[] {
  return value.split(',').map(t => t.trim()).filter(Boolean)
}

function serializeTags(tags: string[]): string {
  return tags.join(', ')
}

export function GeoTagInput({ label, value, onChange, placeholder = 'Add region or country…' }: Props) {
  const [query, setQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  const tags = parseTags(value)

  function addTag(tag: string) {
    const t = tag.trim()
    if (!t || tags.includes(t)) return
    onChange(serializeTags([...tags, t]))
    setQuery('')
    setShowDropdown(false)
  }

  function removeTag(tag: string) {
    onChange(serializeTags(tags.filter(t => t !== tag)))
  }

  function setGlobal() {
    onChange('Global')
    setQuery('')
    setShowDropdown(false)
  }

  // Filtered suggestions: presets + countries matching the query
  const allOptions = [...GEO_PRESETS, ...COUNTRIES]
  const filtered = query.length > 0
    ? allOptions.filter(o =>
        o.toLowerCase().includes(query.toLowerCase()) && !tags.includes(o)
      ).slice(0, 20)
    : GEO_PRESETS.filter(p => !tags.includes(p))

  const isGlobal = tags.includes('Global')

  return (
    <div>
      {label && <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>}

      {/* Quick preset buttons */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        <button
          type="button"
          onClick={setGlobal}
          className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors border ${
            isGlobal
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'
          }`}
        >
          🌐 Global
        </button>
        {GEO_PRESETS.slice(1, 7).map(p => (
          <button
            key={p}
            type="button"
            onClick={() => addTag(p)}
            disabled={tags.includes(p) || isGlobal}
            className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors border ${
              tags.includes(p)
                ? 'bg-gray-100 text-gray-400 border-gray-100 cursor-default'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Current tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 pl-2.5 pr-1.5 py-1 rounded-full"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="w-3.5 h-3.5 rounded-full bg-blue-200 hover:bg-blue-300 flex items-center justify-center text-blue-700 transition-colors"
              >
                <svg className="w-2 h-2" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
          {!isGlobal && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-xs text-gray-400 hover:text-red-500 px-1"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Search input */}
      {!isGlobal && (
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setShowDropdown(true) }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            onKeyDown={e => {
              if (e.key === 'Enter' && query.trim()) { e.preventDefault(); addTag(query) }
            }}
            placeholder={placeholder}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {showDropdown && filtered.length > 0 && (
            <ul className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
              {filtered.map(opt => (
                <li
                  key={opt}
                  onMouseDown={e => { e.preventDefault(); addTag(opt) }}
                  className="px-4 py-2.5 text-sm text-gray-800 hover:bg-gray-50 cursor-pointer"
                >
                  {opt}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
