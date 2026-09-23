import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { getMatches, getPopularMatches, getFavouriteMatches } from "@/lib/api"
import type { MatchWithLeague } from "@/lib/matches"
import Image from "next/image"
import { RoleDashboard } from "@/components/dashboard/role-dashboard"
import { cookies } from "next/headers"
import { Badge } from "@/components/ui/badge"
import type { Match } from "@/lib/matches"
import { MatchList } from "@/components/matches/match-list"

export const dynamic = "force-dynamic"

function MatchStatus({ match }: { match: Match }) {
  if (match.status === "LIVE") {
    return (
      <Badge className="border-red-500/20 bg-red-500/10 text-red-500">
        {match.minute ? `LIVE ${match.minute}` : "LIVE"}
      </Badge>
    )
  }
  if (match.status === "FT") return <Badge variant="secondary">FT</Badge>
  return <Badge variant="outline">Today</Badge>
}

function MatchRow({ match }: { match: Match }) {
  return (
    <div className="flex items-center justify-between px-4 py-4">
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {match.homeLogo ? (
              <Image src={match.homeLogo} alt={match.homeTeam} width={24} height={24} className="object-contain" />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                {match.homeTeam.substring(0, 2).toUpperCase()}
              </div>
            )}
            <span className="text-sm font-medium">{match.homeTeam}</span>
          </div>
          <span className="text-sm font-semibold">{match.status === "UPCOMING" ? "-" : match.homeScore}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {match.awayLogo ? (
              <Image src={match.awayLogo} alt={match.awayTeam} width={24} height={24} className="object-contain" />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                {match.awayTeam.substring(0, 2).toUpperCase()}
              </div>
            )}
            <span className="text-sm font-medium">{match.awayTeam}</span>
          </div>
          <span className="text-sm font-semibold">{match.status === "UPCOMING" ? "-" : match.awayScore}</span>
        </div>
      </div>
      <div className="ml-4 flex w-20 flex-col items-end gap-2">
        <MatchStatus match={match} />
      </div>
    </div>
  )
}

// ── Featured section (most popular or favourites) ─────────────────────────────
function FeaturedMatchCard({ match }: { match: MatchWithLeague }) {
  return (
    <Link href={`/match/${match.id}`} prefetch={false} className="block">
      <div className="rounded-xl border border-border bg-card p-4 transition hover:bg-muted/50 min-w-[160px]">
        <p className="mb-3 truncate text-[11px] font-medium text-muted-foreground">{match.league}</p>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {match.homeLogo ? (
              <Image src={match.homeLogo} alt={match.homeTeam} width={18} height={18} className="object-contain shrink-0" />
            ) : (
              <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-muted text-[8px] font-bold">
                {match.homeTeam.substring(0, 2).toUpperCase()}
              </div>
            )}
            <span className="truncate text-xs font-medium">{match.homeTeam}</span>
            {match.status !== "UPCOMING" && (
              <span className="ml-auto text-xs font-semibold">{match.homeScore}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {match.awayLogo ? (
              <Image src={match.awayLogo} alt={match.awayTeam} width={18} height={18} className="object-contain shrink-0" />
            ) : (
              <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-muted text-[8px] font-bold">
                {match.awayTeam.substring(0, 2).toUpperCase()}
              </div>
            )}
            <span className="truncate text-xs font-medium">{match.awayTeam}</span>
            {match.status !== "UPCOMING" && (
              <span className="ml-auto text-xs font-semibold">{match.awayScore}</span>
            )}
          </div>
        </div>
        <div className="mt-3">
          <MatchStatus match={match} />
        </div>
      </div>
    </Link>
  )
}

function FeaturedSection({ matches, isSignedIn }: { matches: MatchWithLeague[]; isSignedIn: boolean }) {
  if (matches.length === 0) return null
  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">
            {isSignedIn ? "Your Favourites" : "Most Popular Today"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {isSignedIn ? "Matches featuring your teams" : "Biggest matches across all leagues"}
          </p>
        </div>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {matches.map(m => (
          <FeaturedMatchCard key={m.id} match={m} />
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function HomePage() {
  const cookieStore = await cookies()
  const cookieStr = cookieStore.toString()

  // Check auth server-side
  let isSignedIn = false
  try {
    const meRes = await fetch("http://localhost:5000/api/auth/me", {
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
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Live scores, fixtures and match stats.
            </p>
          </div>
        </div>

        <Separator className="my-6" />

        {/* Featured: Popular (logged out) or Favourites (logged in) */}
        <FeaturedSection matches={featuredMatches} isSignedIn={isSignedIn} />

        {/* All matches with working filters */}
        {leagues.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <div className="rounded-full bg-muted p-3 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>
              </div>
              <h3 className="text-lg font-semibold">No matches today</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-1">
                We couldn&apos;t find any fixtures. Make sure your backend is running.
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
