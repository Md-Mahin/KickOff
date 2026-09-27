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
 * Parses formation strings like "4-3-3", "4-2-3-1", "3-5-2", "4-4-2", "5-3-2", "3-4-3", "4-1-4-1", "5-4-1", "3-4-2-1", etc.
 * Returns the outfield line counts, e.g. [4, 2, 3, 1] for "4-2-3-1".
 */
export function parseFormationLines(formationStr?: string | null): number[] {
  if (!formationStr || typeof formationStr !== "string") {
    return [4, 3, 3]
  }

  const parsed = formationStr
    .split(/[^0-9]+/)
    .map((s) => parseInt(s, 10))
    .filter((n) => !isNaN(n) && n > 0)

  const sum = parsed.reduce((a, b) => a + b, 0)
  // Formations typically specify 10 outfield players, e.g., 4-3-3 -> sum 10, 4-2-3-1 -> sum 10
  if (parsed.length >= 2 && sum >= 8 && sum <= 10) {
    return parsed
  }
  return [4, 3, 3]
}

export type FormattedPosition = {
  left: string
  top: string
}

export type LaidOutPlayer = {
  player: MatchLineupPlayer
  position: FormattedPosition
  lineIndex: number
  indexInLine: number
  totalInLine: number
}

/**
 * Calculates horizontal football pitch coordinates matching the team's tactical formation.
 * - Home team defends Left (X=7%) and attacks Right (X=44.5%)
 * - Away team defends Right (X=93%) and attacks Left (X=55.5%)
 * - Symmetrical horizontal depth across formation lines (1 GK + N outfield lines)
 * - Symmetrical vertical spacing along each line centered around 50%
 * - Enforces Rule 2: max 11 players; if red card, player is dismissed and team has 10 players
 */
export function layoutFormation(
  starters: MatchLineupPlayer[],
  formationStr: string | null | undefined,
  side: "home" | "away",
  redCardedPlayerIds: Set<number> = new Set()
): LaidOutPlayer[] {
  // 1. Max 11 starters
  const teamStarters = starters.slice(0, 11)

  // 2. Identify Goalkeeper and Outfield players
  let gk: MatchLineupPlayer | undefined
  const outfieldPlayers: MatchLineupPlayer[] = []

  for (const player of teamStarters) {
    const role = getPlayerRole(player.position)
    if (role === "G" && !gk) {
      gk = player
    } else {
      outfieldPlayers.push(player)
    }
  }

  // If no player had role 'G', take the first starter as goalkeeper
  if (!gk && teamStarters.length > 0) {
    gk = outfieldPlayers.shift()
  }

  // 3. Sort outfield players tactically (Defenders -> Midfielders -> Forwards)
  const rolePriority = (pos: string | null | undefined) => {
    const r = getPlayerRole(pos)
    if (r === "D") return 1
    if (r === "M") return 2
    if (r === "F") return 3
    return 2
  }

  outfieldPlayers.sort((a, b) => {
    const pa = rolePriority(a.position)
    const pb = rolePriority(b.position)
    if (pa !== pb) return pa - pb
    return 0 // preserve stable order / jersey
  })

  // 4. Parse formation lines (e.g. "4-2-3-1" -> [4, 2, 3, 1])
  const outfieldCounts = parseFormationLines(formationStr)

  // 5. Partition starters into tactical lines:
  // Line 0: [GK]
  // Line 1: [D, D, D, D]
  // Line 2: [M, M]
  // ...
  const lines: MatchLineupPlayer[][] = []
  lines.push(gk ? [gk] : [])

  let outfieldCursor = 0
  for (const count of outfieldCounts) {
    const lineSlice = outfieldPlayers.slice(outfieldCursor, outfieldCursor + count)
    outfieldCursor += count
    lines.push(lineSlice)
  }

  // If any outfield players remain, push to the last line
  if (outfieldCursor < outfieldPlayers.length) {
    lines[lines.length - 1].push(...outfieldPlayers.slice(outfieldCursor))
  }

  // 6. Apply Red Card Dismissals (Rule 2: out of match, team has 10 players)
  // Filter dismissed players from their respective lines so that line naturally reflects the missing player
  const activeLines = lines.map((line) =>
    line.filter((player) => !player.redCards && !redCardedPlayerIds.has(player.id))
  )

  // 7. Calculate Coordinates (left% and top%)
  // Depth (X): minX = 7.0% (GK), maxX = 44.5% (Strikers)
  // Height (Y): topMin = 9.0%, topMax = 91.0% (vertical pitch height = 82%)
  const totalLines = lines.length
  const minX = 7.0
  const maxX = 44.5
  const xStep = totalLines > 1 ? (maxX - minX) / (totalLines - 1) : 0

  const topMin = 9.0
  const topMax = 91.0
  const topSpan = topMax - topMin

  const laidOut: LaidOutPlayer[] = []

  for (let lineIndex = 0; lineIndex < activeLines.length; lineIndex++) {
    const line = activeLines[lineIndex]
    const totalInLine = line.length
    if (totalInLine === 0) continue

    const homeX = minX + lineIndex * xStep
    const leftPercent = side === "home" ? homeX : 100 - homeX

    for (let indexInLine = 0; indexInLine < totalInLine; indexInLine++) {
      const player = line[indexInLine]
      const topPercent = topMin + ((indexInLine + 0.5) / totalInLine) * topSpan

      laidOut.push({
        player,
        position: {
          left: `${leftPercent.toFixed(2)}%`,
          top: `${topPercent.toFixed(2)}%`,
        },
        lineIndex,
        indexInLine,
        totalInLine,
      })
    }
  }

  return laidOut
}

