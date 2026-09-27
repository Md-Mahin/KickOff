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

function playerPosition(player: MatchLineupPlayer, index: number, players: MatchLineupPlayer[], side: "home" | "away") {
  const position = player.position?.toUpperCase() ?? ""
  const row = position.startsWith("G") ? 1 : position.startsWith("D") ? 2 : position.startsWith("M") ? 3 : 4
  const rowPlayers = players.filter((candidate) => {
    const candidatePosition = candidate.position?.toUpperCase() ?? ""
    const candidateRow = candidatePosition.startsWith("G")
      ? 1
      : candidatePosition.startsWith("D")
        ? 2
        : candidatePosition.startsWith("M")
          ? 3
          : 4
    return candidateRow === row
  })
  const rowIndex = Math.max(rowPlayers.indexOf(player), 0)
  
  // Left to right positioning (X axis)
  const left = 10 + ((rowIndex + 1) / (rowPlayers.length + 1)) * 80;

  // Top to bottom positioning (Y axis)
  const depth = row === 1 ? 8 : row === 2 ? 22 : row === 3 ? 36 : 46;
  const top = side === "home" ? 100 - depth : depth;

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
    <div className="absolute z-10 -translate-x-1/2 -translate-y-1/2 text-center" style={position}>
      <div className="relative mx-auto h-9 w-9 overflow-hidden rounded-full border-2 border-white bg-slate-200 shadow-md sm:h-10 sm:w-10">
        {player.photo ? (
          <Image src={player.photo} alt={player.name} fill sizes="40px" className="object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center text-[10px] font-bold text-slate-700">
            {player.name.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>
      <div className="mt-1 flex max-w-[60px] sm:max-w-[70px] flex-col items-center justify-center">
        <div className="truncate w-full rounded bg-black/75 px-1 py-[1px] text-[9px] font-semibold text-white sm:text-[10px]">
          {player.id ? <Link href={`/player/${player.id}`} className="hover:underline">{player.name}</Link> : player.name}
        </div>
      </div>
      {(player.rating || player.goals > 0 || player.yellowCards > 0 || player.redCards > 0) && (
        <div className="mt-0.5 flex items-center justify-center gap-0.5 text-[9px] font-bold text-white">
          {player.rating && <span className={`rounded px-1 ${Number(player.rating) >= 7 ? "bg-emerald-500" : "bg-orange-500"}`}>{Number(player.rating).toFixed(1)}</span>}
          {player.goals > 0 && <span>⚽ {player.goals}</span>}
          {player.yellowCards > 0 && <span className="rounded-sm bg-yellow-300 px-1 text-[8px] text-slate-900">🟨</span>}
          {player.redCards > 0 && <span className="rounded-sm bg-red-500 px-1 text-[8px] text-white">🟥</span>}
        </div>
      )}
      {substitution && (
        <span className={`absolute -right-3 -top-1 rounded-full p-[2px] text-[8px] font-bold text-white shadow-sm ${substitution.direction === "in" ? "bg-emerald-600" : "bg-red-600"}`}>
          {substitution.direction === "in" ? "⬆" : "⬇"}
        </span>
      )}
    </div>
  )
}

function Bench({ lineup, events, side }: { lineup: MatchLineup; events: MatchEvent[]; side: "home" | "away" }) {
  const substitutions = substitutionMap(events)
  const hasInjured = lineup.unavailable && lineup.unavailable.length > 0;

  return (
    <div className="space-y-4">
      <div className={`flex items-center gap-3 ${side === "away" ? "lg:flex-row-reverse lg:text-right" : ""}`}>
        {lineup.coach?.photo ? (
          <Image src={lineup.coach.photo} alt={lineup.coach.name ?? "Coach"} width={40} height={40} className="h-10 w-10 rounded-full border object-cover shadow-sm" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full border bg-slate-100 text-xs font-bold text-slate-500 shadow-sm">
            {lineup.coach?.name ? lineup.coach.name.slice(0, 2).toUpperCase() : "M"}
          </div>
        )}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Manager</p>
          <p className="text-sm font-semibold">{lineup.coach?.name ?? "Not available"}</p>
        </div>
      </div>
      
      <div>
        <div className="mt-2 text-xs font-semibold uppercase text-muted-foreground border-b pb-1 mb-2">Substitutes</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {lineup.substitutes.map((player, index) => {
            const substitution = substitutions.get(player.id)
            return (
              <div key={`${lineup.team.id || lineup.team.name || "team"}-substitute-${player.id || player.name || "player"}-${index}`} className="flex items-center gap-2 rounded-md border bg-card px-2 py-2">
                <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted border border-slate-200">
                  {player.photo ? <Image src={player.photo} alt={player.name} fill sizes="32px" className="object-cover" /> : <span className="flex h-full items-center justify-center text-[10px] font-bold">{player.name.slice(0, 2).toUpperCase()}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">
                    {player.id ? <Link href={`/player/${player.id}`} className="hover:underline hover:text-blue-600 transition-colors">{player.name}</Link> : player.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{player.position ?? "Substitute"}{player.rating ? ` ⭐ ${Number(player.rating).toFixed(1)}` : ""}</p>
                </div>
                {substitution && (
                  <div className="text-right">
                    <span className={`text-[10px] font-bold ${substitution.direction === "in" ? "text-emerald-600" : "text-red-600"}`}>{substitution.direction === "in" ? "⬆ IN" : "⬇ OUT"}</span>
                    {substitution.minute && <span className="ml-1 text-[10px] font-medium text-muted-foreground">{substitution.minute}'</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {hasInjured && (
        <div>
          <div className="mt-2 text-xs font-semibold uppercase text-muted-foreground border-b pb-1 mb-2">Unavailable / Injured</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {lineup.unavailable!.map((player, index) => (
              <div key={`${lineup.team.id || lineup.team.name || "team"}-unavailable-${player.id || player.name || "player"}-${index}`} className="flex items-center gap-2 rounded-md border bg-red-50/50 px-2 py-2 opacity-80">
                <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted border border-red-200 grayscale">
                  {player.photo ? <Image src={player.photo} alt={player.name} fill sizes="32px" className="object-cover" /> : <span className="flex h-full items-center justify-center text-[10px] font-bold">{player.name.slice(0, 2).toUpperCase()}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-700">
                    {player.id ? <Link href={`/player/${player.id}`} className="hover:underline hover:text-blue-600 transition-colors">{player.name}</Link> : player.name}
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
  const hasSubstitutions = events.some((e) => e.eventtype === "Substitution")

  return (
    <Card className="mt-6 shadow-sm border-slate-200">
      <CardContent className="p-4 sm:p-6">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-semibold text-lg">Lineups</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {hasSubstitutes
                ? "Starting XI, tactical formations, coaches, and bench"
                : "Starting XI, tactical formations"}
            </p>
          </div>
          {hasSubstitutions && (
            <div className="hidden text-[10px] text-muted-foreground sm:block">⬆ entered ⬇ substituted</div>
          )}
        </div>
        
        {/* Team Headers */}
        <div className="mb-4 grid grid-cols-2 gap-4 border-b pb-3 text-sm font-semibold">
          {lineups.slice(0, 2).map((lineup, index) => (
            <div key={`team-label-${lineup.team.id || lineup.team.name || index}`} className={`flex items-center gap-2 ${index === 1 ? "justify-end text-right" : ""}`}>
              {index === 0 && lineup.team.logo && <Image src={lineup.team.logo} alt="" width={24} height={24} className="h-6 w-6 object-contain" />}
              <div className="flex flex-col">
                <span>{lineup.team.name}</span>
                <span className={`text-[10px] text-muted-foreground ${index === 1 ? "text-right" : ""}`}>{lineup.formation ?? ""}</span>
              </div>
              {index === 1 && lineup.team.logo && <Image src={lineup.team.logo} alt="" width={24} height={24} className="h-6 w-6 object-contain" />}
            </div>
          ))}
        </div>

        {/* Pitch */}
        <div className="mx-auto w-full max-w-[420px] pb-1">
          <div className="relative aspect-[1/1.4] w-full overflow-hidden rounded-lg border-2 border-[#057750] bg-[#079b68] shadow-inner">
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 10%, rgba(255,255,255,0.1) 10%, rgba(255,255,255,0.1) 20%)" }}></div>
            
            {/* Center line */}
            <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent_49.8%,rgba(255,255,255,.6)_50%,transparent_50.2%)]" />
            
            {/* Center circle */}
            <div className="absolute left-1/2 top-1/2 h-[20%] aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/60" />
            <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/60" />
            
            {/* Away Penalty Area (Top) */}
            <div className="absolute left-1/4 top-0 h-[14%] w-1/2 border-2 border-t-0 border-white/60" />
            <div className="absolute left-[38%] top-0 h-[5%] w-[24%] border-2 border-t-0 border-white/60" />
            {/* Away Penalty Arc */}
            <div className="absolute left-1/2 top-[14%] h-[10%] aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/60" style={{ clipPath: 'polygon(0 50%, 100% 50%, 100% 100%, 0 100%)' }} />
            <div className="absolute left-1/2 top-[11%] h-1 w-1 -translate-x-1/2 rounded-full bg-white/60" />

            {/* Home Penalty Area (Bottom) */}
            <div className="absolute bottom-0 left-1/4 h-[14%] w-1/2 border-2 border-b-0 border-white/60" />
            <div className="absolute bottom-0 left-[38%] h-[5%] w-[24%] border-2 border-b-0 border-white/60" />
            {/* Home Penalty Arc */}
            <div className="absolute bottom-[14%] left-1/2 h-[10%] aspect-square -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white/60" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 50%, 0 50%)' }} />
            <div className="absolute left-1/2 bottom-[11%] h-1 w-1 -translate-x-1/2 rounded-full bg-white/60" />

            {/* Corners */}
            <div className="absolute top-0 left-0 h-4 w-4 rounded-br-full border-2 border-l-0 border-t-0 border-white/60" />
            <div className="absolute top-0 right-0 h-4 w-4 rounded-bl-full border-2 border-r-0 border-t-0 border-white/60" />
            <div className="absolute bottom-0 left-0 h-4 w-4 rounded-tr-full border-2 border-l-0 border-b-0 border-white/60" />
            <div className="absolute bottom-0 right-0 h-4 w-4 rounded-tl-full border-2 border-r-0 border-b-0 border-white/60" />

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

        {hasSubstitutes && (
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
