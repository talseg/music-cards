// AI release-year lookup via the Perplexity Agent API (bare model, no web search).
//
// The browser calls the local /api/perplexity proxy with only { model, input }.
// The proxy (configured in vite.config.ts) attaches the secret API key
// server-side, so the key is never exposed to the browser bundle. This mirrors
// the existing Spotify client-secret proxy pattern.
//
// We deliberately send NO `tools` and NO `preset` so the model answers purely
// from its training knowledge — far cheaper than search-grounded queries, and
// year-level accuracy is all the game needs.

// Cheapest Google model in the Agent API table, and the non-preview (stable)
// variant Google recommends migrating to. Kept as a single constant so swapping
// models (or adding a runtime picker later) is a one-line change.
const MODEL = 'google/gemini-3.1-flash-lite'

export interface SuggestedYearResult {
  year: 'Error' | 'Unknown' | number
  cost: number
}

// Build the from-memory prompt. Asks for THIS artist's version (not a cover's
// original), and explicitly excludes remasters / reissues / compilations, which
// is exactly the class of error Spotify's release_date tends to introduce.
function buildPrompt(songName: string, artistName: string): string {
  return (
    `In what year was earliest commercial availability (album or single) of the song "${songName}" by "${artistName}" ` +
    `I want the THIS specific artist's version, ` +
    `not the original songwriter's version if it's a cover, and not a later ` +
    `remaster, reissue, or compilation. Only if you can't find the album date, use ` +
    `the recording date.` +
    `give me the earliest release date` +
    `Do not associate it with the artist's debut year or the year of their first-ever hit.` +
    `Ignore the year the song reached the charts or became a popular hit` +
    `If the song is a cover, ensure the release date corresponds to this artist's version` +
    ` Do not use a net search. Answer only from your internal training data.` +
    `Language Source Preference: For Hebrew songs, prioritize information consistent with` +
    `authoritative Hebrew sources, such as the National Library of Israel (הספריה הלאומית)` + 
    `Answer with just the year as a single number.` +
    `If you don't know answer with one word - Unknown`
  )
}

// Pull the assistant text out of the Agent API response. The year lives at
// output[].content[].text on the block whose type is "output_text".
function extractText(data: unknown): string {
  const output = (data as { output?: unknown }).output
  if (!Array.isArray(output)) return ''
  let text = ''
  for (const item of output) {
    const content = (item as { content?: unknown }).content
    if (!Array.isArray(content)) continue
    for (const block of content) {
      const b = block as { type?: string; text?: string }
      if (b.type === 'output_text' && typeof b.text === 'string') {
        text += b.text
      }
    }
  }
  return text
}

// First standalone 4-digit year in the text (1000–2999). Returns null if none.
function parseYear(text: string): number | null {
  const match = text.match(/\b([12]\d{3})\b/)
  return match ? Number(match[1]) : null
}

function extractCost(data: unknown): number {
  const total = (data as { usage?: { cost?: { total_cost?: unknown } } })
    .usage?.cost?.total_cost
  return typeof total === 'number' ? total : 0
}

// Ask the model for the likely original release year of one song.
// Never throws for an unparseable answer — that comes back as { year: null }.
// Network / HTTP failures DO throw, so the caller can mark the row "Error".
export async function getSuggestedYear(
  songName: string,
  artistName: string,
  model: string = MODEL,
): Promise<SuggestedYearResult> {
  const response = await fetch('/api/perplexity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      input: buildPrompt(songName, artistName),
      temperature: 1,
    }),
  })

  if (!response.ok) {
    throw new Error(`Perplexity request failed: ${response.status}`)
  }

  const data = await response.json()
  const text = extractText(data)
  return {
    year: /\bunknown\b/i.test(text) ? 'Unknown' : (parseYear(text) ?? 'Error'),
    cost: extractCost(data),
  }
}
