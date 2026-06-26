import { useState, useRef, useEffect } from 'react'
import type { CardData, AiDate, AiStatus } from '../common/types'
import { DATES_ENABLED } from '../common/constants'
import { trackIdOf } from '../common/helpers'
import { getSuggestedYear } from './perplexityDates'

// App-data localStorage key. Deliberately lives OUTSIDE the 'music-cards:' auth
// namespace: clearStoredAuth() (on logout, and on the expired/stale-token paths
// during mount) sweeps every key under that prefix, which would otherwise wipe
// this too.
const TOTAL_COST_KEY = 'music-cards-app:aiDatesTotalCost'

// AI costs come in at 5-decimal (USD) precision. Snap every accumulated value
// back onto that exact 1e-5 grid at each step so floating-point error can never
// build up in the stored per-song or lifetime totals.
function round5(n: number): number {
  return Math.round(n * 1e5) / 1e5
}

// Owns the AI release-year feature: per-song results, the run/pause state
// machine, the per-song web search, the web-search cost gate (+ its confirm
// modal flag), and the persisted lifetime spend total.
export function useAiDates(cards: CardData[], clearError: () => void) {
  // AI release-year results, keyed by Spotify track id. Presence of an entry =
  // "already queried" (so the same song isn't queried twice). Entries persist
  // when songs are removed, so re-adding a song restores its previous result.
  const [aiDates, setAiDates] = useState<Map<string, AiDate>>(new Map())
  // 'running' = a get-dates pass is in flight; 'pausing' = pause requested but the
  // current song's call is still finishing; 'paused' = a pass was interrupted with
  // songs still unqueried; 'idle' = nothing running. The pass loop is sequential,
  // so pausing only stops it between songs (the in-flight call always finishes and
  // is saved). pauseRef is read inside that loop, where React state wouldn't be
  // visible — a ref always reflects the latest value.
  const [aiStatus, setAiStatus] = useState<AiStatus>('idle')
  const pauseRef = useRef(false)
  const [webSearchingId, setWebSearchingId] = useState<string | null>(null)
  // Global gate for the per-song web-search buttons. Starts disabled every load
  // (not persisted) so a paid feature is never silently on. Enabling it requires
  // confirming the cost modal; disabling is immediate.
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)
  const [confirmWebSearch, setConfirmWebSearch] = useState(false)
  // Lifetime running total of AI-query spend (USD), persisted to localStorage so
  // it survives reloads. Editable by hand to sync across ports/machines.
  const [totalCost, setTotalCost] = useState(() => {
    const stored = localStorage.getItem(TOTAL_COST_KEY)
    const parsed = Number(stored)
    return stored && Number.isFinite(parsed) && parsed >= 0 ? round5(parsed) : 0
  })

  useEffect(() => {
    localStorage.setItem(TOTAL_COST_KEY, String(totalCost))
  }, [totalCost])

  // A song is "unqueried" iff it has no aiDates entry yet. The button is enabled
  // exactly when at least one song is unqueried.
  const hasUnqueried = DATES_ENABLED && cards.some(c => !aiDates.has(trackIdOf(c)))

  // Run the AI-dates pass over only the songs that haven't been queried yet.
  // Sequential (no added delay) so rows fill in live and we stay gentle on rate
  // limits. Each call's cost accumulates into the persisted lifetime total.
  //
  // This is both "start" and "resume": pending is recomputed from the current
  // aiDates each time, so songs already done in a prior (paused) pass are skipped
  // and we naturally continue where we stopped.
  const runDates = async () => {
    if (aiStatus === 'running' || aiStatus === 'pausing') return
    const pending = cards.filter(c => !aiDates.has(trackIdOf(c)))
    if (pending.length === 0) return

    pauseRef.current = false
    setAiStatus('running')
    clearError()
    let interrupted = false
    try {
      for (const card of pending) {
        // Pause takes effect between songs: a request already in flight always
        // finishes and is saved; we just stop before starting the next one.
        if (pauseRef.current) {
          interrupted = true
          break
        }
        const id = trackIdOf(card)
        try {
          const { year, cost } = await getSuggestedYear(
            card.trackInfo.name,
            card.trackInfo.artist,
          )
          setAiDates(prev => {
            const next = new Map(prev)
            next.set(id, { year, cost: round5(cost) })
            return next
          })
          if (cost > 0) setTotalCost(prev => round5(prev + cost))
        } catch {
          // Network / HTTP failure: mark the row so it's visibly flagged and
          // won't be retried on the next press (a non-empty entry = queried).
          setAiDates(prev => {
            const next = new Map(prev)
            next.set(id, { year: 'Error', cost: 0 })
            return next
          })
        }
      }
    } finally {
      // 'paused' only if we stopped with work remaining; a fully-completed pass
      // (or a pause requested on the last song) ends as 'idle'.
      setAiStatus(interrupted ? 'paused' : 'idle')
    }
  }

  // Button action: while running, a press requests a pause (the loop stops after
  // the current song). Otherwise it starts or resumes the pass.
  const handleDatesButton = () => {
    if (aiStatus === 'running') {
      // Request a pause; the loop stops after the current song finishes. Show
      // 'pausing' in the meantime so the label reflects the in-progress stop.
      pauseRef.current = true
      setAiStatus('pausing')
    } else if (aiStatus !== 'pausing') {
      runDates()
    }
  }

  // Toggle the web-search gate. Turning it ON asks for confirmation first (the
  // modal flips it on); turning it OFF is immediate.
  const handleToggleWebSearch = () => {
    if (webSearchEnabled) {
      setWebSearchEnabled(false)
    } else {
      setConfirmWebSearch(true)
    }
  }

  // Confirm-modal actions: "Yes" enables the gate and closes; "No"/dismiss just
  // closes.
  const confirmWebSearchYes = () => {
    setWebSearchEnabled(true)
    setConfirmWebSearch(false)
  }
  const closeWebSearchConfirm = () => setConfirmWebSearch(false)

  const handleWebSearch = async (card: CardData) => {
    const id = trackIdOf(card)
    if (webSearchingId === id) return
    setWebSearchingId(id)
    try {
      const { year, cost } = await getSuggestedYear(
        card.trackInfo.name,
        card.trackInfo.artist,
        undefined,
        true,
      )
      // Accumulate this query's cost onto whatever the song already spent, so
      // the row shows the song's lifetime total across all its queries.
      setAiDates(prev => {
        const next = new Map(prev)
        const prevCost = prev.get(id)?.cost ?? 0
        next.set(id, { year, cost: round5(prevCost + cost) })
        return next
      })
      if (cost > 0) setTotalCost(prev => round5(prev + cost))
    } catch {
      // Failed query: keep the accumulated cost, just flag the year.
      setAiDates(prev => {
        const next = new Map(prev)
        const prevCost = prev.get(id)?.cost ?? 0
        next.set(id, { year: 'Error', cost: prevCost })
        return next
      })
    } finally {
      setWebSearchingId(null)
    }
  }

  return {
    // ControlBar wiring
    aiStatus,
    hasUnqueried,
    onDatesButton: handleDatesButton,
    webSearchEnabled,
    onToggleWebSearch: handleToggleWebSearch,
    totalCost,
    onCommitTotalCost: (n: number) => setTotalCost(round5(n)),
    // SongList wiring
    aiDates,
    webSearchingId,
    onWebSearch: handleWebSearch,
    // Confirm modal (rendered in App)
    confirmWebSearch,
    confirmWebSearchYes,
    closeWebSearchConfirm,
  }
}
