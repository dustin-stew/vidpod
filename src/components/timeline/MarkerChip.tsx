'use client'

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { formatTimestamp } from '@/lib/utils'
import type { AdMarker } from '@/types'

interface MarkerChipProps {
  marker: AdMarker
}

const typeStyles: Record<string, { bg: string; border: string; label: string }> = {
  AUTO: { bg: 'bg-emerald-500', border: 'border-emerald-600', label: 'Auto' },
  STATIC: { bg: 'bg-sky-500', border: 'border-sky-600', label: 'Static' },
  AB_TEST: { bg: 'bg-amber-500', border: 'border-amber-600', label: 'A/B' },
}

export function MarkerChip({ marker }: MarkerChipProps) {
  const style = typeStyles[marker.type] ?? typeStyles.AUTO
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: marker.id,
    data: { marker },
  })

  const dragTransform = transform ? CSS.Translate.toString(transform) : undefined

  return (
    <div
      ref={setNodeRef}
      style={{ transform: dragTransform }}
      {...attributes}
      {...listeners}
      className={cn(
        'absolute top-1 z-10 cursor-grab active:cursor-grabbing select-none',
        isDragging && 'z-30 opacity-80'
      )}
      title={`${style.label} — ${formatTimestamp(marker.timestamp)}`}
    >
      <div className={cn('absolute left-1/2 -translate-x-1/2 top-0 w-0.5 h-4', style.bg)} />
      <div
        className={cn(
          'relative mt-4 px-1.5 py-0.5 rounded text-white text-[10px] font-semibold border whitespace-nowrap',
          style.bg,
          style.border
        )}
      >
        {style.label}
      </div>
    </div>
  )
}
