import { Card, CardContent } from "@/components/ui/card"
import { getMatches, getPopularMatches, getFavouriteMatches } from "@/lib/api"
import { RoleDashboard } from "@/components/dashboard/role-dashboard"
import { cookies } from "next/headers"
import { MatchList } from "@/components/matches/match-list"
import { FeaturedMatchesCarousel } from "@/components/matches/featured-matches-carousel"
import { BACKEND_URL } from "@/lib/backend-url"

export const dynamic = "force-dynamic"

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function HomePage() {
  const cookieStore = await cookies()
  const cookieStr = cookieStore.toString()

  // Check auth server-side
  let isSignedIn = false
  try {
    const meRes = await fetch(`${BACKEND_URL}/api/auth/me`, {
      cache: "no-store",
      headers: cookieStr ? { cookie: cookieStr } : undefined,
    })
    isSignedIn = meRes.ok
  } catch {}

  // Fetch main league list + featured section in parallel
  const [leagues, featuredMatches] = await Promise.all([
    getMatches(cookieStr),
    isSignedIn ? getFavouriteMatches(cookieStr) : getPopularMatches(),
  ])

  return (
    <div className="min-h-screen text-foreground">
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Matches</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Live scores, recent results and upcoming fixtures by date.
            </p>
          </div>
        </div>

        {/* Featured: Autoscrolling Popular (logged out) or Favourites (logged in) */}
        <FeaturedMatchesCarousel matches={featuredMatches} isSignedIn={isSignedIn} />

        {/* All matches with working filters */}
        {leagues.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <div className="rounded-full bg-muted p-3 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>
              </div>
              <h3 className="text-lg font-semibold">No matches available</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-1">
                Matches will appear here after the backend syncs the fixtures into the database.
              </p>
            </CardContent>
          </Card>
        ) : (
          <MatchList leagues={leagues} />
        )}

        <RoleDashboard />
      </main>
    </div>
  )
}
