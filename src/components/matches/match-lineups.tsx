import { Card, CardContent } from "@/components/ui/card"
import type { MatchEvent, MatchLineup, MatchLineupPlayer } from "@/lib/matches"
import Image from "next/image"
import Link from "next/link"

type SubstitutionInfo = { direction: "in" | "out"; minute: number | null }

function substitutionMap(events: MatchEvent[]) {
  const result = new Map<number, SubstitutionInfo>()

  for (const event of events) {
    if (event.eventtype !== "Substitution") continue

    if (event.playerid) {
      result.set(event.playerid, { direction: "out", minute: event.eventtime })
    }

    if (event.substitutionplayerid) {
      result.set(event.substitutionplayerid, { direction: "in", minute: event.eventtime })
    }
  }

  return result
}

function getPlayerRole(pos: string | null | undefined): "G" | "D" | "M" | "F" {
  if (!pos) return "M"
  const p = pos.toUpperCase()
  if (p.startsWith("G")) return "G"
  if (p.startsWith("D") || p.includes("BACK")) return "D"
  if (p.startsWith("M") || p.includes("MID")) return "M"
  if (p.startsWith("F") || p.startsWith("A") || p.includes("WING") || p.includes("STRIKER")) return "F"
  return "M"
}

/**
 * Calculates horizontal pitch coordinates (left% and top%)
 * - Home team defends Left (X=0) and attacks Right (X=100)
 * - Away team defends Right (X=100) and attacks Left (X=0)
 * - Generous vertical and horizontal spacing to prevent crowded icons
 */
function playerPosition(
  player: MatchLineupPlayer,
  index: number,
  players: MatchLineupPlayer[],
  side: "home" | "away"
) {
  // Infer role if not set (standard starter order: 1 GK, 4 DEF, 3 MID, 3 FWD)
  let role = getPlayerRole(player.position)
  if (!player.position) {
    if (index === 0) role = "G"
    else if (index <= 4) role = "D"
    else if (index <= 7) role = "M"
    else role = "F"
  }

  // Filter all players in the same line/role
  const rolePlayers = players.filter((candidate, cIdx) => {
    let candidateRole = getPlayerRole(candidate.position)
    if (!candidate.position) {
      if (cIdx === 0) candidateRole = "G"
      else if (cIdx <= 4) candidateRole = "D"
      else if (cIdx <= 7) candidateRole = "M"
      else candidateRole = "F"
    }
    return candidateRole === role
  })

  const rowIndex = Math.max(rolePlayers.indexOf(player), 0)
  const countInRole = Math.max(rolePlayers.length, 1)

  // Y-axis: Symmetrical vertical distribution across pitch width (8% to 92%)
  // Spreads flank players out to wings (18.5% and 81.5% for 4-man line) with 100px+ between centers
  const top = 8 + ((rowIndex + 0.5) / countInRole) * 84

  // X-axis: Horizontal depth along length of pitch
  // Home team on Left (7% -> 44%), Away team on Right (93% -> 56%)
  const homeDepth =
    role === "G"
      ? 7.0
      : role === "D"
      ? 20.0
      : role === "M"
      ? 33.0
      : 44.0

  const left = side === "home" ? homeDepth : 100 - homeDepth

  return {
    left: `${left}%`,
    top: `${top}%`,
  }
}

