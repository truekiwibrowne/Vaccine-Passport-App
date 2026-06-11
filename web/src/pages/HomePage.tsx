import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useUserVaccines } from '../hooks/useUserVaccines'
import { getDependents } from '../services/dependentsService'
import { getPets } from '../services/petsService'
import { getDependentVaccines } from '../services/dependentsService'
import { getPetVaccines } from '../services/petsService'
import { getFarmAnimals } from '../services/farmService'
import { getActiveNewsPosts, getActiveSponsoredContent, matchesTargets } from '../services/newsFeedService'
import type { Dependent } from '../types/dependent'
import type { Pet } from '../types/pet'
import type { FarmAnimal } from '../types/farm'
import type { NewsFeedPost, SponsoredContent } from '../types/newsFeed'
import { PET_SPECIES_EMOJI, PET_SPECIES_LABELS } from '../types/pet'
import { FARM_SPECIES_EMOJI } from '../types/farm'
import { formatDate } from '../utils/dateUtils'
import { getUpcomingExpiries } from './CalendarPage'
import { getSHQuickAccess } from '../services/sexualHealthService'

import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ── Tile IDs ──────────────────────────────────────────────────────────────────

type TileId = 'vaccines' | 'news' | 'dependents' | 'pets' | 'farm' | 'sponsored' | 'passport' | 'library' | 'validation' | 'calendar' | 'private_health'

const DEFAULT_ORDER: TileId[] = [
  'vaccines', 'news', 'dependents', 'pets', 'farm', 'calendar', 'sponsored', 'passport', 'library', 'validation', 'private_health',
]

// In farm mode only these tiles are shown (unless in edit mode)
const FARM_TILE_WHITELIST = new Set<TileId>(['farm', 'news', 'library', 'calendar', 'validation', 'sponsored'])

const STORAGE_KEY = 'home_tile_order'

function loadOrder(): TileId[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_ORDER
    const saved = JSON.parse(raw) as TileId[]
    const merged = saved.filter(id => DEFAULT_ORDER.includes(id))
    DEFAULT_ORDER.forEach(id => { if (!merged.includes(id)) merged.push(id) })
    return merged
  } catch {
    return DEFAULT_ORDER
  }
}

function saveOrder(order: TileId[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(order))
}

// ── Tile shell ────────────────────────────────────────────────────────────────

interface TileProps {
  icon: React.ReactNode
  label: string
  labelColour: string
  meta?: string
  onClick?: () => void
  editMode?: boolean
  dragHandleProps?: Record<string, unknown>
  children: React.ReactNode
}

