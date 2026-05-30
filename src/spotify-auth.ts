// ─────────────────────────────────────────────────────────────────────────────
// USER-TOKEN WORLD — authentication
//
// This module owns the Spotify user login (Authorization Code + PKCE) via the
// official SDK. It is completely separate from the client-credentials world in
// spotify.ts: that one powers "regular mode" (single-song add) and never needs
// a login; this one is only used to unlock the playlist-import feature.
//
// Token storage is namespaced under a "music-cards:" key prefix (see
// PrefixedCache below) so this app's token never collides with the separate
// player app's token, even when both run on the same origin (host:port).
// ─────────────────────────────────────────────────────────────────────────────

import {
  SpotifyApi,
  LocalStorageCachingStrategy,
  type ICachingStrategy,
  type ICachable,
} from '@spotify/web-api-ts-sdk'

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string

// Only what the playlist-import feature needs. Deliberately omits the playback
// scopes the separate player app uses.
const SCOPES = ['playlist-read-private', 'playlist-read-collaborative']

const CACHE_PREFIX = 'music-cards:'

// Wraps the SDK's default LocalStorageCachingStrategy, prefixing every cache key
// so this app's stored token + PKCE verifier live in their own namespace.
class PrefixedCache implements ICachingStrategy {
  private inner = new LocalStorageCachingStrategy()

  private k(cacheKey: string): string {
    return `${CACHE_PREFIX}${cacheKey}`
  }

  getOrCreate<T>(
    cacheKey: string,
    createFunction: () => Promise<T & ICachable & object>,
  ): Promise<T & ICachable> {
    return this.inner.getOrCreate(this.k(cacheKey), createFunction)
  }

  get<T>(cacheKey: string): Promise<(T & ICachable) | null> {
    return this.inner.get<T>(this.k(cacheKey))
  }

  setCacheItem<T>(cacheKey: string, item: T & ICachable): void {
    this.inner.setCacheItem(this.k(cacheKey), item)
  }

  remove(cacheKey: string): void {
    this.inner.remove(this.k(cacheKey))
  }
}

function getRedirectUri(): string {
  return `${window.location.origin}/callback`
}

export function getRedirectUriForDisplay(): string {
  return getRedirectUri()
}

// Create the SDK instance. One per app load.
export function createSpotifyApi(): SpotifyApi {
  return SpotifyApi.withUserAuthorization(CLIENT_ID, getRedirectUri(), SCOPES, {
    cachingStrategy: new PrefixedCache(),
  })
}

// Clear only this app's namespaced auth keys from localStorage (used by logout).
// Leaves any other app's Spotify token untouched.
export function clearStoredAuth(): void {
  const toRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(CACHE_PREFIX)) toRemove.push(key)
  }
  toRemove.forEach(k => localStorage.removeItem(k))
}

// True if this app has any namespaced token cached (does NOT validate it).
export function hasStoredToken(): boolean {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(CACHE_PREFIX)) return true
  }
  return false
}