function PlayerMarker({
  player,
  position,
  substitution,
}: {
  player: MatchLineupPlayer
  position: FormattedPosition
  substitution?: SubstitutionInfo
}) {
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

function Bench({
  lineup,
  events,
  side,
  sentOffPlayers = [],
}: {
  lineup: MatchLineup
  events: MatchEvent[]
  side: "home" | "away"
  sentOffPlayers?: MatchLineupPlayer[]
}) {
  const substitutions = substitutionMap(events)
  const hasInjured = lineup.unavailable && lineup.unavailable.length > 0
  const hasSubstitutes = lineup.substitutes && lineup.substitutes.length > 0
  const hasSentOff = sentOffPlayers.length > 0

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

      {/* Sent Off (Red Card) */}
      {hasSentOff && (
        <div>
          <div className="mt-2 text-xs font-semibold uppercase text-red-600 border-b border-red-200 pb-1 mb-2 flex items-center gap-1.5">
            <span>🟥</span> Sent Off (Red Card)
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {sentOffPlayers.map((player, index) => (
              <div
                key={`${lineup.team.id || lineup.team.name || "team"}-sentoff-${player.id || player.name || "player"}-${index}`}
                className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50/70 px-2 py-2"
              >
                <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-red-100 border border-red-300">
                  {player.photo ? (
                    <Image src={player.photo} alt={player.name} fill sizes="32px" className="object-cover grayscale" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-[10px] font-bold text-red-700">
                      {player.number ? player.number : player.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-red-950">
                    {player.id ? (
                      <Link href={`/player/${player.id}`} className="hover:underline">
                        {player.name}
                      </Link>
                    ) : (
                      player.name
                    )}
                  </p>
                  <p className="text-[10px] text-red-600 font-medium">
                    Dismissed • Out of Match
                  </p>
                </div>
                <span className="rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs">
                  🟥 RED
                </span>
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
  const redCardedPlayerIds = new Set<number>()
  for (const e of events) {
    if (e.eventtype === "Card" && e.cardtype === "Red" && e.playerid) {
      redCardedPlayerIds.add(e.playerid)
    }
  }

  const getSentOffPlayers = (lineup: MatchLineup) =>
    (lineup.starters ?? []).filter((p) => p.redCards > 0 || redCardedPlayerIds.has(p.id))

  const hasSentOffAny = lineups.some((l) => getSentOffPlayers(l).length > 0)
  const hasBenchOrStaff = lineups.some(
    (l) => (l.substitutes?.length ?? 0) > 0 || Boolean(l.coach?.name) || (l.unavailable?.length ?? 0) > 0
  ) || hasSentOffAny

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
          {lineups.slice(0, 2).map((lineup, index) => {
            const sentOff = getSentOffPlayers(lineup)
            return (
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
                    {sentOff.length > 0 && (
                      <span className="font-bold text-red-600">
                        • 🟥 10 Players
                      </span>
                    )}
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
            )
          })}
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

            {/* ── Players Rendered Horizontally According to Formation ── */}
            {lineups.slice(0, 2).map((lineup, lineupIndex) => {
              const side = lineupIndex === 0 ? "home" : "away"
              const substitutions = substitutionMap(events)
              const laidOutPlayers = layoutFormation(
                lineup.starters ?? [],
                lineup.formation,
                side,
                redCardedPlayerIds
              )

              return laidOutPlayers.map(({ player, position }, index) => (
                <PlayerMarker
                  key={`${lineup.team.id || lineup.team.name || "team"}-starter-${player.id || player.name || "player"}-${index}`}
                  player={player}
                  position={position}
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
                sentOffPlayers={getSentOffPlayers(lineup)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
