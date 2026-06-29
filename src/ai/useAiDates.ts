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

// The full return value of useAiDates. One shared interface for all consumers
// (ControlBar, SongList, WebSearchConfirmModal); each picks the fields it needs.
export interface AiState {
  // ControlBar wiring
  aiStatus: AiStatus
  // Glass button: (re-)query the given songs (the current selection). Re-queries
  // even already-dated songs and accumulates their cost. Web-search-aware.
  onRunSelected: (cards: CardData[]) => void
  // Pause/Resume button: pause an in-flight run, or resume a paused one.
  onPauseResume: () => void
  webSearchEnabled: boolean
  onToggleWebSearch: () => void
  totalCost: number
  onCommitTotalCost: (value: number) => void
  // SongList wiring
  aiDates: Map<string, AiDate>
  // Track id of the song being queried right now (for the row's progress dots).
  webSearchingId: string | null
  // Confirm modal
  confirmWebSearch: boolean
  confirmWebSearchYes: () => void
  closeWebSearchConfirm: () => void
}

// Owns the AI release-year feature: per-song results, the run/pause state
// machine over a caller-supplied set of songs (the current selection), the
// web-search cost gate (+ its confirm modal flag), and the persisted lifetime
// spend total. Returns `undefined` when the feature is disabled (DATES_ENABLED is
// false), so consumers can treat the presence of the returned state as "feature
// active" — no separate flag needed.
export function useAiDates(clearError: () => void, selectedIds: Set<number>): AiState | undefined {
  // AI release-year results, keyed by Spotify track id. Presence of an entry =
  // "already queried" (so the same song isn't queried twice). The entry lifecycle
  // (kept on song removal, reset on reload) is documented on the AiDate type.
  const [aiDates, setAiDates] = useState<Map<string, AiDate>>(new Map())
  // The run/pause phase (the four values are defined on the AiStatus type). The
  // pass loop is sequential, so pausing only stops it between songs (the in-flight
  // call always finishes and is saved). pauseRef is read inside that loop, where
  // React state wouldn't be visible — a ref always reflects the latest value.
  const [aiStatus, setAiStatus] = useState<AiStatus>('idle')
  const pauseRef = useRef(false)
  // "Stop and forget" — set when the selection changes mid-run, vs pauseRef's
  // "stop and keep". Both stop the loop between songs (abort also sets pauseRef),
  // but abort drains the queue and lands on 'idle' instead of 'paused'.
  const abortRef = useRef(false)
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

  // The queue of songs still to process in the current run, and whether that run
  // uses web search. Refs (not state): the loop reads them synchronously, and on
  // resume we continue from whatever's left here. Songs are re-queried even if
  // already dated, so we can't recover the remainder from aiDates — we track it.
  const runQueueRef = useRef<CardData[]>([])
  const webSearchForRunRef = useRef(false)

  // A selection change cancels any active search and returns to 🔍 idle. We don't
  // diff or re-queue (deliberately simple): the next 🔍 press re-runs over the new
  // selection. Skip the very first render so mounting an existing selection isn't
  // treated as a "change". Only acts when there's actually a run to cancel.
  const firstSelectionRender = useRef(true)
  useEffect(() => {
    if (firstSelectionRender.current) { firstSelectionRender.current = false; return }
    if (aiStatus === 'running' || aiStatus === 'pausing') {
      // A loop is live: tell it to stop between songs AND to forget the queue.
      abortRef.current = true
      pauseRef.current = true
    } else if (aiStatus === 'paused') {
      // No loop running: clear the leftover queue ourselves. This setState is a
      // direct response to a user selection change (not derived render state), so
      // the cascading-render concern the rule guards against doesn't apply.
      runQueueRef.current = []
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAiStatus('idle')
    }
    // 'idle' → nothing to cancel.
    // aiStatus is read but intentionally NOT a dep — we react only to selection
    // changes, reading the latest status at fire time (same read-latest intent as
    // the refs above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds])

  // The sequential run loop. Pulls songs off runQueueRef one at a time, querying
  // each (web search per webSearchForRunRef) and accumulating its cost onto the
  // song's running total and the lifetime total. Sequential so rows fill in live
  // and we stay gentle on rate limits. Pause stops it between songs (the in-flight
  // call always finishes and is saved). Shared by both start (onRunSelected) and
  // resume (onPauseResume).
  const runLoop = async () => {
    setAiStatus('running')
    clearError()
    abortRef.current = false
    let interrupted = false
    try {
      while (runQueueRef.current.length > 0) {
        if (pauseRef.current) {
          interrupted = true
          break
        }
        const card = runQueueRef.current[0]
        const id = trackIdOf(card)
        setWebSearchingId(id)
        try {
          const { year, cost } = await getSuggestedYear(
            card.trackInfo.name,
            card.trackInfo.artist,
            undefined,
            webSearchForRunRef.current,
          )
          // Accumulate onto whatever this song already spent, so the row shows
          // its lifetime total across every query run on it.
          setAiDates(prev => {
            const next = new Map(prev)
            const prevCost = prev.get(id)?.cost ?? 0
            next.set(id, { year, cost: round5(prevCost + cost) })
            return next
          })
          if (cost > 0) setTotalCost(prev => round5(prev + cost))
        } catch {
          // Network / HTTP failure: flag the year but keep the accumulated cost.
          setAiDates(prev => {
            const next = new Map(prev)
            const prevCost = prev.get(id)?.cost ?? 0
            next.set(id, { year: 'Error', cost: prevCost })
            return next
          })
        }
        runQueueRef.current = runQueueRef.current.slice(1)
      }
    } finally {
      setWebSearchingId(null)
      if (abortRef.current) {
        // Selection changed mid-run: drop whatever's left and go back to 🔍 idle.
        runQueueRef.current = []
        setAiStatus('idle')
      } else {
        // 'paused' only if we stopped with work remaining; a fully-drained queue
        // (or a pause requested on the last song) ends as 'idle'.
        setAiStatus(interrupted ? 'paused' : 'idle')
      }
    }
  }

  // Glass button: start a fresh run over the selected songs. Ignored when a run
  // is already in flight or the selection is empty.
  const handleRunSelected = (selectedCards: CardData[]) => {
    if (aiStatus === 'running' || aiStatus === 'pausing') return
    if (selectedCards.length === 0) return
    pauseRef.current = false
    runQueueRef.current = [...selectedCards]
    webSearchForRunRef.current = webSearchEnabled
    runLoop()
  }

  // Pause/Resume button: a press while running requests a pause (the loop stops
  // after the current song); a press while paused resumes the remaining queue.
  const handlePauseResume = () => {
    if (aiStatus === 'running') {
      pauseRef.current = true
      setAiStatus('pausing')
    } else if (aiStatus === 'paused') {
      pauseRef.current = false
      runLoop()
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

  // Fail-closed: when the feature is off, expose nothing. All hooks above still
  // run unconditionally (Rules of Hooks); only the returned value is gated.
  if (!DATES_ENABLED) return undefined

  return {
    // ControlBar wiring
    aiStatus,
    onRunSelected: handleRunSelected,
    onPauseResume: handlePauseResume,
    webSearchEnabled,
    onToggleWebSearch: handleToggleWebSearch,
    totalCost,
    onCommitTotalCost: (n: number) => setTotalCost(round5(n)),
    // SongList wiring
    aiDates,
    webSearchingId,
    // Confirm modal (rendered in App)
    confirmWebSearch,
    confirmWebSearchYes,
    closeWebSearchConfirm,
  }
}
