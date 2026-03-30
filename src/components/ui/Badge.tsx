import { cn } from '@/lib/utils'
import type { MarkerType } from '@/types'

type BadgeVariant = 'auto' | 'static' | 'ab' | 'default'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  auto: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  static: 'bg-sky-100 text-sky-700 border border-sky-200',
  ab: 'bg-amber-100 text-amber-700 border border-amber-200',
  default: 'bg-gray-100 text-gray-600 border border-gray-200',
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  )
}

export function markerTypeToBadgeVariant(type: MarkerType): BadgeVariant {
  switch (type) {
    case 'AUTO': return 'auto'
    case 'STATIC': return 'static'
    case 'AB_TEST': return 'ab'
  }
}

export function markerTypeLabel(type: MarkerType): string {
  switch (type) {
    case 'AUTO': return 'Auto'
    case 'STATIC': return 'Static'
    case 'AB_TEST': return 'A/B'
  }
}
