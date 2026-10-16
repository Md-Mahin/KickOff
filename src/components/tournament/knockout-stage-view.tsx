"use client"

import { useState } from "react"
import Link from "next/link"
import { Trophy, ChevronRight, Calendar, ArrowRight, ShieldAlert } from "lucide-react"
import type { TeamMatch } from "@/lib/matches"
import { Button } from "@/components/ui/button"
import { SafeImage } from "@/components/ui/safe-image"

export type KnockoutStageCode = "ALL" | "GF" | "SF" | "QF" | "RO16" | "RO32"

interface StageMeta {
  code: string
  label: string
  fullTitle: string
  badgeClass: string
  icon: string
  order: number
}

const STAGE_META: Record<string, StageMeta> = {
  GF: {
    code: "GF",
    label: "Final",
    fullTitle: "Grand Final",
    badgeClass: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700",
    icon: "🏆",
    order: 1,
  },
  SF: {
    code: "SF",
    label: "Semi-Finals",
    fullTitle: "Semi-Finals",
    badgeClass: "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-700",
    icon: "⚔️",
    order: 2,
  },
  QF: {
    code: "QF",
    label: "Quarter-Finals",
    fullTitle: "Quarter-Finals",
    badgeClass: "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-700",
    icon: "🛡️",
    order: 3,
  },
  RO16: {
    code: "RO16",
    label: "Round of 16",
    fullTitle: "Round of 16",
    badgeClass: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700",
    icon: "⚡",
    order: 4,
  },
  RO32: {
    code: "RO32",
    label: "Round of 32",
    fullTitle: "Round of 32",
    badgeClass: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
    icon: "🎯",
    order: 5,
  },
}

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

interface KnockoutStageViewProps {
  matches: TeamMatch[]
  tournamentName?: string
}

