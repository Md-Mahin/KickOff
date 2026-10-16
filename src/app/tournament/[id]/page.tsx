import { notFound } from "next/navigation"
import { ChevronDown } from "lucide-react"

import FollowButton, { FollowersCountBadge } from "@/components/ui/follow-button"
import { getTournamentProfile } from "@/lib/api"
import TournamentInteractiveContent from "@/components/tournament/tournament-interactive-content"
import { SafeImage } from "@/components/ui/safe-image"

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

  const data = await getTournamentProfile(tournamentId)
  if (!data) notFound()

  const { tournament, followers, matches, standings } = data

  return (
    <div className="min-h-screen text-foreground">
      {/* ── Hero Banner Section Blob ── */}
      <header className="mx-auto max-w-5xl px-4 pt-8">
        <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="relative h-24 w-24 overflow-hidden rounded-lg border border-border bg-white shadow-sm flex items-center justify-center p-2">
                <SafeImage src={tournament.logo} alt={tournament.name} width={96} height={96} fallbackKind="tournament" className="h-full w-full object-contain" />
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
