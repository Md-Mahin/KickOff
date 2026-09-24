import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Star, ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { getTournamentProfile } from "@/lib/api"
import type { TeamMatch, TournamentProfile } from "@/lib/matches"

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date)
}

function formatTime(dateString: string) {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function ResultBadge({ result }: { result: "W" | "L" | "D" | null }) {
  if (!result) return null
  const colors = {
    W: "bg-green-500",
    L: "bg-red-500",
    D: "bg-gray-400",
  }
  return (
    <span className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white ${colors[result]}`}>
      {result}
    </span>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FeaturedMatchCard({ match }: { match: TeamMatch }) {
  const homeLogo = match.homeTeam.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(match.homeTeam.name)}&background=eee&color=333&size=48`
  const awayLogo = match.awayTeam.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(match.awayTeam.name)}&background=eee&color=333&size=48`

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Featured Match</span>
        <span className="text-xs text-muted-foreground">{formatDate(match.date)} • {formatTime(match.date)}</span>
      </div>
      <div className="flex items-center justify-center gap-6">
        <div className="flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={homeLogo} alt={match.homeTeam.name} className="h-16 w-16 object-cover rounded-full" />
          <Link href={`/team/${match.homeTeam.id}`} className="text-sm font-semibold hover:underline">{match.homeTeam.name}</Link>
        </div>
        <div className="text-2xl font-black text-muted-foreground">VS</div>
        <div className="flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={awayLogo} alt={match.awayTeam.name} className="h-16 w-16 object-cover rounded-full" />
          <Link href={`/team/${match.awayTeam.id}`} className="text-sm font-semibold hover:underline">{match.awayTeam.name}</Link>
        </div>
      </div>
      <div className="mt-4 text-center">
        <Link href={`/match/${match.id}`}>
          <Button variant="secondary" size="sm" className="w-full">Match Details</Button>
        </Link>
      </div>
    </div>
  )
}

function MatchRow({ match }: { match: TeamMatch }) {
  const isUpcoming = match.status === "UPCOMING"

  return (
    <Link
      href={`/match/${match.id}`}
      className="group flex items-center gap-3 border-b border-border px-4 py-3 hover:bg-muted/40 transition-colors last:border-b-0 cursor-pointer"
    >
      <div className="w-16 shrink-0 text-xs text-muted-foreground leading-tight">
        <div>{formatDate(match.date).split(" ").slice(0, 2).join(" ")}</div>
        <div>{formatTime(match.date)}</div>
      </div>
      {!isUpcoming && (
        <div className="w-8 shrink-0 text-center">
          <span className={`text-[10px] font-bold ${match.status === "LIVE" ? "text-red-500 font-semibold" : "text-muted-foreground"}`}>
            {match.status}
          </span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center text-sm">
          <div className="w-6 shrink-0" />
          <span className="flex-1 truncate text-center font-medium group-hover:text-primary transition-colors">
            {match.homeTeam.name}
          </span>
          <span className="w-6 shrink-0 text-right font-bold tabular-nums">
            {match.status === "FT" ? match.homeGoals : "-"}
          </span>
        </div>
        <div className="flex items-center text-sm mt-1">
          <div className="w-6 shrink-0" />
          <span className="flex-1 truncate text-center font-medium group-hover:text-primary transition-colors">
            {match.awayTeam.name}
          </span>
          <span className="w-6 shrink-0 text-right font-bold tabular-nums">
            {match.status === "FT" ? match.awayGoals : "-"}
          </span>
        </div>
      </div>
      <div className="shrink-0 text-muted-foreground group-hover:text-foreground transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
      </div>
    </Link>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TournamentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: idStr } = await params
  const tournamentId = Number(idStr)

  if (Number.isNaN(tournamentId)) {
    notFound()
  }

  // Use real DB data, or fallback to Mock data if API isn't ready
  let data = await getTournamentProfile(tournamentId)

  // Fallback Mock Data as requested by user for immediate visual testing
  if (!data) {
    const fallback: TournamentProfile = {
      tournament: {
        id: tournamentId,
        name: "UEFA Champions League",
        type: "Club",
        edition: "2023/2024",
        logo: "https://ui-avatars.com/api/?name=UCL&background=random&color=fff&size=128",
        country: "Europe"
      },
      followers: 1200000,
      matches: [
        {
          id: 991,
          date: new Date(Date.now() + 86400000).toISOString(),
          status: "UPCOMING",
          homeTeam: { id: 1, name: "Real Madrid", logo: null },
          awayTeam: { id: 2, name: "Man City", logo: null },
          homeGoals: 0,
          awayGoals: 0,
          result: null,
          tournament: "UEFA Champions League",
          venue: null
        }
      ],
      standings: [
        {
          rank: 1,
          teamId: 1,
          teamName: "Real Madrid",
          teamLogo: null,
          played: 6,
          wins: 6,
          draws: 0,
          losses: 0,
          goalsFor: 16,
          goalsAgainst: 7,
          goalDifference: 9,
          points: 18,
          last5: ["W", "W", "W", "W", "W"]
        },
        {
          rank: 2,
          teamId: 3,
          teamName: "Napoli",
          teamLogo: null,
          played: 6,
          wins: 3,
          draws: 1,
          losses: 2,
          goalsFor: 10,
          goalsAgainst: 9,
          goalDifference: 1,
          points: 10,
          last5: ["W", "L", "D", "W", "L"]
        }
      ]
    }
    data = fallback
  }

  const { tournament, followers, matches, standings } = data

  const featuredMatch = matches.find(m => m.status === "UPCOMING") || matches[0]

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Hero Banner ── */}
      <header className="bg-card border-b border-border">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="relative h-24 w-24 overflow-hidden rounded-lg border border-border bg-white shadow-sm flex items-center justify-center p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={tournament.logo ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(tournament.name)}&background=random&color=fff&size=128`} 
                  alt={tournament.name} 
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
                  {tournament.name}
                  <span className="text-sm font-normal text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                    👥 {(followers / 1000000).toFixed(1)}M
                  </span>
                </h1>
                <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    🌍 {tournament.country ?? "International"}
                  </span>
                  <span>•</span>
                  <button className="flex items-center gap-1 hover:text-slate-900 transition-colors font-medium">
                    {tournament.edition ?? "26/27"} Season <ChevronDown className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="default" className="font-semibold px-6 shadow-sm">
                <Star className="mr-2 h-4 w-4" /> FAVOURITE
              </Button>
            </div>
          </div>
          
          {/* Timeline Bar */}
          <div className="mt-8 flex items-center gap-3">
            <span className="text-xs font-semibold text-muted-foreground w-12 text-right shrink-0">7 Jul</span>
            <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden relative">
              <div className="absolute left-0 top-0 h-full w-1/3 bg-slate-900 rounded-full"></div>
            </div>
            <span className="text-xs font-semibold text-muted-foreground w-12 shrink-0">5 Jun</span>
          </div>
        </div>
      </header>

      {/* ── Main Content Layout ── */}
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Left Column (Widgets) */}
          <div className="md:col-span-1 space-y-6">
            {featuredMatch && <FeaturedMatchCard match={featuredMatch} />}

            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="p-4 border-b border-border bg-slate-50/50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900">Matches</h3>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <Button variant="secondary" size="sm" className="h-7 text-xs flex-1 rounded-full">By date</Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs flex-1 rounded-full">By round</Button>
                </div>
                <Button variant="outline" size="sm" className="w-full justify-between h-8 text-xs font-normal">
                  Select Round <ChevronDown className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex flex-col">
                {matches.slice(0, 5).map(match => (
                  <MatchRow key={match.id} match={match} />
                ))}
              </div>
            </div>
          </div>

          {/* Right Column (Standings & Data) */}
          <div className="md:col-span-2 space-y-6">
            
            {/* Tabs */}
            <div className="flex items-center gap-6 border-b border-border pb-px overflow-x-auto">
              <button className="border-b-2 border-slate-900 pb-2 text-sm font-bold text-slate-900 whitespace-nowrap">Standings</button>
              <button className="border-b-2 border-transparent pb-2 text-sm font-medium text-muted-foreground hover:text-slate-900 whitespace-nowrap">Knockout</button>
              <button className="border-b-2 border-transparent pb-2 text-sm font-medium text-muted-foreground hover:text-slate-900 whitespace-nowrap">Stats</button>
              <button className="border-b-2 border-transparent pb-2 text-sm font-medium text-muted-foreground hover:text-slate-900 whitespace-nowrap">Details</button>
              <button className="border-b-2 border-transparent pb-2 text-sm font-medium text-muted-foreground hover:text-slate-900 whitespace-nowrap">Media</button>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2">
              <button className="px-4 py-1.5 rounded-full bg-slate-900 text-white text-xs font-bold shadow-sm">All</button>
              <button className="px-4 py-1.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-semibold transition-colors">Home</button>
              <button className="px-4 py-1.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-semibold transition-colors">Away</button>
            </div>

            {/* Standings Table */}
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-slate-50/80 text-left text-xs font-semibold text-muted-foreground">
                    <th className="px-4 py-3 font-medium w-8 text-center">#</th>
                    <th className="px-2 py-3 font-medium">Team</th>
                    <th className="px-2 py-3 font-medium text-center w-8">P</th>
                    <th className="px-2 py-3 font-medium text-center w-8">W</th>
                    <th className="px-2 py-3 font-medium text-center w-8">D</th>
                    <th className="px-2 py-3 font-medium text-center w-8">L</th>
                    <th className="px-2 py-3 font-medium text-center w-10">GLS</th>
                    <th className="px-2 py-3 font-medium text-center w-10">DIFF</th>
                    <th className="px-2 py-3 font-medium text-center hidden sm:table-cell">Last 5</th>
                    <th className="px-4 py-3 font-bold text-slate-900 text-center w-10">PTS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {standings.map((row, idx) => (
                    <tr key={row.teamId} className="group hover:bg-slate-50 transition-colors relative">
                      {/* Qualification Zone Indicator (Playoffs vs Elimination) */}
                      <td className="absolute left-0 top-0 bottom-0 w-1 bg-transparent group-first:bg-blue-500 group-last:bg-red-500"></td>
                      
                      <td className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">{row.rank ?? idx + 1}</td>
                      <td className="px-2 py-3">
                        <Link href={`/team/${row.teamId}`} className="flex items-center gap-3 hover:underline">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img 
                            src={row.teamLogo ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(row.teamName)}&background=eee&color=333&size=24`}
                            alt={row.teamName}
                            className="h-6 w-6 object-cover rounded-full"
                          />
                          <span className="font-semibold text-slate-900 whitespace-nowrap">{row.teamName}</span>
                        </Link>
                      </td>
                      <td className="px-2 py-3 text-center">{row.played}</td>
                      <td className="px-2 py-3 text-center">{row.wins}</td>
                      <td className="px-2 py-3 text-center">{row.draws}</td>
                      <td className="px-2 py-3 text-center">{row.losses}</td>
                      <td className="px-2 py-3 text-center">{row.goalsFor}:{row.goalsAgainst}</td>
                      <td className="px-2 py-3 text-center font-medium">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                      <td className="px-2 py-3 text-center hidden sm:table-cell">
                        <div className="flex items-center justify-center gap-1">
                          {row.last5.map((res, i) => (
                            <ResultBadge key={i} result={res} />
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-slate-900">{row.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}

