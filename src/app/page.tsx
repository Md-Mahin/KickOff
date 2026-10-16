import { Suspense } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { getMatches, getPopularMatches, getFavouriteMatches } from "@/lib/api"
import { RoleDashboard } from "@/components/dashboard/role-dashboard"
import { cookies } from "next/headers"
import { MatchList } from "@/components/matches/match-list"
import { FeaturedMatchesCarousel } from "@/components/matches/featured-matches-carousel"
import { BACKEND_URL } from "@/lib/backend-url"

export const dynamic = "force-dynamic"

async function FeaturedMatchesSection() {
  const cookieStore = await cookies()
  const cookieStr = cookieStore.toString()

  let isSignedIn = false
  try {
    const meRes = await fetch(`${BACKEND_URL}/api/auth/me`, {
      cache: "no-store",
      headers: cookieStr ? { cookie: cookieStr } : undefined,
    })
    isSignedIn = meRes.ok
  } catch {}

  const matches = isSignedIn
    ? await getFavouriteMatches(cookieStr)
    : await getPopularMatches()

  return <FeaturedMatchesCarousel matches={matches} isSignedIn={isSignedIn} />
}

async function MatchSection() {
  const cookieStr = (await cookies()).toString()
  const leagues = await getMatches(cookieStr)

  if (leagues.length === 0) {
    return (
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
    )
  }

  return <MatchList leagues={leagues} />
}

function MatchListFallback() {
  return (
    <div aria-label="Loading matches" aria-busy="true" className="space-y-4 animate-pulse">
      {[0, 1, 2].map((item) => (
        <div key={item} className="rounded-xl border border-border bg-card p-5">
          <div className="mb-5 h-5 w-40 rounded bg-muted" />
          <div className="space-y-4">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex items-center justify-between gap-4">
                <div className="h-4 w-2/5 rounded bg-muted" />
                <div className="h-4 w-12 rounded bg-muted" />
                <div className="h-4 w-2/5 rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function FeaturedMatchesFallback() {
  return (
    <div aria-label="Loading featured matches" aria-busy="true" className="mb-8 h-36 animate-pulse rounded-xl border border-border bg-card" />
  )
}

export default function HomePage() {
  return (
    <div className="min-h-screen text-foreground">
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Matches</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Live scores, recent results and upcoming fixtures by date.
            </p>
          </div>
        </div>

        <Suspense fallback={<FeaturedMatchesFallback />}>
          <FeaturedMatchesSection />
        </Suspense>

        <Suspense fallback={<MatchListFallback />}>
          <MatchSection />
        </Suspense>

        <RoleDashboard />
      </main>
    </div>
  )
}