function PlayerMarker({
  player,
  players,
  index,
  side,
  substitution,
}: {
  player: MatchLineupPlayer
  players: MatchLineupPlayer[]
  index: number
  side: "home" | "away"
  substitution?: SubstitutionInfo
}) {
  const position = playerPosition(player, index, players, side)

  return (
    <div
      className="absolute z-10 -translate-x-1/2 -translate-y-1/2 text-center group cursor-pointer transition-transform hover:z-20"
      style={position}
    >
      {/* Player Circular Avatar / Photo */}
      <div className="relative mx-auto h-9 w-9 sm:h-10 sm:w-10 rounded-full border-2 border-white bg-slate-100 shadow-md group-hover:scale-110 transition-transform overflow-hidden">
        {player.photo ? (
          <Image
            src={player.photo}
            alt={player.name}
            fill
            sizes="40px"
            className="object-cover"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-[10px] font-bold text-slate-700">
            {player.number ? player.number : player.name.slice(0, 2).toUpperCase()}
          </span>
        )}

        {/* Jersey Number Badge */}
        {player.number !== null && player.number !== undefined && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-900 text-[8px] font-bold text-white border border-white">
            {player.number}
          </span>
        )}
      </div>

      {/* Name Pill with Link */}
      <div className="mt-1 flex max-w-[76px] sm:max-w-[90px] flex-col items-center justify-center mx-auto">
        <div className="truncate w-full rounded bg-black/80 backdrop-blur-sm px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold text-white shadow-sm hover:bg-black transition-colors">
          {player.id ? (
            <Link href={`/player/${player.id}`} className="hover:underline">
              {player.name}
            </Link>
          ) : (
            player.name
          )}
        </div>
      </div>

      {/* Performance Badges: Rating, Goals, Cards */}
      {(player.rating || player.goals > 0 || player.yellowCards > 0 || player.redCards > 0) && (
        <div className="mt-0.5 flex items-center justify-center gap-0.5 text-[9px] font-bold text-white">
          {player.rating && (
            <span
              className={`rounded px-1 text-[8px] sm:text-[9px] shadow-sm ${
                Number(player.rating) >= 7 ? "bg-emerald-500" : "bg-orange-500"
              }`}
            >
              {Number(player.rating).toFixed(1)}
            </span>
          )}
          {player.goals > 0 && <span>⚽ {player.goals > 1 ? player.goals : ""}</span>}
          {player.yellowCards > 0 && (
            <span className="rounded-sm bg-yellow-300 px-1 text-[8px] text-slate-900 shadow-sm">
              🟨
            </span>
          )}
          {player.redCards > 0 && (
            <span className="rounded-sm bg-red-500 px-1 text-[8px] text-white shadow-sm">
              🟥
            </span>
          )}
        </div>
      )}

      {/* Substitution Badge */}
      {substitution && (
        <span
          className={`absolute -right-2 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white shadow-md ring-1 ring-white ${
            substitution.direction === "in" ? "bg-emerald-600" : "bg-red-600"
          }`}
          title={`${substitution.direction === "in" ? "Subbed In" : "Subbed Out"}${
            substitution.minute ? ` at ${substitution.minute}'` : ""
          }`}
        >
          {substitution.direction === "in" ? "⬆" : "⬇"}
        </span>
      )}
    </div>
  )
}

function Bench({ lineup, events, side }: { lineup: MatchLineup; events: MatchEvent[]; side: "home" | "away" }) {
  const substitutions = substitutionMap(events)
  const hasInjured = lineup.unavailable && lineup.unavailable.length > 0
  const hasSubstitutes = lineup.substitutes && lineup.substitutes.length > 0

  return (
    <div className="space-y-4">
      {/* Coach Info */}
      <div
        className={`flex items-center gap-3.5 p-3 rounded-xl border bg-slate-50/80 shadow-xs ${
          side === "away" ? "lg:flex-row-reverse lg:text-right" : ""
        }`}
      >
        {lineup.coach?.photo ? (
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-slate-300 bg-white shadow-xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lineup.coach.photo}
              alt={lineup.coach.name ?? "Coach"}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-xs font-bold text-slate-700 shadow-xs">
            {lineup.coach?.name ? lineup.coach.name.slice(0, 2).toUpperCase() : "👔"}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Head Coach / Manager
          </p>
          <p className="truncate text-sm font-bold text-slate-900">
            {lineup.coach?.name ?? "Head Coach"}
          </p>
        </div>
      </div>

      {/* Substitutes List */}
      <div>
        <div className="mt-2 text-xs font-semibold uppercase text-muted-foreground border-b pb-1 mb-2">
          Substitutes ({lineup.team.name})
        </div>
        {hasSubstitutes ? (
          <div className="grid gap-2 sm:grid-cols-2">
          {lineup.substitutes.map((player, index) => {
            const substitution = substitutions.get(player.id)
            return (
              <div
                key={`${lineup.team.id || lineup.team.name || "team"}-substitute-${player.id || player.name || "player"}-${index}`}
                className="flex items-center gap-2 rounded-md border bg-card px-2 py-2"
              >
                <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted border border-slate-200">
                  {player.photo ? (
                    <Image src={player.photo} alt={player.name} fill sizes="32px" className="object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-[10px] font-bold">
                      {player.number ? player.number : player.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">
                    {player.id ? (
                      <Link href={`/player/${player.id}`} className="hover:underline hover:text-blue-600 transition-colors">
                        {player.name}
                      </Link>
                    ) : (
                      player.name
                    )}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {player.position ?? "Substitute"}
                    {player.rating ? ` ⭐ ${Number(player.rating).toFixed(1)}` : ""}
                  </p>
                </div>
                {substitution && (
                  <div className="text-right">
                    <span
                      className={`text-[10px] font-bold ${
                        substitution.direction === "in" ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {substitution.direction === "in" ? "⬆ IN" : "⬇ OUT"}
                    </span>
                    {substitution.minute && (
                      <span className="ml-1 text-[10px] font-medium text-muted-foreground">
                        {substitution.minute}'
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground italic py-1">
          Bench substitutes will be listed during the match.
        </div>
      )}
    </div>

      {/* Unavailable / Injured */}
      {hasInjured && (
        <div>
          <div className="mt-2 text-xs font-semibold uppercase text-muted-foreground border-b pb-1 mb-2">
            Unavailable / Injured
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {lineup.unavailable!.map((player, index) => (
              <div
                key={`${lineup.team.id || lineup.team.name || "team"}-unavailable-${player.id || player.name || "player"}-${index}`}
                className="flex items-center gap-2 rounded-md border bg-red-50/50 px-2 py-2 opacity-80"
              >
                <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted border border-red-200 grayscale">
                  {player.photo ? (
                    <Image src={player.photo} alt={player.name} fill sizes="32px" className="object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-[10px] font-bold">
                      {player.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-700">
                    {player.id ? (
                      <Link href={`/player/${player.id}`} className="hover:underline hover:text-blue-600 transition-colors">
                        {player.name}
                      </Link>
                    ) : (
                      player.name
                    )}
                  </p>
                  <p className="text-[10px] text-red-600/80 font-semibold">{player.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function MatchLineups({ lineups, events }: { lineups: MatchLineup[]; events: MatchEvent[] }) {
  if (lineups.length === 0) {
    return (
      <Card className="mt-6 border-slate-200">
        <CardContent className="flex flex-col items-center justify-center p-8 text-center sm:p-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 mb-3">
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-slate-900">Lineups Not Announced</h3>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">
            Lineups are announced approximately 1 hour before kickoff. Check back closer to match time.
          </p>
        </CardContent>
      </Card>
    )
  }

  const hasSubstitutes = lineups.some((l) => (l.substitutes?.length ?? 0) > 0)
  const hasBenchOrStaff = lineups.some(
    (l) => (l.substitutes?.length ?? 0) > 0 || Boolean(l.coach?.name) || (l.unavailable?.length ?? 0) > 0
  )
  const hasSubstitutions = events.some((e) => e.eventtype === "Substitution")

  const homeLineup = lineups[0]
  const awayLineup = lineups[1]

  return (
    <Card className="mt-6 shadow-sm border-slate-200">
      <CardContent className="p-4 sm:p-6">
        {/* Header */}
        <div className="mb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h2 className="font-semibold text-lg">Lineups & Formations</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Starting XI on horizontal pitch, tactical formations, managers, and bench
            </p>
          </div>
          {hasSubstitutions && (
            <div className="text-[11px] text-muted-foreground flex items-center gap-2">
              <span className="inline-flex items-center gap-1 font-medium text-emerald-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> ⬆ Sub In
              </span>
              <span className="inline-flex items-center gap-1 font-medium text-red-600">
                <span className="h-2 w-2 rounded-full bg-red-500" /> ⬇ Sub Out
              </span>
            </div>
          )}
        </div>

        {/* Team Matchup Headers (Home on Left, Away on Right) */}
        <div className="mb-4 grid grid-cols-2 gap-4 border-b pb-3 text-sm font-semibold">
          {lineups.slice(0, 2).map((lineup, index) => (
            <div
              key={`team-label-${lineup.team.id || lineup.team.name || index}`}
              className={`flex items-center gap-2.5 ${index === 1 ? "justify-end text-right" : ""}`}
            >
              {index === 0 && lineup.team.logo && (
                <Image
                  src={lineup.team.logo}
                  alt=""
                  width={28}
                  height={28}
                  className="h-7 w-7 object-contain shrink-0"
                />
              )}
              <div className="flex flex-col">
                <span className="text-sm font-bold flex items-center gap-1.5">
                  {lineup.team.name}
                  <span className="text-xs font-normal text-muted-foreground hidden sm:inline">
                    ({index === 0 ? "Home • Attacking →" : "← Attacking • Away"})
                  </span>
                </span>
                <span
                  className={`text-xs font-medium text-muted-foreground flex flex-wrap items-center gap-1.5 ${
                    index === 1 ? "justify-end text-right" : ""
                  }`}
                >
                  <span>Formation: {lineup.formation ?? "4-3-3"}</span>
                  {lineup.coach?.name && (
                    <>
                      <span className="hidden sm:inline">•</span>
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                        👔 Mgr: {lineup.coach.name}
                      </span>
                    </>
                  )}
                </span>
              </div>
              {index === 1 && lineup.team.logo && (
                <Image
                  src={lineup.team.logo}
                  alt=""
                  width={28}
                  height={28}
                  className="h-7 w-7 object-contain shrink-0"
                />
              )}
            </div>
          ))}
        </div>

        {/* Horizontal Football Pitch */}
        <div className="mx-auto w-full overflow-x-auto pb-2 scrollbar-thin">
          <div className="min-w-[660px] md:min-w-0 w-full relative aspect-[1.6/1] overflow-hidden rounded-xl border-2 border-[#04593c] bg-gradient-to-r from-[#0d6e46] via-[#097b4d] to-[#0d6e46] shadow-inner select-none">
            {/* Subtle Vertical Grass Cut Stripes */}
            <div
              className="absolute inset-0 opacity-15"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.15) 5%, transparent 5%, transparent 10%)",
              }}
            />

            {/* Field Outer White Border Inset */}
            <div className="absolute inset-2 sm:inset-3 border border-white/60 rounded-sm pointer-events-none" />

            {/* Halfway Line (Vertical Line down the middle) */}
            <div className="absolute left-1/2 top-2 sm:top-3 bottom-2 sm:bottom-3 w-[2px] -translate-x-1/2 bg-white/60 pointer-events-none" />

            {/* Center Circle */}
            <div className="absolute left-1/2 top-1/2 h-[26%] aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/60 pointer-events-none" />
            <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70 pointer-events-none" />

            {/* ── Left Goal & Penalty Area (Home Team Defending) ── */}
            {/* 18-Yard Penalty Area */}
            <div className="absolute left-2 sm:left-3 top-[22%] bottom-[22%] w-[16%] border-2 border-l-0 border-white/60 pointer-events-none" />
            {/* 6-Yard Goal Area */}
            <div className="absolute left-2 sm:left-3 top-[36%] bottom-[36%] w-[6%] border-2 border-l-0 border-white/60 pointer-events-none" />
            {/* Penalty Spot */}
            <div className="absolute left-[11%] top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70 pointer-events-none" />
            {/* Penalty Arc */}
            <div
              className="absolute left-[11%] top-1/2 h-[22%] aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/60 pointer-events-none"
              style={{ clipPath: "polygon(50% 0, 100% 0, 100% 100%, 50% 100%)" }}
            />
            {/* Goal Mouth */}
            <div className="absolute left-0 top-[42%] bottom-[42%] w-2 sm:w-3 border-2 border-r-0 border-white/70 bg-white/10 pointer-events-none" />

            {/* ── Right Goal & Penalty Area (Away Team Defending) ── */}
            {/* 18-Yard Penalty Area */}
            <div className="absolute right-2 sm:right-3 top-[22%] bottom-[22%] w-[16%] border-2 border-r-0 border-white/60 pointer-events-none" />
            {/* 6-Yard Goal Area */}
            <div className="absolute right-2 sm:right-3 top-[36%] bottom-[36%] w-[6%] border-2 border-r-0 border-white/60 pointer-events-none" />
            {/* Penalty Spot */}
            <div className="absolute right-[11%] top-1/2 h-1.5 w-1.5 translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70 pointer-events-none" />
            {/* Penalty Arc */}
            <div
              className="absolute right-[11%] top-1/2 h-[22%] aspect-square translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/60 pointer-events-none"
              style={{ clipPath: "polygon(0 0, 50% 0, 50% 100%, 0 100%)" }}
            />
            {/* Goal Mouth */}
            <div className="absolute right-0 top-[42%] bottom-[42%] w-2 sm:w-3 border-2 border-l-0 border-white/70 bg-white/10 pointer-events-none" />

            {/* Corner Arcs */}
            <div className="absolute top-2 sm:top-3 left-2 sm:left-3 h-4 w-4 rounded-br-full border-r-2 border-b-2 border-white/60 pointer-events-none" />
            <div className="absolute bottom-2 sm:bottom-3 left-2 sm:left-3 h-4 w-4 rounded-tr-full border-r-2 border-t-2 border-white/60 pointer-events-none" />
            <div className="absolute top-2 sm:top-3 right-2 sm:right-3 h-4 w-4 rounded-bl-full border-l-2 border-b-2 border-white/60 pointer-events-none" />
            <div className="absolute bottom-2 sm:bottom-3 right-2 sm:right-3 h-4 w-4 rounded-tl-full border-l-2 border-t-2 border-white/60 pointer-events-none" />

            {/* Direction Badges on Field */}
            <div className="absolute top-3 left-4 hidden sm:flex items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur-sm pointer-events-none">
              <span>{homeLineup?.team.name ?? "Home"}</span>
              <span className="text-emerald-400 font-bold">→</span>
            </div>
            <div className="absolute top-3 right-4 hidden sm:flex items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur-sm pointer-events-none">
              <span className="text-emerald-400 font-bold">←</span>
              <span>{awayLineup?.team.name ?? "Away"}</span>
            </div>

            {/* ── Players Rendered Horizontally ── */}
            {lineups.slice(0, 2).map((lineup, lineupIndex) => {
              const side = lineupIndex === 0 ? "home" : "away"
              const substitutions = substitutionMap(events)
              return lineup.starters.map((player, index) => (
                <PlayerMarker
                  key={`${lineup.team.id || lineup.team.name || "team"}-starter-${player.id || player.name || "player"}-${index}`}
                  player={player}
                  players={lineup.starters}
                  index={index}
                  side={side}
                  substitution={substitutions.get(player.id)}
                />
              ))
            })}
          </div>
        </div>

        {/* Mobile Swipe Hint */}
        <div className="mt-1 text-center text-[11px] text-muted-foreground sm:hidden">
          ↔ Swipe horizontally to explore full pitch
        </div>

        {/* Bench & Staff in 2 Columns (Home on Left, Away on Right) */}
        {hasBenchOrStaff && (
          <div className="mt-8 grid gap-8 border-t pt-6 lg:grid-cols-2">
            {lineups.slice(0, 2).map((lineup, index) => (
              <Bench
                key={`${lineup.team.id || lineup.team.name || "team"}-bench-${index}`}
                lineup={lineup}
                events={events}
                side={index === 0 ? "home" : "away"}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
