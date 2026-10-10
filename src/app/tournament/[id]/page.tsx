import { notFound } from "next/navigation"
import { ChevronDown } from "lucide-react"

import FollowButton, { FollowersCountBadge } from "@/components/ui/follow-button"
import { getTournamentProfile } from "@/lib/api"
import type { TournamentProfile } from "@/lib/matches"
import TournamentInteractiveContent from "@/components/tournament/tournament-interactive-content"

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

  // Fallback Mock Data with knockout matches for testing
  if (!data) {
    const fallback: TournamentProfile = {
      tournament: {
        id: tournamentId,
        name: "UEFA Champions League",
        type: "Club",
        edition: "2026/2027",
        logo: "https://ui-avatars.com/api/?name=UCL&background=random&color=fff&size=128",
        country: "Europe",
      },
      followers: 1200000,
      matches: [
        {
          id: 206,
          date: new Date(Date.now() - 86400000 * 2).toISOString(),
          status: "FT",
          round_status: "knockout",
          round_position: "GF",
          homeTeam: { id: 1, name: "Real Madrid", logo: null },
          awayTeam: { id: 2, name: "Barcelona", logo: null },
          homeGoals: 3,
          awayGoals: 2,
          result: "W",
          tournament: "UEFA Champions League",
          venue: null,
        },
        {
          id: 210,
          date: new Date(Date.now() - 86400000 * 5).toISOString(),
          status: "FT",
          round_status: "knockout",
          round_position: "SF",
          homeTeam: { id: 3, name: "PSG", logo: null },
          awayTeam: { id: 1, name: "Real Madrid", logo: null },
          homeGoals: 2,
          awayGoals: 3,
          result: "L",
          tournament: "UEFA Champions League",
          venue: null,
        },
        {
          id: 14,
          date: new Date(Date.now() - 86400000 * 6).toISOString(),
          status: "FT",
          round_status: "knockout",
          round_position: "SF",
          homeTeam: { id: 4, name: "AC Milan", logo: null },
          awayTeam: { id: 5, name: "Inter Milan", logo: null },
          homeGoals: 0,
          awayGoals: 0,
          result: "D",
          tournament: "UEFA Champions League",
          venue: null,
        },
        {
          id: 16,
          date: new Date(Date.now() - 86400000 * 12).toISOString(),
          status: "FT",
          round_status: "knockout",
          round_position: "QF",
          homeTeam: { id: 5, name: "Inter Milan", logo: null },
          awayTeam: { id: 6, name: "Juventus", logo: null },
          homeGoals: 2,
          awayGoals: 1,
          result: "W",
          tournament: "UEFA Champions League",
          venue: null,
        },
        {
          id: 991,
          date: new Date(Date.now() + 86400000).toISOString(),
          status: "UPCOMING",
          round_status: "league",
          round_position: null,
          homeTeam: { id: 1, name: "Real Madrid", logo: null },
          awayTeam: { id: 7, name: "Man City", logo: null },
          homeGoals: 0,
          awayGoals: 0,
          result: null,
          tournament: "UEFA Champions League",
          venue: null,
        },
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
          last5: ["W", "W", "W", "W", "W"],
        },
        {
          rank: 2,
          teamId: 3,
          teamName: "PSG",
          teamLogo: null,
          played: 6,
          wins: 4,
          draws: 1,
          losses: 1,
          goalsFor: 12,
          goalsAgainst: 6,
          goalDifference: 6,
          points: 13,
          last5: ["W", "W", "D", "W", "L"],
        },
      ],
    }
    data = fallback
  }

  const { tournament, followers, matches, standings } = data

  return (
    <div className="min-h-screen text-foreground">
      {/* ── Hero Banner Section Blob ── */}
      <header className="mx-auto max-w-5xl px-4 pt-8">
        <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="relative h-24 w-24 overflow-hidden rounded-lg border border-border bg-white shadow-sm flex items-center justify-center p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    tournament.logo ??
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      tournament.name
                    )}&background=random&color=fff&size=128`
                  }
                  alt={tournament.name}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-3">
                  {tournament.name}
                  <FollowersCountBadge
                    targetType="tournament"
                    targetId={tournamentId}
                    initialCount={followers}
                    formatCompact={true}
                    className="text-sm font-normal text-blue-600 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-300 px-2.5 py-0.5 rounded-full flex items-center gap-1"
                  />
                </h1>
                <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    🌍 {tournament.country ?? "International"}
                  </span>
                  <span>•</span>
                  <button className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 transition-colors font-medium">
                    {tournament.edition ?? "26/27"} Season <ChevronDown className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FollowButton
                targetType="tournament"
                targetId={tournamentId}
                initialIsFollowing={tournament.isFollowing ?? data.isFollowing}
                initialFollowersCount={followers}
                size="lg"
              />
            </div>
          </div>

          {/* Timeline Bar */}
          <div className="mt-8 flex items-center gap-3">
            <span className="text-xs font-semibold text-muted-foreground w-12 text-right shrink-0">
              7 Jul
            </span>
            <div className="h-2 flex-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden relative">
              <div className="absolute left-0 top-0 h-full w-1/3 bg-slate-900 dark:bg-slate-100 rounded-full"></div>
            </div>
            <span className="text-xs font-semibold text-muted-foreground w-12 shrink-0">
              5 Jun
            </span>
          </div>
        </div>
      </header>

      {/* ── Main Interactive Content Layout ── */}
      <main className="mx-auto max-w-5xl px-4 py-8">
        <TournamentInteractiveContent
          tournament={tournament}
          matches={matches}
          standings={standings}
        />
      </main>
    </div>
  )
}
