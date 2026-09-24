import { notFound } from "next/navigation"
import Link from "next/link"
import { getTeamProfile } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MatchesWidget } from "@/components/team/matches-widget"
import type { TeamMatch, TeamStanding, TeamStandingRow } from "@/lib/matches"

/* ── Helpers ──────────────────────────────────────────────────────────── */

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
}

function ResultBadge({ result }: { result: "W" | "L" | "D" | null }) {
  if (!result) return null
  const colors = {
    W: "bg-emerald-100 text-emerald-700",
    L: "bg-red-100 text-red-700",
    D: "bg-gray-200 text-gray-600",
  }
  return (
    <span className={`inline-flex h-6 w-6 items-center justify-center rounded text-xs font-bold leading-none select-none text-center ${colors[result]}`}>
      {result}
    </span>
  )
}

function ResultPill({ result }: { result: "W" | "L" | "D" }) {
  const colors = {
    W: "bg-emerald-500",
    L: "bg-red-500",
    D: "bg-gray-400",
  }
  return (
    <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold leading-none select-none text-white text-center ${colors[result]}`}>
      {result}
    </span>
  )
}

/* Compute last-5 results for a given team from the match list */
function getLast5(teamId: number, matches: TeamMatch[]): ("W" | "L" | "D")[] {
  return matches
    .filter(m => m.status === "FT" && m.result !== null && (m.homeTeam.id === teamId || m.awayTeam.id === teamId))
    .slice(0, 5)
    .map(m => {
      const isHome = m.homeTeam.id === teamId
      if (m.homeGoals === m.awayGoals) return "D"
      if (isHome) return m.homeGoals > m.awayGoals ? "W" : "L"
      return m.awayGoals > m.homeGoals ? "W" : "L"
    })
}

/* ── Zone border color for standings rank ─────────────────────────────── */
function zoneColor(rank: number | null): string {
  if (rank === null) return ""
  if (rank <= 4) return "border-l-4 border-l-emerald-500"     // Champions League
  if (rank <= 6) return "border-l-4 border-l-blue-500"        // Europa League
  return ""
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export default async function TeamPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const teamId = Number(id)
  if (Number.isNaN(teamId)) notFound()

  const profile = await getTeamProfile(teamId)
  if (!profile) notFound()

  const { team, homeVenue, tournaments, matches, standings, squad } = profile

  const finishedMatches = matches.filter(m => m.status === "FT")
  const upcomingMatches = matches.filter(m => m.status === "UPCOMING" || m.status === "LIVE")

  /* Previous / Next match for the hero */
  const previousMatch = finishedMatches[0] ?? null
  const upcomingSorted = [...upcomingMatches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const nextMatch = upcomingSorted[0] ?? null
  const primaryLeague = tournaments[0]?.name ?? "—"

  const avatarUrl = team.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(team.name)}&background=0D8ABC&color=fff&size=128`

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-7xl px-4 py-6">

        {/* ═══════════════════════ HERO CARD ═══════════════════════ */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">

              {/* ── Left: Team Info ── */}
              <div className="flex items-start gap-5">
                {/* Logo */}
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={avatarUrl} alt={team.name} className="h-full w-full object-cover" />
                </div>

                <div className="min-w-0">
                  {/* Name + followers */}
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold">{team.name}</h1>
                    <span className="text-sm font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                      {(team.followers ?? 0).toLocaleString()} {(team.followers ?? 0) === 1 ? "follower" : "followers"}
                    </span>
                  </div>

                  {/* Country + Coach */}
                  <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                    {team.country && <span>🌍 {team.country}</span>}
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-5 w-5 rounded-full bg-gray-300" />
                      Manager TBD
                    </span>
                  </div>

                  {/* Venue + League / Tournaments */}
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    {homeVenue && (
                      <span className="flex items-center gap-1">
                        🏟️ {homeVenue.name}
                      </span>
                    )}
                    {tournaments.length > 0 ? (
                      tournaments.map((t) => (
                        <Link
                          key={t.id}
                          href={`/tournament/${t.id}`}
                          className="flex items-center gap-1 hover:text-blue-600 hover:underline transition-colors"
                        >
                          ⚽ {t.name}
                        </Link>
                      ))
                    ) : (
                      <span className="flex items-center gap-1">
                        ⚽ {primaryLeague}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Right: Actions + Prev/Next ── */}
              <div className="flex flex-col items-end gap-3">
                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  <button className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-yellow-500 hover:bg-muted transition-colors">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" /></svg>
                  </button>
                </div>

                {/* Prev / Next match cards */}
                <div className="flex gap-3">
                  {previousMatch && (
                    <MiniMatchCard label="Previous Match" match={previousMatch} teamId={teamId} />
                  )}
                  {nextMatch && (
                    <MiniMatchCard label="Next Match" match={nextMatch} teamId={teamId} />
                  )}
                </div>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* ═══════════════════════ TWO-COLUMN LAYOUT ═══════════════════════ */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">

          {/* ── Left Column: Matches ── */}
          <MatchesWidget
            teamId={teamId}
            finishedMatches={finishedMatches}
            upcomingMatches={upcomingSorted}
          />

          {/* ── Right Column: Standings ── */}
          <StandingsWidget standings={standings} currentTeamId={teamId} allMatches={matches} />

        </div>
      </main>
    </div>
  )
}

/* ── Mini Match Card (Hero) ────────────────────────────────────────────── */

function MiniMatchCard({ label, match, teamId }: { label: string; match: TeamMatch; teamId: number }) {
  const opponent = match.homeTeam.id === teamId ? match.awayTeam : match.homeTeam
  const opponentLogo = opponent.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(opponent.name)}&background=eee&color=333&size=32`

  return (
    <div className="w-44 rounded-lg border border-border bg-card p-3">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <Link href={`/match/${match.id}`} className="mt-1 block text-[10px] text-muted-foreground hover:underline">
        {match.tournament}
      </Link>
      <div className="mt-1 text-[10px] text-muted-foreground">{formatDate(match.date)} • {formatTime(match.date)}</div>
      <div className="mt-2 flex items-center gap-2">
        {opponent.id ? (
          <Link
            href={`/team/${opponent.id}`}
            className="flex items-center gap-2 min-w-0 group hover:text-blue-600 transition-colors"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={opponentLogo} alt={opponent.name} className="h-6 w-6 rounded-full object-cover shrink-0" />
            <span className="truncate text-sm font-medium group-hover:underline">{opponent.name}</span>
          </Link>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={opponentLogo} alt={opponent.name} className="h-6 w-6 rounded-full object-cover shrink-0" />
            <span className="truncate text-sm font-medium">{opponent.name}</span>
          </div>
        )}
      </div>
      {match.status === "FT" && (
        <div className="mt-1 flex items-center gap-2">
          <Link href={`/match/${match.id}`} className="text-sm font-bold hover:underline">
            {match.homeGoals} - {match.awayGoals}
          </Link>
          <ResultBadge result={match.result} />
        </div>
      )}
    </div>
  )
}



/* ── Standings Widget (Right Column) ───────────────────────────────────── */

function StandingsWidget({
  standings,
  currentTeamId,
  allMatches,
}: {
  standings: TeamStanding[]
  currentTeamId: number
  allMatches: TeamMatch[]
}) {
  if (standings.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          No standings available.
        </CardContent>
      </Card>
    )
  }

  const standing = standings[0] // Show first tournament standing

  return (
    <Card>
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold">Standings</h2>
          <span className="text-xs text-muted-foreground">{standing.tournamentName}</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-muted-foreground">
                <th className="px-3 py-2 w-8 text-center">#</th>
                <th className="px-3 py-2">Team</th>
                <th className="px-3 py-2 text-center">P</th>
                <th className="px-3 py-2 text-center">W</th>
                <th className="px-3 py-2 text-center">D</th>
                <th className="px-3 py-2 text-center">L</th>
                <th className="px-3 py-2 text-center">DIFF</th>
                <th className="px-3 py-2 text-center">GLS</th>
                <th className="px-3 py-2 text-center hidden sm:table-cell">Last 5</th>
                <th className="px-3 py-2 text-center font-bold">PTS</th>
              </tr>
            </thead>
            <tbody>
              {standing.rows.map((row) => (
                <StandingRow
                  key={row.teamId}
                  row={row}
                  isCurrentTeam={row.teamId === currentTeamId}
                  last5={getLast5(row.teamId, allMatches)}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex gap-4 border-t border-border px-5 py-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Champions League
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500" /> Europa League
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

/* ── Single Standing Row ───────────────────────────────────────────────── */

function StandingRow({
  row,
  isCurrentTeam,
  last5,
}: {
  row: TeamStandingRow
  isCurrentTeam: boolean
  last5: ("W" | "L" | "D")[]
}) {
  return (
    <tr className={`border-b border-border last:border-b-0 transition-colors hover:bg-muted/30 ${isCurrentTeam ? "bg-blue-50/60" : ""} ${zoneColor(row.rank)}`}>
      <td className="px-3 py-2 text-center font-medium">{row.rank ?? "-"}</td>
      <td className="px-3 py-2">
        <Link
          href={`/team/${row.teamId}`}
          className={`hover:underline ${isCurrentTeam ? "font-bold text-blue-700" : "text-foreground"}`}
        >
          {row.teamName}
        </Link>
        {row.country && <span className="ml-1 text-muted-foreground">({row.country})</span>}
      </td>
      <td className="px-3 py-2 text-center">{row.played}</td>
      <td className="px-3 py-2 text-center">{row.wins}</td>
      <td className="px-3 py-2 text-center">{row.draws}</td>
      <td className="px-3 py-2 text-center">{row.losses}</td>
      <td className="px-3 py-2 text-center">
        <span className={row.goalDifference > 0 ? "text-emerald-600" : row.goalDifference < 0 ? "text-red-500" : ""}>
          {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
        </span>
      </td>
      <td className="px-3 py-2 text-center">{row.goalsFor}</td>
      <td className="px-3 py-2 text-center hidden sm:table-cell">
        <div className="flex items-center justify-center gap-1">
          {last5.length > 0
            ? last5.map((r, i) => <ResultPill key={i} result={r} />)
            : <span className="text-muted-foreground">—</span>
          }
        </div>
      </td>
      <td className="px-3 py-2 text-center font-bold">{row.points}</td>
    </tr>
  )
}

