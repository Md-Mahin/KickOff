"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown, Trophy, Shield, Calendar, BarChart3, Info } from "lucide-react"
import type { TeamMatch, TournamentStandingRow, TournamentInfo } from "@/lib/matches"
import { Button } from "@/components/ui/button"
import KnockoutStageView from "./knockout-stage-view"

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
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
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white ${colors[result]}`}
    >
      {result}
    </span>
  )
}

function FeaturedMatchCard({ match }: { match: TeamMatch }) {
  const homeLogo =
    match.homeTeam.logo ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(match.homeTeam.name)}&background=eee&color=333&size=48`
  const awayLogo =
    match.awayTeam.logo ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(match.awayTeam.name)}&background=eee&color=333&size=48`

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Featured Match
          </span>
          {match.round_status === "knockout" && match.round_position && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              {match.round_position}
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {formatDate(match.date)} • {formatTime(match.date)}
        </span>
      </div>
      <div className="flex items-center justify-center gap-6">
        <div className="flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={homeLogo}
            alt={match.homeTeam.name}
            className="h-16 w-16 object-cover rounded-full"
          />
          <Link
            href={`/team/${match.homeTeam.id}`}
            className="text-sm font-semibold hover:underline text-center"
          >
            {match.homeTeam.name}
          </Link>
        </div>
        <div className="text-2xl font-black text-muted-foreground">VS</div>
        <div className="flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={awayLogo}
            alt={match.awayTeam.name}
            className="h-16 w-16 object-cover rounded-full"
          />
          <Link
            href={`/team/${match.awayTeam.id}`}
            className="text-sm font-semibold hover:underline text-center"
          >
            {match.awayTeam.name}
          </Link>
        </div>
      </div>
      <div className="mt-4 text-center">
        <Link href={`/match/${match.id}`}>
          <Button variant="secondary" size="sm" className="w-full">
            Match Details
          </Button>
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
          <span
            className={`text-[10px] font-bold ${
              match.status === "LIVE" ? "text-red-500 font-semibold" : "text-muted-foreground"
            }`}
          >
            {match.status}
          </span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center text-sm">
          <span className="flex-1 truncate text-center font-medium group-hover:text-primary transition-colors">
            {match.homeTeam.name}
          </span>
          <span className="w-6 shrink-0 text-right font-bold tabular-nums">
            {match.status === "FT" ? match.homeGoals : "-"}
          </span>
        </div>
        <div className="flex items-center text-sm mt-1">
          <span className="flex-1 truncate text-center font-medium group-hover:text-primary transition-colors">
            {match.awayTeam.name}
          </span>
          <span className="w-6 shrink-0 text-right font-bold tabular-nums">
            {match.status === "FT" ? match.awayGoals : "-"}
          </span>
        </div>
      </div>
      {match.round_status === "knockout" && match.round_position && (
        <div className="shrink-0">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {match.round_position}
          </span>
        </div>
      )}
      <div className="shrink-0 text-muted-foreground group-hover:text-foreground transition-colors">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </div>
    </Link>
  )
}

interface TournamentInteractiveContentProps {
  tournament: TournamentInfo
  matches: TeamMatch[]
  standings: TournamentStandingRow[]
}

export default function TournamentInteractiveContent({
  tournament,
  matches,
  standings,
}: TournamentInteractiveContentProps) {
  // Main tabs: Standings | Knockout | Stats | Details
  const [activeTab, setActiveTab] = useState<"standings" | "knockout" | "stats" | "details">(
    "standings"
  )

  // Standings filters
  const [standingFilter, setStandingFilter] = useState<"all" | "home" | "away">("all")

  // Left column matches filter
  const [matchViewMode, setMatchViewMode] = useState<"date" | "round">("date")
  const [selectedRoundFilter, setSelectedRoundFilter] = useState<string>("ALL")
  const [isRoundDropdownOpen, setIsRoundDropdownOpen] = useState(false)

  const featuredMatch = matches.find((m) => m.status === "UPCOMING") || matches[0]

  // Count knockout matches
  const knockoutCount = matches.filter((m) => m.round_status === "knockout").length

  // Filter left column matches
  const filteredMatches = matches.filter((m) => {
    if (matchViewMode === "date") return true
    if (selectedRoundFilter === "ALL") return true
    if (selectedRoundFilter === "league") return m.round_status === "league"
    return m.round_status === "knockout" && m.round_position === selectedRoundFilter
  })

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* ── Left Column (Widgets) ── */}
      <div className="md:col-span-1 space-y-6">
        {featuredMatch && <FeaturedMatchCard match={featuredMatch} />}

        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 dark:text-slate-100">Matches</h3>
              <span className="text-xs text-muted-foreground font-medium">
                {matches.length} Total
              </span>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <Button
                variant={matchViewMode === "date" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setMatchViewMode("date")}
                className="h-7 text-xs flex-1 rounded-full"
              >
                By date
              </Button>
              <Button
                variant={matchViewMode === "round" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setMatchViewMode("round")}
                className="h-7 text-xs flex-1 rounded-full"
              >
                By round
              </Button>
            </div>

            {/* Round Filter Selector */}
            {matchViewMode === "round" && (
              <div className="relative mb-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsRoundDropdownOpen(!isRoundDropdownOpen)}
                  className="w-full justify-between h-8 text-xs font-normal"
                >
                  <span>
                    {selectedRoundFilter === "ALL"
                      ? "All Rounds"
                      : selectedRoundFilter === "league"
                      ? "League Matches"
                      : `Knockout: ${selectedRoundFilter}`}
                  </span>
                  <ChevronDown className="h-3 w-3" />
                </Button>

                {isRoundDropdownOpen && (
                  <div className="absolute top-9 left-0 right-0 z-20 bg-popover border border-border rounded-lg shadow-lg py-1 text-xs">
                    <button
                      onClick={() => {
                        setSelectedRoundFilter("ALL")
                        setIsRoundDropdownOpen(false)
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-muted font-medium"
                    >
                      All Rounds
                    </button>
                    <button
                      onClick={() => {
                        setSelectedRoundFilter("league")
                        setIsRoundDropdownOpen(false)
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-muted"
                    >
                      League Stage
                    </button>
                    <div className="border-t border-border my-1" />
                    <div className="px-3 py-1 text-[10px] font-bold text-muted-foreground uppercase">
                      Knockout Stages
                    </div>
                    {["GF", "SF", "QF", "RO16", "RO32"].map((st) => (
                      <button
                        key={st}
                        onClick={() => {
                          setSelectedRoundFilter(st)
                          setIsRoundDropdownOpen(false)
                        }}
                        className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center justify-between"
                      >
                        <span>
                          {st === "GF"
                            ? "Grand Final (GF)"
                            : st === "SF"
                            ? "Semi-Finals (SF)"
                            : st === "QF"
                            ? "Quarter-Finals (QF)"
                            : st === "RO16"
                            ? "Round of 16 (RO16)"
                            : "Round of 32 (RO32)"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col">
            {filteredMatches.length > 0 ? (
              filteredMatches.slice(0, 7).map((match) => <MatchRow key={match.id} match={match} />)
            ) : (
              <div className="p-6 text-center text-xs text-muted-foreground">
                No matches found for the selected round filter.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Right Column (Standings & Knockout Stages) ── */}
      <div className="md:col-span-2 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100/80 dark:bg-[#2e0c46] mb-6 overflow-x-auto">
          {/* Standings Button */}
          <button
            onClick={() => setActiveTab("standings")}
            className={`px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap transition-all flex items-center gap-2 ${
              activeTab === "standings"
                ? "bg-white text-slate-900 shadow-xs dark:bg-[#621298] dark:text-white dark:shadow-[0_2px_10px_rgba(98,18,152,0.35)]"
                : "text-muted-foreground hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/50 dark:hover:bg-white/5"
            }`}
          >
            <span>Standings</span>
          </button>

          {/* Knockout Stage Button */}
          <button
            onClick={() => setActiveTab("knockout")}
            className={`px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap transition-all flex items-center gap-2 ${
              activeTab === "knockout"
                ? "bg-white text-blue-600 shadow-xs dark:bg-[#621298] dark:text-white dark:shadow-[0_2px_10px_rgba(98,18,152,0.35)]"
                : "text-muted-foreground hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/50 dark:hover:bg-white/5"
            }`}
          >
            <Trophy className="h-4 w-4" />
            <span>Knockout Stage</span>
            {knockoutCount > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === "knockout"
                    ? "bg-blue-100 text-blue-700 dark:bg-white/20 dark:text-white"
                    : "bg-slate-200 dark:bg-[#2e0d45] text-slate-700 dark:text-slate-300"
                }`}
              >
                {knockoutCount}
              </span>
            )}
          </button>

          {/* Stats Button */}
          <button
            onClick={() => setActiveTab("stats")}
            className={`px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === "stats"
                ? "bg-white text-slate-900 shadow-xs dark:bg-[#621298] dark:text-white dark:shadow-[0_2px_10px_rgba(98,18,152,0.35)]"
                : "text-muted-foreground hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/50 dark:hover:bg-white/5"
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span>Stats</span>
          </button>

          {/* Details Button */}
          <button
            onClick={() => setActiveTab("details")}
            className={`px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === "details"
                ? "bg-white text-slate-900 shadow-xs dark:bg-[#621298] dark:text-white dark:shadow-[0_2px_10px_rgba(98,18,152,0.35)]"
                : "text-muted-foreground hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/50 dark:hover:bg-white/5"
            }`}
          >
            <Info className="h-4 w-4" />
            <span>Details</span>
          </button>
        </div>

        {/* ── Tab Content: Knockout Stage ── */}
        {activeTab === "knockout" && (
          <KnockoutStageView matches={matches} tournamentName={tournament.name} />
        )}

        {/* ── Tab Content: Standings ── */}
        {activeTab === "standings" && (
          <div className="space-y-6">
            {/* Filter Pills */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStandingFilter("all")}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm ${
                  standingFilter === "all"
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStandingFilter("home")}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  standingFilter === "home"
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                Home
              </button>
              <button
                onClick={() => setStandingFilter("away")}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  standingFilter === "away"
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                Away
              </button>
            </div>

            {/* Standings Table */}
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden overflow-x-auto">
              {standings.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-slate-50/80 dark:bg-slate-900/50 text-left text-xs font-semibold text-muted-foreground">
                      <th className="px-4 py-3 font-medium w-8 text-center">#</th>
                      <th className="px-2 py-3 font-medium">Team</th>
                      <th className="px-2 py-3 font-medium text-center w-8">P</th>
                      <th className="px-2 py-3 font-medium text-center w-8">W</th>
                      <th className="px-2 py-3 font-medium text-center w-8">D</th>
                      <th className="px-2 py-3 font-medium text-center w-8">L</th>
                      <th className="px-2 py-3 font-medium text-center w-10">GLS</th>
                      <th className="px-2 py-3 font-medium text-center w-10">DIFF</th>
                      <th className="px-2 py-3 font-medium text-center hidden sm:table-cell">
                        Last 5
                      </th>
                      <th className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100 text-center w-10">
                        PTS
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {standings.map((row, idx) => (
                      <tr
                        key={row.teamId}
                        className="group hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors relative"
                      >
                        <td className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">
                          {row.rank ?? idx + 1}
                        </td>
                        <td className="px-2 py-3">
                          <Link
                            href={`/team/${row.teamId}`}
                            className="flex items-center gap-3 hover:underline"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={
                                row.teamLogo ??
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                  row.teamName
                                )}&background=eee&color=333&size=24`
                              }
                              alt={row.teamName}
                              className="h-6 w-6 object-cover rounded-full"
                            />
                            <span className="font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                              {row.teamName}
                            </span>
                          </Link>
                        </td>
                        <td className="px-2 py-3 text-center">{row.played}</td>
                        <td className="px-2 py-3 text-center">{row.wins}</td>
                        <td className="px-2 py-3 text-center">{row.draws}</td>
                        <td className="px-2 py-3 text-center">{row.losses}</td>
                        <td className="px-2 py-3 text-center">
                          {row.goalsFor}:{row.goalsAgainst}
                        </td>
                        <td className="px-2 py-3 text-center font-medium">
                          {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                        </td>
                        <td className="px-2 py-3 text-center hidden sm:table-cell">
                          <div className="flex items-center justify-center gap-1">
                            {row.last5.map((res, i) => (
                              <ResultBadge key={i} result={res} />
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-slate-900 dark:text-slate-100">
                          {row.points}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No standings data available for this tournament.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab Content: Stats ── */}
        {activeTab === "stats" && (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <BarChart3 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-1">
              Tournament Statistics
            </h4>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Total goals, top scorers, clean sheets, and disciplinary stats will be available as
              the tournament advances.
            </p>
          </div>
        )}

        {/* ── Tab Content: Details ── */}
        {activeTab === "details" && (
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h4 className="font-bold text-slate-900 dark:text-slate-100 text-base">
              Tournament Overview
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                <span className="text-xs text-muted-foreground block">Name</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {tournament.name}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                <span className="text-xs text-muted-foreground block">Edition / Season</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {tournament.edition || "Current"}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                <span className="text-xs text-muted-foreground block">Type</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {tournament.type || "Club Tournament"}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                <span className="text-xs text-muted-foreground block">Region</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {tournament.country || "International"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

