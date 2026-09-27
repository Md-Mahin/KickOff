"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  getPlayerRankings,
  getPositionBreakdown,
  getRatingDistribution,
  recalculatePlayerRatings,
} from "@/lib/api"
import type {
  PlayerRankingItem,
  PositionBreakdownResponse,
  RatingDistributionResponse,
  RatingTier,
} from "@/lib/matches"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

/* ═══════════════════════════════════════════════════════════════════════════
   SVG DONUT / PIE CHART COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

interface DonutChartProps {
  tiers: RatingTier[]
  total: number
  avgRating: number
  selectedTier: string | null
  onSelectTier: (id: string | null) => void
}

function DonutChart({
  tiers,
  total,
  avgRating,
  selectedTier,
  onSelectTier,
}: DonutChartProps) {
  const [hoveredTier, setHoveredTier] = useState<string | null>(null)

  const radius = 80
  const strokeWidth = 28
  const center = 100
  const circumference = 2 * Math.PI * radius

  // Compute SVG stroke-dasharray and stroke-dashoffset for each slice
  const slices = useMemo(() => {
    let accumulatedAngle = -90 // Start from 12 o'clock

    return tiers.map((tier) => {
      const percentage = tier.percentage || 0
      const strokeLength = (percentage / 100) * circumference
      const rotation = accumulatedAngle
      accumulatedAngle += (percentage / 100) * 360

      return {
        ...tier,
        strokeLength,
        rotation,
      }
    })
  }, [tiers, circumference])

  const active = hoveredTier || selectedTier
  const activeTier = tiers.find((t) => t.id === active)

  return (
    <div className="flex flex-col items-center">
      <div className="relative flex items-center justify-center">
        <svg
          width="200"
          height="200"
          viewBox="0 0 200 200"
          className="transform transition-transform duration-300"
        >
          {/* Background Track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />

          {/* Slices */}
          {slices.map((slice) => {
            const isHovered = active === slice.id
            return (
              <circle
                key={slice.id}
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke={slice.color}
                strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={`${slice.strokeLength} ${circumference}`}
                transform={`rotate(${slice.rotation} ${center} ${center})`}
                className="cursor-pointer transition-all duration-300"
                style={{
                  filter: isHovered ? "drop-shadow(0 4px 6px rgba(0,0,0,0.15))" : undefined,
                  opacity: active && !isHovered ? 0.6 : 1,
                }}
                onMouseEnter={() => setHoveredTier(slice.id)}
                onMouseLeave={() => setHoveredTier(null)}
                onClick={() => onSelectTier(selectedTier === slice.id ? null : slice.id)}
              />
            )
          })}
        </svg>

        {/* Center Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
          {activeTier ? (
            <>
              <span className="text-xl font-extrabold text-slate-900">
                {activeTier.percentage}%
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                {activeTier.count} players
              </span>
            </>
          ) : (
            <>
              <span className="text-2xl font-black tracking-tight text-slate-900">
                {avgRating.toFixed(2)}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Avg Rating
              </span>
            </>
          )}
        </div>
      </div>

      {/* Legend & Percentages */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full text-xs">
        {tiers.map((tier) => {
          const isSelected = selectedTier === tier.id
          const isHovered = hoveredTier === tier.id
          return (
            <button
              key={tier.id}
              type="button"
              onClick={() => onSelectTier(isSelected ? null : tier.id)}
              onMouseEnter={() => setHoveredTier(tier.id)}
              onMouseLeave={() => setHoveredTier(null)}
              className={`flex items-center justify-between p-2 rounded-lg border text-left transition-all ${
                isSelected
                  ? "border-slate-800 bg-slate-100 font-semibold"
                  : isHovered
                  ? "border-slate-300 bg-slate-50"
                  : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: tier.color }}
                />
                <span className="truncate text-slate-700">{tier.name}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                <span className="font-bold text-slate-900">{tier.percentage}%</span>
                <span className="text-[10px] text-muted-foreground">({tier.count})</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN ADMIN PERFORMANCE DASHBOARD COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export function AdminPerformanceDashboard() {
  const [distribution, setDistribution] = useState<RatingDistributionResponse | null>(null)
  const [breakdown, setBreakdown] = useState<PositionBreakdownResponse | null>(null)
  const [rankings, setRankings] = useState<PlayerRankingItem[]>([])
  const [totalRankings, setTotalRankings] = useState(0)

  // Filters & State
  const [selectedPosition, setSelectedPosition] = useState<string>("ALL")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [sortBy, setSortBy] = useState<string>("rating")
  const [selectedTier, setSelectedTier] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [recalculating, setRecalculating] = useState(false)
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null)

  // Load Initial Data
  const loadDashboardData = async () => {
    try {
      setLoading(true)
      const [distData, breakdownData, rankData] = await Promise.all([
        getRatingDistribution(),
        getPositionBreakdown(),
        getPlayerRankings({
          position: selectedPosition,
          search: searchQuery,
          sortBy,
          limit: 30,
        }),
      ])

      setDistribution(distData)
      setBreakdown(breakdownData)
      setRankings(rankData.rankings)
      setTotalRankings(rankData.total)
    } catch (err) {
      console.error("Failed to load dashboard data:", err)
      setNotification({
        type: "error",
        message: (err as Error).message || "Failed to load dashboard data.",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [])

  // Filter rankings when position or sort changes
  useEffect(() => {
    getPlayerRankings({
      position: selectedPosition,
      search: searchQuery,
      sortBy,
      limit: 30,
    })
      .then((res) => {
        setRankings(res.rankings)
        setTotalRankings(res.total)
      })
      .catch((err) => console.error(err))
  }, [selectedPosition, searchQuery, sortBy])

  // Recalculate Ratings Handler
  const handleRecalculate = async () => {
    try {
      setRecalculating(true)
      setNotification(null)
      const result = await recalculatePlayerRatings()
      setNotification({
        type: "success",
        message: `Successfully recalculated ratings for ${result.updatedCount} players via PL/SQL procedure (${result.durationMs}ms)!`,
      })
      await loadDashboardData()
    } catch (err) {
      setNotification({
        type: "error",
        message: "Failed to recalculate player ratings: " + (err as Error).message,
      })
    } finally {
      setRecalculating(false)
    }
  }

  // Filter by selected tier
  const filteredRankings = useMemo(() => {
    if (!selectedTier) return rankings

    return rankings.filter((r) => {
      if (selectedTier === "elite") return r.rating >= 8.5
      if (selectedTier === "outstanding") return r.rating >= 7.5 && r.rating < 8.5
      if (selectedTier === "good") return r.rating >= 6.5 && r.rating < 7.5
      if (selectedTier === "average") return r.rating >= 5.5 && r.rating < 6.5
      if (selectedTier === "developing") return r.rating < 5.5
      return true
    })
  }, [rankings, selectedTier])

  // Helper for Rating Badges
  const getRatingBadgeClass = (rating: number) => {
    if (rating >= 8.5) return "bg-emerald-100 text-emerald-800 border-emerald-300"
    if (rating >= 7.5) return "bg-blue-100 text-blue-800 border-blue-300"
    if (rating >= 6.5) return "bg-violet-100 text-violet-800 border-violet-300"
    if (rating >= 5.5) return "bg-amber-100 text-amber-800 border-amber-300"
    return "bg-rose-100 text-rose-800 border-rose-300"
  }

  const getPositionLabel = (pos: string) => {
    const p = (pos || "").toUpperCase()
    if (p.startsWith("F")) return "FWD"
    if (p.startsWith("M")) return "MID"
    if (p.startsWith("D")) return "DEF"
    if (p.startsWith("G")) return "GK"
    return pos
  }

  return (
    <div className="space-y-6">
      {/* ── Top Action & Notification Banner ── */}
      {notification && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl text-sm font-medium border ${
            notification.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          <span>{notification.message}</span>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-xs underline hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Header Summary Row ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              Player Performance Rating Engine
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-300 max-w-2xl">
            PL/SQL-powered normalized scoring methodology evaluating goals, playmaking, defensive metrics,
            discipline, and volume confidence on a calibrated 0–10 scale.
          </p>
        </div>

        <Button
          type="button"
          onClick={handleRecalculate}
          disabled={recalculating}
          className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-5 py-2.5 rounded-xl shrink-0 shadow-md transition-all active:scale-95"
        >
          {recalculating ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Recalculating...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <span>⚡</span> Recalculate Ratings
            </span>
          )}
        </Button>
      </div>

      {/* ── KPI & Chart Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Interactive Donut Chart */}
        <Card className="shadow-sm border-slate-200 lg:col-span-1">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold">Rating Distribution</CardTitle>
              {selectedTier && (
                <button
                  type="button"
                  onClick={() => setSelectedTier(null)}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  Clear filter
                </button>
              )}
            </div>
            <CardDescription className="text-xs">
              Categorized player percentages across performance tiers
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {distribution ? (
              <DonutChart
                tiers={distribution.tiers}
                total={distribution.totalPlayers}
                avgRating={distribution.averageRating}
                selectedTier={selectedTier}
                onSelectTier={setSelectedTier}
              />
            ) : (
              <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">
                Loading chart...
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Key Metrics & Top Star Highlight */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                Total Rated Players
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-slate-900">
                {distribution?.totalPlayers ?? 0}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Active players with match appearances in database
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                Cohort Highest Rating
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-extrabold text-emerald-600">
                    {distribution?.highestRating ? distribution.highestRating.toFixed(2) : "—"}
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-700 truncate">
                    {distribution?.topPlayer?.name ?? "Top Performer"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {distribution?.topPlayer?.team} • {distribution?.topPlayer?.position}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-xl">
                  🏆
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Position Averages Card */}
          <Card className="shadow-sm border-slate-200 sm:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                Position Rating Averages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                {breakdown?.positionAverages.map((p) => (
                  <div key={p.position} className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase">
                      {p.position === "F"
                        ? "Forwards"
                        : p.position === "M"
                        ? "Midfielders"
                        : p.position === "D"
                        ? "Defenders"
                        : "Goalkeepers"}
                    </span>
                    <div className="text-xl font-extrabold text-slate-900 mt-1">
                      {Number(p.avgrating).toFixed(2)}
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      Max: {Number(p.maxrating).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Position Leaders (Top 5 per Position) ── */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
          <span>🌟</span> Position Category Leaders
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Forwards */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-3 border-b bg-amber-50/50">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span>⚡</span> Top Forwards
                </span>
                <Badge variant="outline" className="text-[10px] bg-white">Goals: 40%</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2">
              {breakdown?.forwards.map((p, idx) => (
                <div
                  key={p.playerId}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-slate-400 w-4">#{idx + 1}</span>
                    <div className="min-w-0">
                      <Link
                        href={`/player/${p.playerId}`}
                        className="font-semibold text-slate-900 truncate hover:text-blue-600 block"
                      >
                        {p.name}
                      </Link>
                      <span className="text-[10px] text-muted-foreground truncate block">
                        {p.team} • {p.goals}G, {p.assists}A
                      </span>
                    </div>
                  </div>
                  <Badge className={`font-mono font-bold text-xs ${getRatingBadgeClass(p.rating)}`}>
                    {p.rating.toFixed(2)}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Midfielders */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-3 border-b bg-blue-50/50">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span>🎯</span> Top Midfielders
                </span>
                <Badge variant="outline" className="text-[10px] bg-white">Playmaking: 40%</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2">
              {breakdown?.midfielders.map((p, idx) => (
                <div
                  key={p.playerId}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-slate-400 w-4">#{idx + 1}</span>
                    <div className="min-w-0">
                      <Link
                        href={`/player/${p.playerId}`}
                        className="font-semibold text-slate-900 truncate hover:text-blue-600 block"
                      >
                        {p.name}
                      </Link>
                      <span className="text-[10px] text-muted-foreground truncate block">
                        {p.team} • {p.tackles}T, {p.assists}A
                      </span>
                    </div>
                  </div>
                  <Badge className={`font-mono font-bold text-xs ${getRatingBadgeClass(p.rating)}`}>
                    {p.rating.toFixed(2)}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Defenders */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-3 border-b bg-emerald-50/50">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span>🛡️</span> Top Defenders
                </span>
                <Badge variant="outline" className="text-[10px] bg-white">Defensive: 60%</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2">
              {breakdown?.defenders.map((p, idx) => (
                <div
                  key={p.playerId}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-slate-400 w-4">#{idx + 1}</span>
                    <div className="min-w-0">
                      <Link
                        href={`/player/${p.playerId}`}
                        className="font-semibold text-slate-900 truncate hover:text-blue-600 block"
                      >
                        {p.name}
                      </Link>
                      <span className="text-[10px] text-muted-foreground truncate block">
                        {p.team} • {p.tackles}T, {p.cleanSheets}CS
                      </span>
                    </div>
                  </div>
                  <Badge className={`font-mono font-bold text-xs ${getRatingBadgeClass(p.rating)}`}>
                    {p.rating.toFixed(2)}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Goalkeepers */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-3 border-b bg-purple-50/50">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span>🧤</span> Top Goalkeepers
                </span>
                <Badge variant="outline" className="text-[10px] bg-white">Shot Stop: 60%</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2">
              {breakdown?.goalkeepers.map((p, idx) => (
                <div
                  key={p.playerId}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-slate-400 w-4">#{idx + 1}</span>
                    <div className="min-w-0">
                      <Link
                        href={`/player/${p.playerId}`}
                        className="font-semibold text-slate-900 truncate hover:text-blue-600 block"
                      >
                        {p.name}
                      </Link>
                      <span className="text-[10px] text-muted-foreground truncate block">
                        {p.team} • {p.saves} Saves
                      </span>
                    </div>
                  </div>
                  <Badge className={`font-mono font-bold text-xs ${getRatingBadgeClass(p.rating)}`}>
                    {p.rating.toFixed(2)}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Player Performance Rankings Table ── */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-bold">Overall Player Performance Rankings</CardTitle>
              <CardDescription className="text-xs">
                Ordered by official calculated rating with aggregate match statistics
              </CardDescription>
            </div>

            {/* Position filter tabs */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              {[
                { id: "ALL", label: "All Positions" },
                { id: "F", label: "Forwards" },
                { id: "M", label: "Midfielders" },
                { id: "D", label: "Defenders" },
                { id: "G", label: "Goalkeepers" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedPosition(tab.id)}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    selectedPosition === tab.id
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search & Sort Controls */}
          <div className="mt-4 flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                placeholder="Search player or team..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-slate-800"
              />
              <span className="absolute left-2.5 top-2.5 text-xs text-muted-foreground">🔍</span>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto ml-auto text-xs">
              <span className="text-muted-foreground font-medium">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium focus:outline-none"
              >
                <option value="rating">Performance Rating</option>
                <option value="goals">Goals</option>
                <option value="assists">Assists</option>
                <option value="tackles">Tackles</option>
                <option value="saves">Saves</option>
                <option value="minutes">Minutes Played</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b bg-slate-50/80 text-muted-foreground font-semibold">
                  <th className="py-3 px-4 w-12">Rank</th>
                  <th className="py-3 px-4">Player</th>
                  <th className="py-3 px-3">Pos</th>
                  <th className="py-3 px-3">Team</th>
                  <th className="py-3 px-3 text-center">Matches</th>
                  <th className="py-3 px-3 text-center">Mins</th>
                  <th className="py-3 px-3 text-center">Goals</th>
                  <th className="py-3 px-3 text-center">Assists</th>
                  <th className="py-3 px-3 text-center">Tackles</th>
                  <th className="py-3 px-3 text-center">Saves</th>
                  <th className="py-3 px-4 text-right">Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRankings.length > 0 ? (
                  filteredRankings.map((player) => (
                    <tr key={player.playerId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-500">
                        #{player.rank}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5 min-w-[140px]">
                          {player.photo ? (
                            <div className="relative h-7 w-7 rounded-full overflow-hidden border border-slate-200 shrink-0">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={player.photo}
                                alt={player.name}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="h-7 w-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                              {player.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <Link
                            href={`/player/${player.playerId}`}
                            className="font-bold text-slate-900 hover:text-blue-600 hover:underline transition-colors truncate"
                          >
                            {player.name}
                          </Link>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                          {getPositionLabel(player.position)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-medium truncate max-w-[120px]">
                        {player.team}
                      </td>
                      <td className="py-3 px-3 text-center text-slate-700 font-medium">
                        {player.matchesPlayed}
                      </td>
                      <td className="py-3 px-3 text-center text-slate-700 font-mono">
                        {player.totalMinutes}'
                      </td>
                      <td className="py-3 px-3 text-center font-semibold text-slate-900">
                        {player.goals}
                      </td>
                      <td className="py-3 px-3 text-center font-semibold text-slate-900">
                        {player.assists}
                      </td>
                      <td className="py-3 px-3 text-center font-semibold text-slate-700">
                        {player.tackles}
                      </td>
                      <td className="py-3 px-3 text-center font-semibold text-slate-700">
                        {player.saves}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Badge
                          className={`font-mono font-bold text-xs px-2.5 py-0.5 border ${getRatingBadgeClass(
                            player.rating
                          )}`}
                        >
                          {player.rating.toFixed(2)}
                        </Badge>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-muted-foreground">
                      No players found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Scoring Methodology & Academic Justification Card ── */}
      <Card className="border-slate-200 bg-slate-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-1.5">
            <span>ℹ️</span> Scoring Methodology & Academic Design Documentation
          </CardTitle>
          <CardDescription className="text-xs">
            How the PL/SQL scoring algorithm calculates the 0–10 performance rating
          </CardDescription>
        </CardHeader>
        <CardContent className="text-xs text-slate-600 space-y-3 leading-relaxed">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="font-semibold text-slate-900">1. Cohort Normalization (NULLIF Safe)</p>
              <p>
                Raw statistical totals vary drastically across disciplines (e.g. 500 passes vs. 4 goals).
                Each positive metric is normalized against the maximum observed within that position cohort:
                <code className="block bg-white p-1.5 rounded border my-1 text-[11px] font-mono text-slate-800">
                  NormalizedStat = Stat / NULLIF(MaxCohortStat, 0)
                </code>
                This bounds each metric to [0.0, 1.0] and prevents pass counts from overwhelming goal impacts.
              </p>
            </div>

            <div className="space-y-2">
              <p className="font-semibold text-slate-900">2. Playing-Time Volume Confidence Factor</p>
              <p>
                To prevent substitutes with 10 minutes from receiving artificially inflated scores (e.g. 1 goal in 10 mins yielding an absurd per-90 rate), a volume confidence weight is applied:
                <code className="block bg-white p-1.5 rounded border my-1 text-[11px] font-mono text-slate-800">
                  Confidence = LEAST(1.0, TotalMinutes / 270.0)
                </code>
                Ratings for players below 3 full matches (270 mins) smoothly regress toward the neutral baseline (5.50). Players with 0 minutes are marked unrated (NULL).
              </p>
            </div>

            <div className="space-y-2">
              <p className="font-semibold text-slate-900">3. Negative Events & Discipline Deductions</p>
              <p>
                Disciplinary infractions result in direct composite reductions:
                <code className="block bg-white p-1.5 rounded border my-1 text-[11px] font-mono text-slate-800">
                  CardPenalty = (YellowCards * 0.15) + (RedCards * 0.85)
                </code>
                For goalkeepers, goal concession is evaluated inversely via concession resistance and save percentage:
                <code className="block bg-white p-1.5 rounded border my-1 text-[11px] font-mono text-slate-800">
                  SavePct = Saves / NULLIF(Saves + GoalsConceded, 0)
                </code>
              </p>
            </div>

            <div className="space-y-2">
              <p className="font-semibold text-slate-900">4. Position-Specific Allocation Weights</p>
              <ul className="list-disc pl-4 space-y-1">
                <li><strong className="text-slate-900">Forward:</strong> Goals 40%, Assists 20%, Shots On Target 10%, Key Passes 10%, Passes 10%, Minutes 10%.</li>
                <li><strong className="text-slate-900">Midfielder:</strong> Goals 20%, Assists 20%, Key Passes 20%, Passes 15%, Tackles 15%, Minutes 10%.</li>
                <li><strong className="text-slate-900">Defender:</strong> Tackles 20%, Interceptions 20%, Clearances 20%, Clean Sheets 20%, Passes 10%, Minutes 10%.</li>
                <li><strong className="text-slate-900">Goalkeeper:</strong> Saves 30%, Clean Sheets 30%, Save % 20%, Concession Resistance 10%, Minutes 10%.</li>
              </ul>
            </div>
          </div>

          <p className="pt-2 border-t text-[11px] text-slate-500 italic">
            * Disclaimer: This rating represents a structured Performance Rating calculated according to the application's statistical scoring methodology and does not represent an absolute or subjective claim of the "best player."
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
