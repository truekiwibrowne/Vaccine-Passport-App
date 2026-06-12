/**
 * A two-column split pane with a draggable divider.
 * Used for desktop master-detail layouts throughout the app.
 *
 * Width is persisted to localStorage using `storageKey` so each page
 * remembers the user's preferred panel width independently.
 */
import { useRef, useState, useCallback, useEffect } from 'react'

const DEFAULT_WIDTH = 360
const MIN_WIDTH = 240
const MAX_WIDTH = 600

interface Props {
  /** Left (list) panel content */
  left: React.ReactNode
  /** Right (detail) panel content */
  right: React.ReactNode
  /** localStorage key for persisting width (use a unique key per page) */
  storageKey?: string
  /** Override default starting width (px) */
  defaultWidth?: number
  /** Extra className for the left panel (e.g. bg colour) */
  leftClassName?: string
  /** Extra className for the right panel */
  rightClassName?: string
}

export function ResizableSplitPane({
  left,
  right,
  storageKey,
  defaultWidth = DEFAULT_WIDTH,
  leftClassName = '',
  rightClassName = '',
}: Props) {
  const [width, setWidth] = useState<number>(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey)
      const n = saved ? parseInt(saved, 10) : defaultWidth
      if (!isNaN(n)) return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, n))
    }
    return defaultWidth
  })

  const isResizing = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(width)

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return
    const delta = e.clientX - startX.current
    setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta)))
  }, [])

  const onMouseUp = useCallback(() => {
    if (!isResizing.current) return
    isResizing.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    setWidth(w => {
      if (storageKey) localStorage.setItem(storageKey, String(w))
      return w
    })
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }, [storageKey, onMouseMove])

  const startResize = useCallback((e: React.MouseEvent) => {
    isResizing.current = true
    startX.current = e.clientX
    startWidth.current = width
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [width, onMouseMove, onMouseUp])

  useEffect(() => () => {
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }, [onMouseMove, onMouseUp])

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left panel — caller controls overflow via leftClassName */}
      <div
        style={{ width }}
        className={`flex-shrink-0 border-r border-gray-200 dark:border-gray-700 ${leftClassName}`}
      >
        {left}
      </div>

      {/* Drag handle */}
      <div
        onMouseDown={startResize}
        className="w-1 flex-shrink-0 cursor-col-resize group relative"
      >
        <div className="absolute inset-y-0 -left-0.5 -right-0.5 group-hover:bg-blue-400/40 dark:group-hover:bg-blue-500/30 transition-colors" />
      </div>

      {/* Right panel */}
      <div className={`flex-1 min-w-0 overflow-y-auto ${rightClassName}`}>
        {right}
      </div>
    </div>
  )
}
