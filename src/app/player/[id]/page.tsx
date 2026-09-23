import { notFound } from "next/navigation"
import Link from "next/link"
import { getPlayerProfile } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import type { TeamMatch } from "@/lib/matches"

/* ── Helpers ──────────────────────────────────────────────────────────── */

function formatDate(iso: string | null) {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function formatTime(iso: string | null) {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
}

function calculateAge(dob: string | null) {
  if (!dob) return "Unknown"
  const birthDate = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const m = today.getMonth() - birthDate.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  return age
}

function ResultBadge({ result }: { result: "W" | "L" | "D" | null }) {
  if (!result) return null
  const colors = {
    W: "bg-emerald-100 text-emerald-700",
    L: "bg-red-100 text-red-700",
    D: "bg-gray-200 text-gray-600",
  }
  return (
    <span className={`inline-flex h-6 w-6 items-center justify-center rounded text-xs font-bold ${colors[result]}`}>
      {result}
    </span>
  )
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const playerId = Number(id)
  if (Number.isNaN(playerId)) notFound()

  const profile = await getPlayerProfile(playerId)
  if (!profile) notFound()

  const { player, followers, club, matches, stats } = profile

  /* Previous / Next match for the hero */
  const previousMatch = matches.find(m => m.status === "FT") ?? null
  const nextMatch = matches.find(m => m.status === "UPCOMING" || m.status === "LIVE") ?? null

  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(player.name)}&background=random&color=fff&size=256`
  const followersFormatted = followers >= 1000000 ? (followers / 1000000).toFixed(1) + "M" : followers >= 1000 ? (followers / 1000).toFixed(1) + "K" : followers

  // Mocked physical traits for UI consistency based on player ID
  const height = 175 + (playerId % 15) // Mock between 175cm - 190cm
  const foot = playerId % 2 === 0 ? "Right" : "Left"
  const jersey = (playerId % 99) + 1 // Mock 1 - 99
  const position = club?.position ?? "Midfielder"
  const marketValue = 5 + (playerId % 95) // Mock 5M - 100M

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-7xl px-4 py-6">

        {/* ═══════════════════════ HERO CARD ═══════════════════════ */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">

              {/* ── Left: Player Identity ── */}
              <div className="flex items-start gap-5">
                {/* Photo */}
                <div className="h-28 w-28 shrink-0 overflow-hidden rounded-full bg-gray-100 shadow-sm border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={avatarUrl} alt={player.name} className="h-full w-full object-cover" />
                </div>

                <div className="min-w-0 pt-2">
                  {/* Name + followers */}
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold">{player.name}</h1>
                    <span className="text-sm font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{followersFormatted} fans</span>
                  </div>

                  {/* Club Info */}
                  <div className="mt-3 flex items-center gap-3 text-sm font-medium">
                    {club ? (
                      <Link href={`/team/${club.id}`} className="flex items-center gap-2 hover:underline">
                        {club.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={club.logo} alt={club.name} className="h-5 w-5 object-contain" />
                        ) : (
                          <div className="h-5 w-5 rounded-full bg-gray-200" />
                        )}
                        <span>{club.name}</span>
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Free Agent</span>
                    )}
                  </div>

                  {/* Metadata Row */}
                  <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                    {player.nationality && (
                      <span className="flex items-center gap-1.5">
                        <span className="text-lg">🌍</span> {player.nationality}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <span className="font-semibold text-foreground">Age:</span> {calculateAge(player.dateOfBirth)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="font-semibold text-foreground">Position:</span> {position}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="font-semibold text-foreground">Height:</span> {height} cm
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="font-semibold text-foreground">Foot:</span> {foot}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="font-semibold text-foreground">No:</span> {jersey}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Right: Actions + Prev/Next ── */}
              <div className="flex flex-col items-end gap-3 pt-2">
                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  <button className="rounded-lg border border-border px-4 py-1.5 text-sm font-medium hover:bg-muted transition-colors">
                    Compare
                  </button>
                  <button className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-yellow-500 hover:bg-muted transition-colors">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" /></svg>
                  </button>
                  <button className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-blue-500 hover:bg-muted transition-colors">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" /></svg>
                  </button>
                </div>

                {/* Prev / Next match cards */}
                {club && (
                  <div className="flex gap-3 mt-1">
                    {previousMatch && (
                      <MiniMatchCard label="Previous Match" match={previousMatch} teamId={club.id} />
                    )}
                    {nextMatch && (
                      <MiniMatchCard label="Next Match" match={nextMatch} teamId={club.id} />
                    )}
                  </div>
                )}
              </div>

            </div>
          </CardContent>
        </Card>

        {/* ═══════════════════════ TWO-COLUMN LAYOUT ═══════════════════════ */}
        <div className="mt-6 grid gap-6 lg:grid-cols-12">

          {/* ── Left Column: Market & Club Data ── */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Value Card */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Market Value</h3>
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-bold">{marketValue}M €</span>
                  <span className="flex items-center text-sm font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                    +5.2%
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Club History Card */}
            {club && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Current Club</h3>
                  <div className="flex items-center gap-4">
                    {club.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={club.logo} alt={club.name} className="h-12 w-12 object-contain" />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 font-bold">
                        {club.name.substring(0,2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <Link href={`/team/${club.id}`} className="text-lg font-bold hover:underline">
                        {club.name}
                      </Link>
                      <div className="text-sm text-muted-foreground mt-0.5">
                        Joined: {formatDate(club.joinDate)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── Right Column: Career/Season Stats ── */}
          <div className="lg:col-span-8">
            <Card className="h-full">
              <CardContent className="p-0">
                {/* Tabs */}
                <div className="flex border-b border-border">
                  <button className="px-6 py-4 text-sm font-bold text-blue-600 border-b-2 border-blue-600">
                    Career
                  </button>
                  <button className="px-6 py-4 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                    Season
                  </button>
                  <button className="px-6 py-4 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                    Media
                  </button>
                </div>

                {/* Stats Dashboard */}
                <div className="p-8">
                  <h2 className="text-xl font-bold mb-8">Performance Overview</h2>
                  
                  <div className="grid grid-cols-2 gap-8">
                    {/* Goals */}
                    <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-2xl border border-gray-100">
                      <span className="text-6xl font-black text-gray-900 mb-2">{stats.totalGoals}</span>
                      <span className="text-sm font-bold uppercase tracking-widest text-gray-500">Total Goals</span>
                    </div>

                    {/* Assists */}
                    <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-2xl border border-gray-100">
                      <span className="text-6xl font-black text-gray-900 mb-2">{stats.totalAssists}</span>
                      <span className="text-sm font-bold uppercase tracking-widest text-gray-500">Total Assists</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

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
    <Link href={`/match/${match.id}`} className="block hover:opacity-80 transition-opacity">
      <div className="w-44 rounded-lg border border-border bg-card p-3 shadow-sm">
        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-1 text-[10px] text-muted-foreground truncate">{match.tournament}</div>
        <div className="mt-1 text-[10px] text-muted-foreground">{formatDate(match.date)} • {formatTime(match.date)}</div>
        <div className="mt-2 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={opponentLogo} alt={opponent.name} className="h-6 w-6 rounded-full object-cover" />
          <span className="truncate text-sm font-medium">{opponent.name}</span>
        </div>
        {match.status === "FT" && (
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm font-bold">{match.homeGoals} - {match.awayGoals}</span>
            <ResultBadge result={match.result} />
          </div>
        )}
      </div>
    </Link>
  )
}