function Tile({ icon, label, labelColour, meta, onClick, editMode, dragHandleProps, children }: TileProps) {
  return (
    <div
      onClick={editMode ? undefined : onClick}
      className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden ${!editMode && onClick ? 'cursor-pointer active:opacity-80 transition-opacity' : ''}`}
    >
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5">
        <div className="flex items-center gap-2">
          {editMode && (
            <span
              {...dragHandleProps}
              className="mr-1 text-gray-300 dark:text-gray-600 cursor-grab active:cursor-grabbing touch-none select-none"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 16h16" />
              </svg>
            </span>
          )}
          <span className="text-base leading-none">{icon}</span>
          <span className={`text-xs font-semibold ${labelColour}`}>{label}</span>
        </div>
        {!editMode && (meta || onClick) && (
          <div className="flex items-center gap-0.5 text-gray-400 dark:text-gray-500">
            {meta && <span className="text-xs">{meta}</span>}
            {onClick && (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            )}
          </div>
        )}
      </div>
      <div className="h-px bg-gray-100 dark:bg-gray-700/60 mx-4" />
      <div className="px-4 pb-4 pt-3">
        {children}
      </div>
    </div>
  )
}

// ── Sortable wrapper ───────────────────────────────────────────────────────────

function SortableTile({ id, editMode, colSpan, children }: {
  id: string
  editMode: boolean
  colSpan: string   // '' = one column, 'md:col-span-2' = full row
  children: (handleProps: Record<string, unknown>) => React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} className={colSpan}>
      {children(editMode ? { ...attributes, ...listeners } : {})}
    </div>
  )
}

// ── Stat bubble ───────────────────────────────────────────────────────────────

function Stat({ value, label, colour }: { value: number; label: string; colour: string }) {
  return (
    <div className="flex-1 flex flex-col items-center gap-0.5">
      <span className={`text-2xl font-bold ${colour}`}>{value}</span>
      <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium tracking-wide uppercase">{label}</span>
    </div>
  )
}

// ── Entity row ────────────────────────────────────────────────────────────────

function EntityRow({ icon, name, subtitle, count, onClick }: {
  icon: React.ReactNode; name: string; subtitle?: string; count: number | null; onClick: () => void
}) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick() }}
      className="w-full flex items-center gap-3 py-2.5 -mx-4 px-4 active:bg-gray-50 dark:active:bg-gray-700/50 transition-colors rounded-lg"
    >
      <span className="text-xl leading-none w-7 text-center flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-medium text-gray-900 dark:text-white leading-snug">{name}</p>
        {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {count !== null && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {count} record{count !== 1 ? 's' : ''}
          </span>
        )}
        <svg className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  )
}

// ── FAB menu item ─────────────────────────────────────────────────────────────

function FabItem({ icon, label, colour, onClick, isDark }: {
  icon: React.ReactNode; label: string; colour: string; onClick: () => void; isDark: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 pl-4 pr-5 py-2.5 rounded-full shadow-lg active:opacity-80 transition-opacity"
      style={{
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        background: isDark ? 'rgba(30,30,30,0.55)' : 'rgba(255,255,255,0.55)',
      }}
    >
      <span className={`w-8 h-8 rounded-full ${colour} flex items-center justify-center text-base flex-shrink-0`}>
        {icon}
      </span>
      <span className="text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap">{label}</span>
    </button>
  )
}

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null
  const diff = new Date(iso).getTime() - Date.now()
  return Math.ceil(diff / 86_400_000)
}

// ── Professional SVG icons for farm mode ──────────────────────────────────────

const FarmIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
)
const NewsIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
  </svg>
)
const LibraryIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
)
const ValidationIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
)
const HealthIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>
)
const HerdFolderIcon = () => (
  <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
  </svg>
)

// ── Main page ─────────────────────────────────────────────────────────────────

export function HomePage() {
  const { profile, user } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const { vaccines, loading: vaccinesLoading } = useUserVaccines(user?.uid)

  const isFarmMode = profile?.appMode === 'farm'

  const [dependents, setDependents] = useState<Dependent[]>([])
  const [pets, setPets] = useState<Pet[]>([])
  const [farmAnimals, setFarmAnimals] = useState<FarmAnimal[]>([])
  const [depCounts, setDepCounts] = useState<Record<string, number>>({})
  const [petCounts, setPetCounts] = useState<Record<string, number>>({})
  const [newsPost, setNewsPost] = useState<NewsFeedPost | null>(null)
  const [sponsored, setSponsored] = useState<SponsoredContent | null>(null)

  const [tileOrder, setTileOrder] = useState<TileId[]>(() => loadOrder())
  const [editMode, setEditMode] = useState(false)
  const shQuickAccess = user ? getSHQuickAccess(user.uid) : false
  const [fabOpen, setFabOpen] = useState(false)

  const headerRef = useRef<HTMLDivElement>(null)
  const scanInputRef = useRef<HTMLInputElement>(null)
  const [headerHeight, setHeaderHeight] = useState(100)
  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setHeaderHeight(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  useEffect(() => {
    if (!user) return
    getDependents(user.uid).then(deps => {
      setDependents(deps)
      deps.forEach(dep => {
        getDependentVaccines(user.uid, dep.id).then(vaxes =>
          setDepCounts(c => ({ ...c, [dep.id]: vaxes.length }))
        )
      })
    })
    getPets(user.uid).then(pts => {
      setPets(pts)
      pts.forEach(pet => {
        getPetVaccines(user.uid, pet.id).then(vaxes =>
          setPetCounts(c => ({ ...c, [pet.id]: vaxes.length }))
        )
      })
    })
    getFarmAnimals(user.uid).then(setFarmAnimals)
    getActiveNewsPosts().catch(() => []).then(posts => {
      if (posts.length > 0) setNewsPost(posts[0])
    })
    getActiveSponsoredContent().catch(() => []).then(items => {
      if (items.length > 0) setSponsored(items[0])
    })
  }, [user])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setTileOrder(prev => {
        const oldIndex = prev.indexOf(active.id as TileId)
        const newIndex = prev.indexOf(over.id as TileId)
        const next = arrayMove(prev, oldIndex, newIndex)
        saveOrder(next)
        return next
      })
    }
  }, [])

  function toggleEditMode() { setEditMode(v => !v) }

  // Always show the most recent active news post on the home tile.
  // Targeting (location / age / gender) is advisory — used for push notifications
  // and the library feed — not a gate for the home screen tile.
  const visibleNews = newsPost ?? null
  const visibleSponsored = sponsored && matchesTargets(sponsored.targets, profile ?? {}, vaccines) ? sponsored : null

  const totalCount    = vaccines.length
  const verifiedCount = vaccines.filter(v => v.Authenticated === true).length
  const pendingCount  = vaccines.filter(v => v.pending_validation === true).length
  const expiringSoon  = vaccines.filter(v => {
    const d = daysUntil(v.Expiration_date)
    return d !== null && d >= 0 && d <= 30
  })
  const lastAdded = vaccines[0]?.date_administration
  const lastLabel = lastAdded ? formatDate(lastAdded) : undefined
  const avatarSrc = profile?.Profile_Image ?? null

  // ── Tile render map ──────────────────────────────────────────────────────────

  function renderTile(id: TileId, handleProps: Record<string, unknown>) {
    switch (id) {

      case 'vaccines':
        // Always hidden in farm mode
        if (isFarmMode && !editMode) return null
        return (
          <Tile icon="💉" label="My Vaccines" labelColour="text-blue-500"
            meta={lastLabel} onClick={() => navigate('/vaccines')}
            editMode={editMode} dragHandleProps={handleProps}
          >
            {vaccinesLoading ? (
              <div className="h-14 flex items-center justify-center">
                <svg className="animate-spin w-5 h-5 text-gray-300 dark:text-gray-600" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : totalCount === 0 ? (
              <div className="py-2 text-center">
                <p className="text-sm text-gray-400 dark:text-gray-500">No records yet</p>
                <button onClick={e => { e.stopPropagation(); navigate('/vaccines/add') }} className="mt-2 text-sm font-medium text-blue-500">
                  + Add your first vaccine
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <Stat value={totalCount}    label="Total"    colour="text-gray-900 dark:text-white" />
                <div className="w-px h-8 bg-gray-100 dark:bg-gray-700" />
                <Stat value={verifiedCount} label="Verified" colour="text-green-500" />
                <div className="w-px h-8 bg-gray-100 dark:bg-gray-700" />
                <Stat value={pendingCount}  label="Pending"  colour="text-yellow-500" />
                <div className="w-px h-8 bg-gray-100 dark:bg-gray-700" />
                <Stat value={vaccines.filter(v => v.Favourited).length} label="Starred" colour="text-blue-400" />
              </div>
            )}
            {expiringSoon.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                <p className="text-xs text-orange-500 font-medium">
                  ⚠️ {expiringSoon.length} vaccine{expiringSoon.length !== 1 ? 's' : ''} expiring within 30 days
                </p>
              </div>
            )}
          </Tile>
        )

      case 'news':
        if (!visibleNews && !editMode) return null
        return (
          <Tile
            icon={isFarmMode ? <NewsIcon /> : '📰'}
            label="News"
            labelColour={isFarmMode ? 'text-gray-700 dark:text-gray-300' : 'text-rose-500'}
            meta={visibleNews ? formatDate(visibleNews.publishedAt) : undefined}
            onClick={!editMode && visibleNews?.actionUrl ? () => window.open(visibleNews!.actionUrl, '_blank') : undefined}
            editMode={editMode} dragHandleProps={handleProps}
          >
            {visibleNews ? (
              <>
                {/* Hero image — bleeds to tile edges */}
                {visibleNews.imageUrl && (
                  <div className="-mx-4 -mt-3 mb-3">
                    <img
                      src={visibleNews.imageUrl}
                      alt={visibleNews.title}
                      className="w-full h-44 object-cover"
                      referrerPolicy="no-referrer"
                      onError={e => { (e.currentTarget as HTMLImageElement).parentElement!.style.display = 'none' }}
                    />
                  </div>
                )}
                {/* Badge pill */}
                {visibleNews.badge && (
                  <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full mb-2 ${
                    isFarmMode
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                      : 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'
                  }`}>{visibleNews.badge}</span>
                )}
                {/* Title */}
                <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug line-clamp-2">{visibleNews.title}</p>
                {/* Snippet */}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed line-clamp-2">{visibleNews.body}</p>
                {/* Read more link */}
                {visibleNews.actionUrl && (
                  <p className={`text-xs font-semibold mt-3 flex items-center gap-0.5 ${
                    isFarmMode ? 'text-green-700 dark:text-green-400' : 'text-rose-500'
                  }`}>
                    {visibleNews.actionLabel ?? 'Read more'}
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-gray-400 dark:text-gray-500 py-1">No active news posts.</p>
            )}
          </Tile>
        )

      case 'dependents':
        // Always hidden in farm mode
        if (isFarmMode && !editMode) return null
        return (
          <Tile icon="👶" label="Dependents" labelColour="text-indigo-500"
            onClick={() => navigate('/dependents')}
            editMode={editMode} dragHandleProps={handleProps}
          >
            {dependents.length === 0 ? (
              <div className="py-1 flex items-center justify-between">
                <p className="text-sm text-gray-400 dark:text-gray-500">No dependents added</p>
                <button onClick={e => { e.stopPropagation(); navigate('/dependents') }} className="text-xs font-medium text-indigo-500">+ Add</button>
              </div>
            ) : (
              <div className="-my-1">
                {dependents.map((dep, i) => (
                  <div key={dep.id}>
                    {i > 0 && <div className="h-px bg-gray-100 dark:bg-gray-700/60 -mx-4" />}
                    <EntityRow
                      icon="👶" name={dep.name}
                      subtitle={dep.dateOfBirth ? `b. ${dep.dateOfBirth}` : undefined}
                      count={depCounts[dep.id] ?? null}
                      onClick={() => navigate(`/dependents/${dep.id}`)}
                    />
                  </div>
                ))}
              </div>
            )}
          </Tile>
        )

      case 'pets':
        // Always hidden in farm mode
        if (isFarmMode && !editMode) return null
        // In personal mode, hide if no pets
        if (!isFarmMode && pets.length === 0 && !editMode) return null
        return (
          <Tile icon="🐾" label="Pets" labelColour="text-green-500"
            onClick={() => navigate('/pets')}
            editMode={editMode} dragHandleProps={handleProps}
          >
            {pets.length === 0 ? (
              <div className="py-1 flex items-center justify-between">
                <p className="text-sm text-gray-400 dark:text-gray-500">No pets added</p>
                <button onClick={e => { e.stopPropagation(); navigate('/pets') }} className="text-xs font-medium text-green-500">+ Add</button>
              </div>
            ) : (
              <div className="-my-1">
                {pets.map((pet, i) => (
                  <div key={pet.id}>
                    {i > 0 && <div className="h-px bg-gray-100 dark:bg-gray-700/60 -mx-4" />}
                    <EntityRow
                      icon={PET_SPECIES_EMOJI[pet.species]}
                      name={pet.name}
                      subtitle={PET_SPECIES_LABELS[pet.species] + (pet.breed ? ` · ${pet.breed}` : '')}
                      count={petCounts[pet.id] ?? null}
                      onClick={() => navigate(`/pets/${pet.id}`)}
                    />
                  </div>
                ))}
              </div>
            )}
          </Tile>
        )

      case 'farm':
        // Hidden entirely in Personal & Pets mode
        if (!isFarmMode && !editMode) return null
        return (
          <Tile
            icon={isFarmMode ? <FarmIcon /> : '🌾'}
            label="My Farm"
            labelColour={isFarmMode ? 'text-green-700 dark:text-green-400' : 'text-lime-600'}
            onClick={() => navigate('/farm')}
            editMode={editMode} dragHandleProps={handleProps}
          >
            {farmAnimals.length === 0 ? (
              <div className="py-1 flex items-center justify-between">
                <p className="text-sm text-gray-400 dark:text-gray-500">No animals registered</p>
                <button onClick={e => { e.stopPropagation(); navigate('/farm/add') }} className="text-xs font-medium text-green-700 dark:text-green-400">+ Add Animal</button>
              </div>
            ) : (
              <>
                {/* Herd summary stats */}
                <div className="flex items-center gap-4 py-1">
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{farmAnimals.filter(a => (a.status ?? 'active') === 'active').length}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide font-medium">Active</p>
                  </div>
                  <div className="w-px h-8 bg-gray-100 dark:bg-gray-700" />
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {new Set(farmAnimals.map(a => a.herd).filter(Boolean)).size || '—'}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide font-medium">Herds</p>
                  </div>
                  <div className="w-px h-8 bg-gray-100 dark:bg-gray-700" />
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {new Set(farmAnimals.map(a => a.species)).size}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide font-medium">Species</p>
                  </div>
                  {!isFarmMode && (
                    <div className="flex gap-2 flex-wrap justify-end flex-1">
                      {Array.from(new Set(farmAnimals.map(a => a.species))).slice(0, 3).map(sp => (
                        <span key={sp} className="text-xl">{FARM_SPECIES_EMOJI[sp]}</span>
                      ))}
                    </div>
                  )}
                </div>
                {/* Herd rows */}
                <div className="-mb-3 mt-1">
                  {Array.from(
                    farmAnimals.reduce((acc, a) => {
                      const k = a.herd || 'Ungrouped'
                      acc.set(k, (acc.get(k) ?? 0) + 1)
                      return acc
                    }, new Map<string, number>())
                  ).slice(0, 3).map(([herd, count], i) => (
                    <div key={herd}>
                      {i > 0 && <div className="h-px bg-gray-100 dark:bg-gray-700/60 mx-4" />}
                      <EntityRow
                        icon={<HerdFolderIcon />}
                        name={herd}
                        subtitle={`${count} animal${count !== 1 ? 's' : ''}`}
                        count={null}
                        onClick={() => navigate('/farm')}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </Tile>
        )

      case 'sponsored':
        if (!visibleSponsored && !editMode) return null
        return (
          <div
            onClick={!editMode && visibleSponsored?.actionUrl ? () => window.open(visibleSponsored!.actionUrl, '_blank') : undefined}
            className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden ${!editMode && visibleSponsored?.actionUrl ? 'cursor-pointer active:opacity-80 transition-opacity' : ''}`}
          >
            <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5">
              <div className="flex items-center gap-2">
                {editMode && (
                  <span
                    {...handleProps}
                    className="mr-1 text-gray-300 dark:text-gray-600 cursor-grab active:cursor-grabbing touch-none select-none"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 16h16" />
                    </svg>
                  </span>
                )}
                <span className="text-base leading-none">
                  {isFarmMode ? <HealthIcon /> : undefined}
                </span>
                <span className={`text-xs font-semibold ${isFarmMode ? 'text-gray-700 dark:text-gray-300' : 'text-purple-500'}`}>
                  {visibleSponsored ? visibleSponsored.badge : 'Health Tip'}
                </span>
              </div>
              {!editMode && visibleSponsored?.actionUrl && (
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )}
            </div>
            <div className="h-px bg-gray-100 dark:bg-gray-700/60 mx-4" />
            <div className="px-4 pb-4 pt-3">
              {visibleSponsored ? (
                <>
                  {visibleSponsored.imageUrl && (
                    <img src={visibleSponsored.imageUrl} alt="" className="w-full h-32 object-cover rounded-xl mb-3" />
                  )}
                  <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">{visibleSponsored.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{visibleSponsored.body}</p>
                  {visibleSponsored.actionLabel && visibleSponsored.actionUrl && (
                    <p className={`text-xs font-semibold mt-2 ${isFarmMode ? 'text-green-700 dark:text-green-400' : 'text-blue-500'}`}>{visibleSponsored.actionLabel} →</p>
                  )}
                  {visibleSponsored.sponsorTag && (
                    <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-2 text-right">{visibleSponsored.sponsorTag}</p>
                  )}
                </>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500 py-1">No active health tips.</p>
              )}
            </div>
          </div>
        )

      case 'passport':
        // Hidden in farm mode
        if (isFarmMode && !editMode) return null
        return (
          <Tile icon="🛂" label="Passport" labelColour="text-teal-500"
            onClick={() => navigate('/passport')}
            editMode={editMode} dragHandleProps={handleProps}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">QR ready</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Share your vaccination status</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>
            </div>
          </Tile>
        )

      case 'library':
        return (
          <Tile
            icon={isFarmMode ? <LibraryIcon /> : '📚'}
            label={isFarmMode ? 'Vaccine Library' : 'Vaccine Library'}
            labelColour={isFarmMode ? 'text-gray-700 dark:text-gray-300' : 'text-orange-500'}
            // Farm mode navigates directly to the animal-filtered library
            onClick={() => navigate(isFarmMode ? '/library?category=animal' : '/library')}
            editMode={editMode} dragHandleProps={handleProps}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {isFarmMode ? 'Veterinary reference' : 'Browse & learn'}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {isFarmMode ? 'Animal vaccines & disease information' : 'Search by disease, brand or name'}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </Tile>
        )

      case 'validation':
        // In farm mode always show; in personal mode only when there are pending items
        if (!isFarmMode && pendingCount === 0 && !editMode) return null
        return (
          <Tile
            icon={isFarmMode ? <ValidationIcon /> : '✅'}
            label="Validation"
            labelColour={isFarmMode ? 'text-gray-700 dark:text-gray-300' : 'text-yellow-500'}
            onClick={() => navigate('/validate')}
            editMode={editMode} dragHandleProps={handleProps}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {pendingCount > 0
                  ? `${pendingCount} request${pendingCount !== 1 ? 's' : ''} awaiting review`
                  : 'Vaccine validation inbox'}
              </p>
              {pendingCount > 0 && (
                <span className="w-6 h-6 bg-yellow-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </div>
          </Tile>
        )

      case 'calendar': {
        const upcoming = getUpcomingExpiries(vaccines, 60)
        return (
          <Tile
            icon="📅"
            label="Calendar"
            labelColour={isFarmMode ? 'text-gray-700 dark:text-gray-300' : 'text-blue-500'}
            onClick={() => navigate('/calendar')}
            editMode={editMode} dragHandleProps={handleProps}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {upcoming.length > 0
                    ? `${upcoming.length} expir${upcoming.length === 1 ? 'y' : 'ies'} in next 60 days`
                    : 'No upcoming expiries'}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  View admin dates &amp; expiries
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            {upcoming.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 space-y-1">
                {upcoming.slice(0, 3).map((ex, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <p className="text-xs text-gray-600 dark:text-gray-300 truncate flex-1 mr-2">{ex.name}</p>
                    <span className={`text-xs font-semibold flex-shrink-0 ${ex.daysLeft <= 14 ? 'text-red-500' : 'text-orange-500'}`}>
                      {ex.daysLeft === 0 ? 'today' : `${ex.daysLeft}d`}
                    </span>
                  </div>
                ))}
                {upcoming.length > 3 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500">+{upcoming.length - 3} more</p>
                )}
              </div>
            )}
          </Tile>
        )
      }

      case 'private_health': {
        return (
          <Tile
            icon="🔒"
            label="Private Health"
            labelColour="text-violet-600 dark:text-violet-400"
            onClick={() => navigate('/health/sexual')}
            editMode={editMode}
            dragHandleProps={handleProps}
          >
            <div className="flex items-center gap-3 py-1">
              <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Sexual Health Records</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">PIN protected · Tap to unlock</p>
              </div>
            </div>
          </Tile>
        )
      }

      default:
        return null
    }
  }

  // Tiles visible in current mode (by mode/permission filter)
  const visibleTiles = tileOrder.filter(id => {
    if (id === 'private_health' && !shQuickAccess && !editMode) return false
    return editMode || !isFarmMode || FARM_TILE_WHITELIST.has(id)
  })

  // Tiles that always occupy the full row width
  const WIDE_TILES = new Set<TileId>(['news', 'sponsored'])

  // Pre-determine which of the visible tiles will actually render non-null content.
  // Some tiles (e.g. 'farm' in personal mode) pass the mode filter above but return
  // null from renderTile — if we let them into the grid they create invisible empty
  // cells that push their neighbours into the wrong column.
  function willRender(id: TileId): boolean {
    if (editMode) return true   // edit mode always shows all tiles
    switch (id) {
      case 'vaccines':   return !isFarmMode
      case 'news':       return !!visibleNews
      case 'dependents': return !isFarmMode
      case 'pets':       return !isFarmMode && pets.length > 0
      case 'farm':       return isFarmMode
      case 'sponsored':  return !!visibleSponsored
      case 'passport':   return !isFarmMode
      case 'validation': return isFarmMode || pendingCount > 0
      default:           return true
    }
  }

  // Only include tiles that will actually render content
  const renderableTiles = visibleTiles.filter(willRender)

  // Compute the CSS col-span class for each tile:
  //   • Wide tiles → always 'md:col-span-2'
  //   • Two adjacent narrow tiles → each gets '' (one column each)
  //   • A lone narrow tile (last in list, or next tile is wide) → 'md:col-span-2'
  //     so it expands to fill the row instead of leaving a gap
  const tileColSpans = new Map<TileId, string>()
  {
    let i = 0
    while (i < renderableTiles.length) {
      const id = renderableTiles[i]
      if (WIDE_TILES.has(id)) {
        tileColSpans.set(id, 'md:col-span-2')
        i++
      } else {
        const nextId = renderableTiles[i + 1]
        if (nextId && !WIDE_TILES.has(nextId)) {
          // Two narrow tiles pair up — each takes one column
          tileColSpans.set(id, '')
          tileColSpans.set(nextId, '')
          i += 2
        } else {
          // Lone narrow tile — expand to fill the row
          tileColSpans.set(id, 'md:col-span-2')
          i++
        }
      }
    }
  }

  return (
    <div className="relative h-screen lg:h-full bg-[#F2F2F7] dark:bg-black overflow-hidden">

      {/* ── Scroll area ──────────────────────────────────────────────────────── */}
      <div className="absolute inset-0 overflow-y-auto">
        <div style={{ height: headerHeight }} aria-hidden="true" />

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={tileOrder} strategy={verticalListSortingStrategy}>
            {/* Responsive grid: 1 col mobile → 2 col md+ → constrained max-width */}
            <div className="px-4 pt-3 pb-40 max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-3 auto-rows-min">
              {renderableTiles.map(id => (
                <SortableTile
                  key={id}
                  id={id}
                  editMode={editMode}
                  colSpan={tileColSpans.get(id) ?? ''}
                >
                  {(handleProps) => renderTile(id, handleProps) ?? <></>}
                </SortableTile>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* ── Frosted glass header ──────────────────────────────────────────────── */}
      <div ref={headerRef} className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
        <div
          className="pointer-events-auto backdrop-blur-xl shadow-lg pt-safe pb-10"
          style={{
            WebkitBackdropFilter: 'blur(20px)',
            backdropFilter: 'blur(20px)',
            background: isDark
              ? 'linear-gradient(to bottom, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.42) 62%, rgba(0,0,0,0) 100%)'
              : 'linear-gradient(to bottom, rgba(242,242,247,0.42) 0%, rgba(242,242,247,0.42) 62%, rgba(242,242,247,0) 100%)',
          }}
        >
          <div className="max-w-5xl mx-auto px-5">
          <div className="flex items-end justify-between pt-6 pb-1">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                {isFarmMode ? 'Farm Dashboard' : 'Summary'}
              </h1>
              {isFarmMode && farmAnimals.length > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium uppercase tracking-wide">
                  {farmAnimals.filter(a => (a.status ?? 'active') === 'active').length} active animals
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 mb-1">
              <button
                onClick={toggleEditMode}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  editMode
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/60 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300'
                }`}
              >
                {editMode ? 'Done' : 'Edit'}
              </button>
              <button
                onClick={() => navigate('/profile')}
                className="w-9 h-9 rounded-full overflow-hidden bg-gray-200/70 dark:bg-gray-700/70 flex items-center justify-center active:opacity-70 transition-opacity"
              >
                {avatarSrc
                  ? <img src={avatarSrc} alt="Profile" className="w-full h-full object-cover" />
                  : <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 12a5 5 0 110-10 5 5 0 010 10zm0 2c-5.33 0-8 2.67-8 4v1h16v-1c0-1.33-2.67-4-8-4z" />
                    </svg>
                }
              </button>
            </div>
          </div>

          {editMode ? (
            <p className="text-xs text-blue-500 font-medium mt-2">Drag tiles to rearrange</p>
          ) : (
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mt-3">
              {isFarmMode ? 'Livestock Management' : 'Pinned'}
            </p>
          )}
          </div>{/* end max-w-5xl */}
        </div>
      </div>

      {/* Hidden camera input for scanning animal tags */}
      <input
        ref={scanInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) navigate('/farm', { state: { scannedImage: URL.createObjectURL(file) } })
          // Reset so same file can be selected again
          e.target.value = ''
        }}
      />

      {/* ── FAB ──────────────────────────────────────────────────────────────── */}
      {!editMode && (
        <>
          {fabOpen && (
            <div className="fixed inset-0 z-30" onClick={() => setFabOpen(false)} />
          )}

          <div className="fixed bottom-8 right-5 flex flex-col items-end gap-2.5 z-40 pb-safe">
            {fabOpen && (
              <div className="flex flex-col items-end gap-2 mb-1">

                {isFarmMode ? (
                  /* ── Farm mode: 3 fixed actions, no emoji ── */
                  <>
                    <FabItem
                      icon={
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                      }
                      label="Add Vaccine Record"
                      colour="bg-blue-600"
                      onClick={() => { navigate('/farm'); setFabOpen(false) }}
                      isDark={isDark}
                    />
                    <FabItem
                      icon={
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                      }
                      label="Scan Animal Tag"
                      colour="bg-gray-700"
                      onClick={() => { setFabOpen(false); scanInputRef.current?.click() }}
                      isDark={isDark}
                    />
                    <FabItem
                      icon={
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                      }
                      label="Register Animal"
                      colour="bg-green-700"
                      onClick={() => { navigate('/farm/add'); setFabOpen(false) }}
                      isDark={isDark}
                    />
                  </>
                ) : (
                  /* ── Personal mode: per-entity vaccine add ── */
                  <>
                    <FabItem
                      icon="💉"
                      label="My Vaccine"
                      colour="bg-blue-600"
                      onClick={() => { navigate('/vaccines/add'); setFabOpen(false) }}
                      isDark={isDark}
                    />
                    {dependents.length > 0
                      ? dependents.map(dep => (
                        <FabItem
                          key={dep.id}
                          icon="👶"
                          label={dep.name}
                          colour="bg-indigo-500"
                          onClick={() => { navigate(`/dependents/${dep.id}/vaccines/add`); setFabOpen(false) }}
                          isDark={isDark}
                        />
                      ))
                      : (
                        <FabItem
                          icon="👶"
                          label="Add a Dependent"
                          colour="bg-indigo-400"
                          onClick={() => { navigate('/dependents'); setFabOpen(false) }}
                          isDark={isDark}
                        />
                      )
                    }
                    {pets.length > 0
                      ? pets.map(pet => (
                        <FabItem
                          key={pet.id}
                          icon={PET_SPECIES_EMOJI[pet.species]}
                          label={pet.name}
                          colour="bg-green-500"
                          onClick={() => { navigate(`/pets/${pet.id}/vaccines/add`); setFabOpen(false) }}
                          isDark={isDark}
                        />
                      ))
                      : (
                        <FabItem
                          icon="🐾"
                          label="Add a Pet"
                          colour="bg-green-400"
                          onClick={() => { navigate('/pets'); setFabOpen(false) }}
                          isDark={isDark}
                        />
                      )
                    }
                  </>
                )}
              </div>
            )}

            {/* Main + button */}
            <button
              onClick={() => setFabOpen(v => !v)}
              className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-200 active:scale-95 ${fabOpen ? 'rotate-45' : ''}`}
              style={{
                WebkitBackdropFilter: 'blur(16px)',
                backdropFilter: 'blur(16px)',
                background: isDark ? 'rgba(30,30,30,0.45)' : 'rgba(255,255,255,0.45)',
              }}
            >
              <svg className="w-7 h-7 text-gray-900 dark:text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
