const failedImageSources = new Set()
const FAILED_IMAGE_STORAGE_KEY = "kickoff:failed-image-sources"

function readPersistedFailures() {
  if (typeof window === "undefined") return []
  try {
    const value = window.sessionStorage.getItem(FAILED_IMAGE_STORAGE_KEY)
    const parsed = value ? JSON.parse(value) : []
    return Array.isArray(parsed) ? parsed.filter((source) => typeof source === "string") : []
  } catch {
    return []
  }
}

export function normalizeImageSource(source) {
  if (typeof source !== "string") return null
  const value = source.trim()
  if (!value || value.startsWith("//")) return null
  if (value.startsWith("/")) return value

  try {
    const parsed = new URL(value)
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? value : null
  } catch {
    return null
  }
}

export function isImageHostConfiguredForOptimization(source) {
  if (typeof source !== "string" || source.startsWith("/")) return true
  try {
    const parsed = new URL(source)
    return parsed.protocol === "https:" && [
      "media.api-sports.io",
      "r2.thesportsdb.com",
      "crests.football-data.org",
    ].includes(parsed.hostname)
  } catch {
    return false
  }
}

export function imageSourceHasFailed(source) {
  if (failedImageSources.has(source)) return true
  if (!readPersistedFailures().includes(source)) return false
  failedImageSources.add(source)
  return true
}

export function rememberFailedImageSource(source) {
  if (typeof source !== "string" || !source || failedImageSources.has(source)) return
  if (failedImageSources.size >= 512) {
    const oldest = failedImageSources.values().next().value
    if (oldest) failedImageSources.delete(oldest)
  }
  failedImageSources.add(source)
  if (typeof window !== "undefined") {
    try {
      const allSources = new Set([...readPersistedFailures(), ...failedImageSources])
      window.sessionStorage.setItem(FAILED_IMAGE_STORAGE_KEY, JSON.stringify([...allSources].slice(-512)))
    } catch {
      // The in-memory cache still prevents repeat requests when storage is unavailable.
    }
  }
}

export function imageRenderState(source) {
  const normalized = normalizeImageSource(source)
  return {
    source: normalized,
    showFallback: normalized === null || imageSourceHasFailed(normalized),
  }
}

export function clearFailedImageSourcesForTests() {
  failedImageSources.clear()
}