export default function KnockoutStageView({ matches, tournamentName }: KnockoutStageViewProps) {
  const [selectedStage, setSelectedStage] = useState<KnockoutStageCode>("ALL")

  // Filter only knockout matches
  const knockoutMatches = matches.filter((m) => m.round_status === "knockout")

  // Counts per stage
  const stageCounts: Record<string, number> = {
    GF: knockoutMatches.filter((m) => m.round_position === "GF").length,
    SF: knockoutMatches.filter((m) => m.round_position === "SF").length,
    QF: knockoutMatches.filter((m) => m.round_position === "QF").length,
    RO16: knockoutMatches.filter((m) => m.round_position === "RO16").length,
    RO32: knockoutMatches.filter((m) => m.round_position === "RO32").length,
  }

  // Filter matches based on selected stage button
  const displayedMatches =
    selectedStage === "ALL"
      ? knockoutMatches
      : knockoutMatches.filter((m) => m.round_position === selectedStage)

  // Stages available or present
  const stageKeys: (keyof typeof STAGE_META)[] = ["GF", "SF", "QF", "RO16", "RO32"]

  // If no knockout matches at all
  if (knockoutMatches.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 mb-4">
          <Trophy className="h-7 w-7 text-amber-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
          Knockout Stage Information
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
          There are currently no knockout stage matches registered for {tournamentName || "this tournament"}. 
          Knockout fixtures will automatically appear here once scheduled.
        </p>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-muted-foreground font-medium">
          <ShieldAlert className="h-3.5 w-3.5" />
          Supports RO32, RO16, Quarter-Finals, Semi-Finals, and Final
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Knockout Stage Filter Buttons ── */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSelectedStage("ALL")}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm ${
            selectedStage === "ALL"
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          }`}
        >
          All Knockout
          <span
            className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
              selectedStage === "ALL"
                ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900"
                : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
            }`}
          >
            {knockoutMatches.length}
          </span>
        </button>

        {stageKeys.map((stageKey) => {
          const meta = STAGE_META[stageKey]
          const count = stageCounts[stageKey] || 0
          const isSelected = selectedStage === stageKey

          return (
            <button
              key={stageKey}
              onClick={() => setSelectedStage(stageKey as KnockoutStageCode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all shadow-sm border ${
                isSelected
                  ? "bg-blue-600 text-white border-blue-600 shadow-blue-100"
                  : "bg-card text-foreground border-border hover:bg-muted/70 hover:border-slate-300"
              }`}
            >
              <span>{meta.icon}</span>
              <span>{meta.label}</span>
              {count > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isSelected
                      ? "bg-white/25 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Knockout Matches Display ── */}
      {selectedStage === "ALL" ? (
        // Hierarchical Stages view (GF -> SF -> QF -> RO16 -> RO32)
        <div className="space-y-6">
          {stageKeys.map((stageKey) => {
            const stageMatches = knockoutMatches.filter(
              (m) => m.round_position === stageKey
            )
            if (stageMatches.length === 0) return null

            const meta = STAGE_META[stageKey]

            return (
              <div
                key={stageKey}
                className="rounded-xl border border-border bg-card shadow-sm overflow-hidden"
              >
                {/* Stage Header */}
                <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50/80 dark:bg-slate-900/50 border-b border-border">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{meta.icon}</span>
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm md:text-base">
                      {meta.fullTitle}
                    </h4>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${meta.badgeClass}`}
                    >
                      {stageKey}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">
                    {stageMatches.length} {stageMatches.length === 1 ? "Match" : "Matches"}
                  </span>
                </div>

                {/* Match Cards in this Stage */}
                <div className="divide-y divide-border">
                  {stageMatches.map((match) => (
                    <KnockoutMatchItem key={match.id} match={match} meta={meta} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        // Single Selected Stage view
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50/80 dark:bg-slate-900/50 border-b border-border">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">{STAGE_META[selectedStage]?.icon}</span>
              <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm md:text-base">
                {STAGE_META[selectedStage]?.fullTitle}
              </h4>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  STAGE_META[selectedStage]?.badgeClass
                }`}
              >
                {selectedStage}
              </span>
            </div>
            <span className="text-xs text-muted-foreground font-medium">
              {displayedMatches.length}{" "}
              {displayedMatches.length === 1 ? "Match" : "Matches"}
            </span>
          </div>

          {displayedMatches.length > 0 ? (
            <div className="divide-y divide-border">
              {displayedMatches.map((match) => (
                <KnockoutMatchItem
                  key={match.id}
                  match={match}
                  meta={STAGE_META[match.round_position || ""] || STAGE_META[selectedStage]}
                />
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No matches found for {STAGE_META[selectedStage]?.fullTitle}.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function KnockoutMatchItem({ match, meta }: { match: TeamMatch; meta?: StageMeta }) {
  const isFT = match.status === "FT"
  const isLive = match.status === "LIVE"
  const homeWon = isFT && match.homeGoals > match.awayGoals
  const awayWon = isFT && match.awayGoals > match.homeGoals

  return (
    <div className="p-4 hover:bg-muted/30 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Date, Stage & Status Header */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0 sm:w-44">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span>{formatDate(match.date)}</span>
          <span>•</span>
          <span>{formatTime(match.date)}</span>
          {isLive ? (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600 animate-pulse ml-1">
              LIVE
            </span>
          ) : isFT ? (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 ml-1">
              FT
            </span>
          ) : (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 ml-1">
              UPCOMING
            </span>
          )}
        </div>

        {/* Match Lineup / Scores */}
        <div className="flex-1 max-w-lg">
          <div className="flex items-center justify-between py-1 px-2 rounded-md hover:bg-muted/50">
            <div className="flex items-center gap-2.5 min-w-0">
              <SafeImage src={match.homeTeam.logo} alt={match.homeTeam.name} width={24} height={24} className="h-6 w-6 rounded-full object-contain shrink-0" />
              <span
                className={`truncate text-sm ${
                  homeWon
                    ? "font-bold text-slate-900 dark:text-slate-100"
                    : "text-slate-700 dark:text-slate-300"
                }`}
              >
                {match.homeTeam.name}
              </span>
              {homeWon && (
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded">
                  ADVANCED
                </span>
              )}
            </div>
            <span
              className={`text-sm tabular-nums font-bold ml-4 ${
                homeWon ? "text-slate-900 dark:text-slate-100" : "text-muted-foreground"
              }`}
            >
              {isFT ? match.homeGoals : "-"}
            </span>
          </div>

          <div className="flex items-center justify-between py-1 px-2 rounded-md hover:bg-muted/50">
            <div className="flex items-center gap-2.5 min-w-0">
              <SafeImage src={match.awayTeam.logo} alt={match.awayTeam.name} width={24} height={24} className="h-6 w-6 rounded-full object-contain shrink-0" />
              <span
                className={`truncate text-sm ${
                  awayWon
                    ? "font-bold text-slate-900 dark:text-slate-100"
                    : "text-slate-700 dark:text-slate-300"
                }`}
              >
                {match.awayTeam.name}
              </span>
              {awayWon && (
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded">
                  ADVANCED
                </span>
              )}
            </div>
            <span
              className={`text-sm tabular-nums font-bold ml-4 ${
                awayWon ? "text-slate-900 dark:text-slate-100" : "text-muted-foreground"
              }`}
            >
              {isFT ? match.awayGoals : "-"}
            </span>
          </div>
        </div>

        {/* View Details Button */}
        <div className="shrink-0 flex items-center justify-end sm:justify-center">
          <Link href={`/match/${match.id}`}>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs font-semibold gap-1 hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              Details <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

