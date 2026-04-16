'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'

const STEPS = [
  { target: 'create-ad-marker', message: 'Pick an ad, ad set, or AB test to insert' },
  { target: 'marker-row', message: 'Hover a marker to edit or delete it' },
  { target: 'playhead', message: 'Drag the playhead to set where a new ad goes' },
  { target: 'split-handle-v', message: 'Drag any divider to resize panels' },
]

const STEP_DURATION = 2100
const TRANSITION_MS = 300

export function TutorialOverlay() {
  const [playing, setPlaying] = useState(false)
  const [step, setStep] = useState(-1)
  const [bubbleRect, setBubbleRect] = useState<DOMRect | null>(null)
  const [phase, setPhase] = useState<'in' | 'visible' | 'out'>('in')
  const [collapsing, setCollapsing] = useState(false)
  const [buttonRect, setButtonRect] = useState<DOMRect | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const hasAutoPlayed = useRef(false)

  const updateButtonRect = useCallback(() => {
    if (btnRef.current) setButtonRect(btnRef.current.getBoundingClientRect())
  }, [])

  const startTour = useCallback(() => {
    setCollapsing(false)
    setPlaying(true)
    setStep(0)
    setPhase('in')
  }, [])

  // auto-play on mount
  useEffect(() => {
    if (!hasAutoPlayed.current) {
      hasAutoPlayed.current = true
      const t = setTimeout(startTour, 600)
      return () => clearTimeout(t)
    }
  }, [startTour])

  // reposition on step change, skipping any step whose target is missing
  useEffect(() => {
    if (step < 0 || step >= STEPS.length) { setBubbleRect(null); return }
    const el = document.querySelector(`[data-tour="${STEPS[step].target}"]`)
    if (el) { setBubbleRect(el.getBoundingClientRect()); return }
    if (step < STEPS.length - 1) setStep(step + 1)
    else { setPlaying(false); setStep(-1) }
  }, [step])

  // phase state machine
  useEffect(() => {
    if (!playing || step < 0 || step >= STEPS.length) return

    if (phase === 'in') {
      timerRef.current = setTimeout(() => setPhase('visible'), TRANSITION_MS)
    } else if (phase === 'visible') {
      timerRef.current = setTimeout(() => setPhase('out'), STEP_DURATION)
    } else if (phase === 'out') {
      timerRef.current = setTimeout(() => {
        if (step < STEPS.length - 1) {
          setStep(step + 1)
          setPhase('in')
        } else {
          // collapse into button
          updateButtonRect()
          setCollapsing(true)
          setTimeout(() => {
            setPlaying(false)
            setStep(-1)
            setCollapsing(false)
          }, 500)
        }
      }, TRANSITION_MS)
    }

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [playing, step, phase, updateButtonRect])

  const opacity = phase === 'visible' ? 1 : 0
  const translateY = phase === 'in' ? 8 : phase === 'out' ? -8 : 0

  // collapse animation style
  const collapseStyle = collapsing && buttonRect && bubbleRect
    ? {
        transform: `translate(${buttonRect.left - bubbleRect.left}px, ${buttonRect.top - bubbleRect.top}px) scale(0.1)`,
        opacity: 0,
        transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
      }
    : {}

  return (
    <>
      {/* replay button */}
      <button
        ref={btnRef}
        onClick={startTour}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all shadow-sm ${
          playing
            ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-indigo-200'
            : 'bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-600 border border-indigo-200 hover:from-indigo-100 hover:to-violet-100 hover:shadow-md hover:shadow-indigo-100'
        }`}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Show me how
      </button>

      {/* tooltip overlay */}
      {playing && bubbleRect && step >= 0 && step < STEPS.length && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          {/* pulsing ring */}
          <div
            className="absolute rounded-full animate-ping"
            style={{
              left: bubbleRect.left - 6,
              top: bubbleRect.top - 6,
              width: bubbleRect.width + 12,
              height: bubbleRect.height + 12,
              background: 'radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)',
              transition: `all ${TRANSITION_MS}ms ease`,
              opacity: opacity * 0.6,
              animationDuration: '1.5s',
            }}
          />
          {/* highlight ring */}
          <div
            className="absolute rounded-full border-2 border-indigo-400/50"
            style={{
              left: bubbleRect.left - 4,
              top: bubbleRect.top - 4,
              width: bubbleRect.width + 8,
              height: bubbleRect.height + 8,
              transition: `all ${TRANSITION_MS}ms ease`,
              opacity,
            }}
          />

          {/* bubble */}
          <div
            className="absolute flex flex-col items-center"
            style={{
              left: bubbleRect.left + bubbleRect.width / 2,
              top: bubbleRect.bottom + 14,
              transform: `translateX(-50%) translateY(${translateY}px)`,
              opacity,
              transition: `all ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
              filter: 'drop-shadow(0 4px 16px rgba(99,102,241,0.35))',
              ...collapseStyle,
            }}
          >
            {/* arrow */}
            <div className="w-3 h-3 bg-indigo-600 rotate-45 -mb-1.5 rounded-sm" />
            {/* body */}
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl whitespace-nowrap max-w-[280px]">
              {STEPS[step].message}
            </div>
          </div>

          {/* step dots */}
          <div
            className="absolute flex gap-1.5"
            style={{
              left: bubbleRect.left + bubbleRect.width / 2,
              top: bubbleRect.bottom + 68,
              transform: 'translateX(-50%)',
              opacity,
              transition: `opacity ${TRANSITION_MS}ms ease`,
            }}
          >
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? 'bg-indigo-500 scale-125' : i < step ? 'bg-indigo-300' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </>
  )
}
