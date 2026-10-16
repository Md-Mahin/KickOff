"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { Match, LeagueGroup } from "@/lib/matches"
import { SafeImage } from "@/components/ui/safe-image"
import { LocalMatchTime } from "@/components/matches/local-match-time"

function MatchStatus({ match }: { match: Match }) {
  if (match.status === "LIVE") {
    return (
      <Badge className="border-red-500/20 bg-red-500/10 text-red-500">
        {match.minute ? `LIVE ${match.minute}` : "LIVE"}
      </Badge>
    )
  }
  if (match.status === "FT") return <Badge variant="secondary">FT</Badge>
  return <Badge variant="outline">Upcoming</Badge>
}

function MatchRow({ match }: { match: Match }) {
  return (
    <div className="flex items-center justify-between px-4 py-4">
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {match.homeLogo ? (
              <SafeImage src={match.homeLogo} alt={match.homeTeam} width={24} height={24} className="h-6 w-6 object-contain" />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                {match.homeTeam.substring(0, 2).toUpperCase()}
              </div>
            )}
            <span className="text-sm font-medium">
              {match.homeTeamId ? (
                <Link href={`/team/${match.homeTeamId}`} onClick={(e) => e.stopPropagation()} className="hover:underline hover:text-blue-600 transition-colors">
                  {match.homeTeam}
                </Link>
              ) : match.homeTeam}
            </span>
          </div>
          <span className="text-sm font-semibold">{match.status === "UPCOMING" ? "-" : match.homeScore}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {match.awayLogo ? (
              <SafeImage src={match.awayLogo} alt={match.awayTeam} width={24} height={24} className="h-6 w-6 object-contain" />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                {match.awayTeam.substring(0, 2).toUpperCase()}
              </div>
            )}
            <span className="text-sm font-medium">
              {match.awayTeamId ? (
                <Link href={`/team/${match.awayTeamId}`} onClick={(e) => e.stopPropagation()} className="hover:underline hover:text-blue-600 transition-colors">
                  {match.awayTeam}
                </Link>
              ) : match.awayTeam}
            </span>
          </div>
          <span className="text-sm font-semibold">{match.status === "UPCOMING" ? "-" : match.awayScore}</span>
        </div>
      </div>
      <div className="ml-4 flex w-20 flex-col items-end gap-2">
        <MatchStatus match={match} />
        {match.startTime && (
          <span className="text-xs text-muted-foreground">
            <LocalMatchTime startTime={match.startTime} />
          </span>
        )}
      </div>
    </div>
  )
}

type Filter = "all" | "live" | "finished" | "upcoming"

export function MatchList({ leagues }: { leagues: LeagueGroup[] }) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>("all")

  // Apply filter across all leagues
  const filteredLeagues = leagues
    .map((group) => ({
      ...group,
      matches: group.matches.filter((m) => {
        if (filter === "all") return true
        if (filter === "live") return m.status === "LIVE"
        if (filter === "finished") return m.status === "FT"
        if (filter === "upcoming") return m.status === "UPCOMING"
        return true
      }),
    }))
    .filter((g) => g.matches.length > 0)

  // Count per status for badge labels
  const allMatches = leagues.flatMap((g) => g.matches)
  const liveCount = allMatches.filter((m) => m.status === "LIVE").length
  const ftCount = allMatches.filter((m) => m.status === "FT").length
  const upcomingCount = allMatches.filter((m) => m.status === "UPCOMING").length

  const matchesByDate = new Map<string, LeagueGroup[]>()
  for (const league of filteredLeagues) {
    for (const match of league.matches) {
      const dateKey = match.startTime
        ? new Date(match.startTime).toISOString().slice(0, 10)
        : "undated"
      const dateLeagues = matchesByDate.get(dateKey) ?? []
      let dateLeague = dateLeagues.find((item) => item.leagueId === league.leagueId)
      if (!dateLeague) {
        dateLeague = { ...league, matches: [] }
        dateLeagues.push(dateLeague)
        matchesByDate.set(dateKey, dateLeagues)
      }
      dateLeague.matches.push(match)
    }
  }
  const todayKey = new Date().toISOString().slice(0, 10)
  const dateGroups = [...matchesByDate.entries()].sort(([left], [right]) => {
    if (left === "undated") return 1
    if (right === "undated") return -1
    const leftDelta = Math.round((Date.parse(`${left}T00:00:00Z`) - Date.parse(`${todayKey}T00:00:00Z`)) / 86_400_000)
    const rightDelta = Math.round((Date.parse(`${right}T00:00:00Z`) - Date.parse(`${todayKey}T00:00:00Z`)) / 86_400_000)
    const position = (delta: number) => delta === 0 ? 0 : delta > 0 ? delta : 100 + Math.abs(delta)
    return position(leftDelta) - position(rightDelta)
  })

  function dateHeading(dateKey: string) {
    if (dateKey === "undated") return "Date unavailable"
    if (dateKey === todayKey) return "Today"
    return new Intl.DateTimeFormat("en", {
      weekday: "long", month: "long", day: "numeric", timeZone: "UTC",
    }).format(new Date(`${dateKey}T12:00:00Z`))
  }

  function FilterBtn({ value, label, count }: { value: Filter; label: string; count?: number }) {
    const active = filter === value
    return (
      <Button
        size="sm"
        variant={active ? "secondary" : "ghost"}
        onClick={() => setFilter(value)}
        className={active ? "font-semibold" : ""}
      >
        {label}
        {count !== undefined && count > 0 && (
          <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
            active
              ? "bg-foreground/10"
              : value === "live"
                ? "bg-red-500/10 text-red-500"
                : "bg-muted text-muted-foreground"
          }`}>
            {count}
          </span>
        )}
      </Button>
    )
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-1">
        <FilterBtn value="all" label="All" count={allMatches.length} />
        <FilterBtn value="live" label="Live" count={liveCount} />
        <FilterBtn value="finished" label="Finished" count={ftCount} />
        <FilterBtn value="upcoming" label="Upcoming" count={upcomingCount} />
      </div>

      {/* Match groups */}
      <div className="space-y-8">
        {filteredLeagues.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {filter === "live"
                ? "No live matches right now."
                : filter === "finished"
                  ? "No finished matches in this date range."
                  : filter === "upcoming"
                    ? "No upcoming matches in this date range."
                    : "No matches found."}
            </p>
          </div>
        ) : (
          dateGroups.map(([dateKey, leaguesForDate]) => (
            <section key={dateKey}>
              <h2 className="mb-4 text-lg font-semibold">{dateHeading(dateKey)}</h2>
              <div className="space-y-6">
                {leaguesForDate.map((leagueGroup) => (
                  <section key={`${dateKey}:${leagueGroup.league}:${leagueGroup.country}`}>
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <Link href={`/tournament/${leagueGroup.leagueId}`} className="hover:underline">
                          <h3 className="text-sm font-semibold text-slate-900">{leagueGroup.league}</h3>
                        </Link>
                        <p className="text-xs text-muted-foreground">{leagueGroup.country}</p>
                      </div>
                    </div>
                    <Card>
                      <CardContent className="p-0">
                        {leagueGroup.matches.map((match, index) => (
                          <div key={match.id}>
                            <div
                              onClick={() => router.push(`/match/${match.id}`)}
                              className="block transition hover:bg-muted/50 cursor-pointer"
                            >
                              <MatchRow match={match} />
                            </div>
                            {index < leagueGroup.matches.length - 1 ? <Separator /> : null}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </section>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  )
}

