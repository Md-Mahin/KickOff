"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import type { TeamMatch } from "@/lib/matches"

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

function MatchRow({ match, teamId }: { match: TeamMatch; teamId: number }) {
  const isUpcoming = match.status === "UPCOMING"

  return (
    <Link href={`/match/${match.id}`} className="flex items-center gap-3 border-b border-border px-5 py-3 hover:bg-muted/40 transition-colors last:border-b-0">
      {/* Date */}
      <div className="w-16 shrink-0 text-xs text-muted-foreground leading-tight">
        <div>{formatDate(match.date).split(" ").slice(0, 2).join(" ")}</div>
        <div>{formatTime(match.date)}</div>
      </div>

      {/* Status (omit for UPCOMING so only the column head indicates Upcoming) */}
      {!isUpcoming && (
        <div className="w-8 shrink-0 text-center">
          <span className={`text-[10px] font-bold ${match.status === "LIVE" ? "text-red-500 font-semibold" : "text-muted-foreground"}`}>
            {match.status}
          </span>
        </div>
      )}

      {/* Teams + Score */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-sm">
          <span className={`truncate ${match.homeTeam.id === teamId ? "font-semibold" : ""}`}>
            {match.homeTeam.name}
          </span>
          <span className="font-bold tabular-nums">{match.status === "FT" ? match.homeGoals : "-"}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className={`truncate ${match.awayTeam.id === teamId ? "font-semibold" : ""}`}>
            {match.awayTeam.name}
          </span>
          <span className="font-bold tabular-nums">{match.status === "FT" ? match.awayGoals : "-"}</span>
        </div>
      </div>

      {/* Result badge */}
      <div className="w-7 shrink-0 flex justify-center">
        <ResultBadge result={match.result} />
      </div>
    </Link>
  )
}

export function MatchesWidget({
  teamId,
  finishedMatches,
  upcomingMatches,
}: {
  teamId: number
  finishedMatches: TeamMatch[]
  upcomingMatches: TeamMatch[]
}) {
  const [filter, setFilter] = useState<"all" | "upcoming" | "finished">("all")

  function groupByTournament(list: TeamMatch[]) {
    const groups: Record<string, TeamMatch[]> = {}
    for (const m of list) {
      ;(groups[m.tournament] ??= []).push(m)
    }
    return groups
  }

  const showFinished = filter === "all" || filter === "finished"
  const showUpcoming = filter === "all" || filter === "upcoming"

  const finishedGroups = groupByTournament(finishedMatches)
  const upcomingGroups = groupByTournament(upcomingMatches)

  return (
    <Card>
      <CardContent className="p-0">
        {/* Header with filter buttons */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold">Matches</h2>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                filter === "all"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter("upcoming")}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                filter === "upcoming"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              Upcoming
            </button>
            <button
              type="button"
              onClick={() => setFilter("finished")}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                filter === "finished"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              Finished
            </button>
          </div>
        </div>

        {/* Finished Section */}
        {showFinished && Object.keys(finishedGroups).length > 0 && (
          <div>
            <div className="border-b border-border bg-muted/50 px-5 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Finished
            </div>
            {Object.entries(finishedGroups).map(([tournament, mList]) => (
              <div key={tournament}>
                <div className="bg-muted/30 px-5 py-1.5 text-xs font-medium text-muted-foreground">
                  ⚽ {tournament}
                </div>
                {mList.map((m) => (
                  <MatchRow key={m.id} match={m} teamId={teamId} />
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Upcoming Section */}
        {showUpcoming && Object.keys(upcomingGroups).length > 0 && (
          <div>
            <div className="border-b border-border bg-muted/50 px-5 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Upcoming
            </div>
            {Object.entries(upcomingGroups).map(([tournament, mList]) => (
              <div key={tournament}>
                <div className="bg-muted/30 px-5 py-1.5 text-xs font-medium text-muted-foreground">
                  ⚽ {tournament}
                </div>
                {mList.map((m) => (
                  <MatchRow key={m.id} match={m} teamId={teamId} />
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Empty States */}
        {filter === "all" && finishedMatches.length === 0 && upcomingMatches.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">No matches found.</div>
        )}
        {filter === "upcoming" && upcomingMatches.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">No upcoming matches.</div>
        )}
        {filter === "finished" && finishedMatches.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">No finished matches.</div>
        )}
      </CardContent>
    </Card>
  )
}

