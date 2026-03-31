'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [propertyOpen, setPropertyOpen] = useState(false)
  const propertyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (propertyRef.current && !propertyRef.current.contains(e.target as Node)) {
        setPropertyOpen(false)
      }
    }
    if (propertyOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [propertyOpen])

  async function handleNewEpisode() {
    const res = await fetch('/api/episodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Untitled episode', videoPath: '' }),
    })
    if (res.ok) {
      const episode = await res.json()
      router.push(`/episodes/${episode.id}`)
    }
  }

  const primaryNav = [
    { label: 'Episodes', href: '/episodes', icon: EpisodesIcon },
    { label: 'Assets', href: '/assets', icon: AssetsIcon },
    { label: 'Analytics', href: '/analytics', icon: AnalyticsIcon },
  ]

  const secondaryNav = [
    { label: 'Settings', href: '/settings', icon: SettingsIcon },
  ]

  return (
    <aside className="w-[clamp(16rem,14vw,22rem)] shrink-0 flex flex-col bg-white border-r border-gray-100 h-screen sticky top-0">
      {/* logo */}
      <div className="px-5 py-5 flex items-center gap-2.5 border-b border-gray-100">
        <div className="w-7 h-7 bg-indigo-500 rounded-md flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        <span className="font-semibold text-gray-900 text-[clamp(1rem,0.9vw,1.375rem)]">Vidpod</span>
      </div>

      {/* property selector */}
      <div className="px-4 py-3 relative" ref={propertyRef}>
        <button
          onClick={() => setPropertyOpen(!propertyOpen)}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
        >
          <div className="w-7 h-7 bg-red-100 rounded-md flex items-center justify-center shrink-0">
            <span className="text-red-600 text-xs font-bold">R</span>
          </div>
          <span className="text-[clamp(0.8125rem,0.75vw,1.125rem)] font-medium text-gray-800 truncate flex-1">Redmen TV</span>
          <svg className={cn('w-4 h-4 text-gray-400 shrink-0 transition-transform', propertyOpen && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {propertyOpen && (
          <div className="absolute left-3 right-3 top-full mt-1 bg-white rounded-xl border border-gray-200 shadow-lg z-50 py-1 overflow-hidden">
            <div className="flex items-center gap-2.5 px-3 py-2 bg-gray-50">
              <div className="w-6 h-6 bg-red-100 rounded-md flex items-center justify-center shrink-0">
                <span className="text-red-600 text-[10px] font-bold">R</span>
              </div>
              <span className="text-xs font-medium text-gray-900 truncate">Redmen TV</span>
              <svg className="w-3.5 h-3.5 text-gray-400 shrink-0 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="border-t border-gray-100" />
            <button
              onClick={() => { setPropertyOpen(false); router.push('/properties') }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="w-6 h-6 rounded-md border-2 border-dashed border-gray-300 flex items-center justify-center shrink-0">
                <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className="text-xs font-medium text-gray-500">Add a property</span>
            </button>
          </div>
        )}
      </div>

      {/* nav */}
      <nav className="px-3 space-y-0.5">
        {primaryNav.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <div key={href} className="flex items-center gap-1">
              <Link
                href={href}
                className={cn(
                  'flex-1 flex items-center gap-2.5 px-3 py-2 rounded-lg text-[clamp(0.9375rem,0.85vw,1.25rem)] transition-colors',
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                )}
              >
                <Icon className="w-[clamp(1.125rem,1vw,1.5rem)] h-[clamp(1.125rem,1vw,1.5rem)] shrink-0" />
                {label}
              </Link>
              {label === 'Episodes' && (
                <button
                  onClick={handleNewEpisode}
                  title="New episode"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              )}
            </div>
          )
        })}
      </nav>

      <div className="mx-4 my-2 border-t border-gray-100" />

      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {secondaryNav.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[clamp(0.9375rem,0.85vw,1.25rem)] transition-colors',
                isActive
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
              )}
            >
              <Icon className="w-[clamp(1.125rem,1vw,1.5rem)] h-[clamp(1.125rem,1vw,1.5rem)] shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* stats */}
      <div className="mx-4 my-3 p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[clamp(0.8125rem,0.7vw,1.0625rem)] text-gray-500">Weekly plays</span>
          <span className="text-[clamp(0.8125rem,0.7vw,1.0625rem)] font-medium text-emerald-600">+ 17%</span>
        </div>
        <div className="text-xl font-bold text-gray-900">738,849</div>
        <div className="mt-2 h-12">
          <SimpleTrendline />
        </div>
      </div>

      <div className="px-3 pb-4 space-y-0.5 border-t border-gray-100 pt-3">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-[clamp(0.8125rem,0.7vw,1.0625rem)] text-gray-500">Demo mode</span>
          <button className="w-9 h-5 bg-gray-200 rounded-full relative transition-colors hover:bg-gray-300">
            <span className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full shadow-sm" />
          </button>
        </div>
        {[
          { label: 'Invite your team', icon: InviteIcon },
          { label: 'Give feedback', icon: FeedbackIcon },
          { label: 'Help & support', icon: HelpIcon },
        ].map(({ label, icon: Icon }) => (
          <button
            key={label}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[clamp(0.8125rem,0.7vw,1.0625rem)] text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors"
          >
            <Icon className="w-[clamp(1.125rem,1vw,1.5rem)] h-[clamp(1.125rem,1vw,1.5rem)] shrink-0" />
            {label}
          </button>
        ))}
      </div>
    </aside>
  )
}

function EpisodesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="2" y="4" width="20" height="16" rx="2" strokeWidth={1.8} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 9l5 3-5 3V9z" />
    </svg>
  )
}

function AssetsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="3" y="3" width="8" height="8" rx="1.5" strokeWidth={1.8} />
      <rect x="13" y="3" width="8" height="8" rx="1.5" strokeWidth={1.8} />
      <rect x="3" y="13" width="8" height="8" rx="1.5" strokeWidth={1.8} />
      <rect x="13" y="13" width="8" height="8" rx="1.5" strokeWidth={1.8} />
    </svg>
  )
}

function AnalyticsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 13h2l2-5 4 10 3-7 2 2h5" />
    </svg>
  )
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <circle cx="12" cy="12" r="3" strokeWidth={1.8} />
    </svg>
  )
}

function InviteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function FeedbackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  )
}

function HelpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" strokeWidth={1.8} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" />
    </svg>
  )
}

function SimpleTrendline() {
  return (
    <svg viewBox="0 0 100 40" className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0,35 L10,28 L20,30 L30,20 L40,22 L50,15 L60,18 L70,10 L80,12 L90,6 L100,5"
        fill="none"
        stroke="#10b981"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M0,35 L10,28 L20,30 L30,20 L40,22 L50,15 L60,18 L70,10 L80,12 L90,6 L100,5 L100,40 L0,40 Z"
        fill="url(#trendGradient)"
      />
    </svg>
  )
}
