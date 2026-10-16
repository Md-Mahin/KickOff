import assert from "node:assert/strict"
import {
  clearFailedImageSourcesForTests,
  imageRenderState,
  isImageHostConfiguredForOptimization,
  normalizeImageSource,
  rememberFailedImageSource,
} from "../../src/lib/image-fallback.mjs"

clearFailedImageSourcesForTests()
assert.equal(normalizeImageSource(null), null)
assert.equal(normalizeImageSource("   "), null)
assert.equal(normalizeImageSource("javascript:alert(1)"), null)
assert.equal(normalizeImageSource("//untrusted.example/logo.png"), null)
assert.equal(normalizeImageSource("/logos/team.png"), "/logos/team.png")
const missingLogo = "https://media.api-sports.io/football/teams/28429.png"
assert.equal(normalizeImageSource(missingLogo), missingLogo)
assert.equal(isImageHostConfiguredForOptimization(missingLogo), true)
assert.equal(isImageHostConfiguredForOptimization("https://unknown.example/logo.png"), false)
assert.deepEqual(imageRenderState(missingLogo), { source: missingLogo, showFallback: false })
rememberFailedImageSource(missingLogo)
assert.deepEqual(imageRenderState(missingLogo), { source: missingLogo, showFallback: true },
  "a failed logo switches to its neutral fallback")
assert.deepEqual(imageRenderState(missingLogo), { source: missingLogo, showFallback: true },
  "later components reuse the failed-URL cache instead of requesting it again")
const storedFailures = new Map()
globalThis.window = { sessionStorage: {
  getItem: (key) => storedFailures.get(key) ?? null,
  setItem: (key, value) => storedFailures.set(key, value),
} }
const reloadedPageLogo = "https://crests.football-data.org/404.png"
rememberFailedImageSource(reloadedPageLogo)
clearFailedImageSourcesForTests()
assert.deepEqual(imageRenderState(reloadedPageLogo), { source: reloadedPageLogo, showFallback: true },
  "session storage remembers a bad URL after a page reload")
delete globalThis.window
assert.deepEqual(imageRenderState(undefined), { source: null, showFallback: true })

console.log("Image fallback tests passed: URL validation, missing source, fallback state, and shared failed-URL cache.")
