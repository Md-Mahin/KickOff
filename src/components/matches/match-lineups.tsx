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
  const left = 7 + ((row - 1) / 3) * 37
  const top = row === 1
    ? 50
    : 12 + ((rowIndex + 1) / (rowPlayers.length + 1)) * 76

  return {
    left: `${side === "home" ? left : 100 - left}%`,
    top: `${Math.min(Math.max(top, 8), 92)}%`,
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
      {player.position && <span className="mb-0.5 block text-[8px] font-bold text-white/90">{player.position}</span>}
      <div className="relative mx-auto h-10 w-10 overflow-hidden rounded-full border-2 border-white bg-slate-200 shadow-md sm:h-11 sm:w-11">
        {player.photo ? (
          <Image src={player.photo} alt={player.name} fill sizes="36px" className="object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center text-[11px] font-bold text-slate-700">
            {player.name.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>
      <div className="mt-0.5 max-w-24 truncate rounded bg-black/70 px-1 text-[9px] font-semibold text-white sm:text-[10px]">
        {player.id ? <Link href={`/player/${player.id}`} className="hover:underline">{player.name}</Link> : player.name}
      </div>
      <div className="mt-0.5 flex items-center justify-center gap-0.5 text-[9px] font-bold text-white">
        {player.rating && <span className={`rounded px-1 ${Number(player.rating) >= 7 ? "bg-emerald-500" : "bg-orange-500"}`}>{Number(player.rating).toFixed(1)}</span>}
        {player.goals > 0 && <span>⚽ {player.goals}</span>}
        {player.yellowCards > 0 && <span className="rounded-sm bg-yellow-300 px-1 text-[8px] text-slate-900">■</span>}
        {player.redCards > 0 && <span className="rounded-sm bg-red-500 px-1 text-[8px] text-white">■</span>}
      </div>
      {substitution && (
        <span className={`absolute -right-5 top-0 rounded px-1 text-[10px] font-bold text-white ${substitution.direction === "in" ? "bg-emerald-600" : "bg-red-600"}`}>
          {substitution.direction === "in" ? "↑" : "↓"} {substitution.minute ?? ""}
        </span>
      )}
    </div>
  )
}

function Bench({ lineup, events, side }: { lineup: MatchLineup; events: MatchEvent[]; side: "home" | "away" }) {
  const substitutions = substitutionMap(events)

  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-2 ${side === "away" ? "lg:justify-end lg:text-right" : ""}`}>
        {lineup.coach.photo && <Image src={lineup.coach.photo} alt="" width={28} height={28} className="h-7 w-7 rounded-full object-cover" />}
        <div>
          <p className="text-xs text-muted-foreground">Manager</p>
          <p className="text-sm font-semibold">{lineup.coach.name ?? "Not available"}</p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {lineup.substitutes.map((player, index) => {
          const substitution = substitutions.get(player.id)
          return (
            <div key={`${lineup.team.id || lineup.team.name || "team"}-substitute-${player.id || player.name || "player"}-${index}`} className="flex items-center gap-2 rounded-md border bg-card px-2 py-2">
              <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted">
                {player.photo ? <Image src={player.photo} alt={player.name} fill sizes="32px" className="object-cover" /> : <span className="flex h-full items-center justify-center text-[10px] font-bold">{player.name.slice(0, 2).toUpperCase()}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">
                  {player.id ? <Link href={`/player/${player.id}`} className="hover:underline hover:text-blue-600 transition-colors">{player.name}</Link> : player.name}
                </p>
                <p className="text-[10px] text-muted-foreground">{player.position ?? "Substitute"}{player.rating ? ` · ${Number(player.rating).toFixed(1)}` : ""}</p>
              </div>
              {substitution && <span className={`text-xs font-bold ${substitution.direction === "in" ? "text-emerald-600" : "text-red-600"}`}>{substitution.direction === "in" ? "↑" : "↓"} {substitution.minute ?? ""}</span>}
            </div>
          )
        })}
      </div>
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
    <Card className="mt-6">
      <CardContent className="p-4 sm:p-6">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-semibold">Lineups</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {hasSubstitutes
                ? "Starters, ratings, match actions and substitutions"
                : "Starting XI, tactical formations and ratings"}
            </p>
          </div>
          {hasSubstitutions && (
            <div className="hidden text-[10px] text-muted-foreground sm:block">↑ entered · ↓ substituted</div>
          )}
        </div>
        <div className="overflow-x-auto pb-1">
          <div className="relative mx-auto aspect-[1.55/1] min-w-[680px] overflow-hidden rounded-lg border-4 border-white/70 bg-[#079b68] shadow-inner">
            <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_49.8%,rgba(255,255,255,.4)_50%,transparent_50.2%)]" />
            <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/40" />
            <div className="absolute left-0 top-1/4 h-1/2 w-[14%] border-2 border-l-0 border-white/40" />
            <div className="absolute right-0 top-1/4 h-1/2 w-[14%] border-2 border-r-0 border-white/40" />
            <div className="absolute left-0 top-[37%] h-[26%] w-[5%] border-2 border-l-0 border-white/40" />
            <div className="absolute right-0 top-[37%] h-[26%] w-[5%] border-2 border-r-0 border-white/40" />
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
        <div className="mt-3 grid grid-cols-2 gap-4 border-t pt-4 text-xs font-semibold">
          {lineups.slice(0, 2).map((lineup, index) => (
            <div key={`team-label-${lineup.team.id || lineup.team.name || index}`} className={`flex items-center gap-2 ${index === 1 ? "justify-end text-right" : ""}`}>
              {index === 0 && lineup.team.logo && <Image src={lineup.team.logo} alt="" width={22} height={22} className="h-5 w-5 object-contain" />}
              <span>{lineup.team.name}</span>
              {index === 1 && lineup.team.logo && <Image src={lineup.team.logo} alt="" width={22} height={22} className="h-5 w-5 object-contain" />}
              <span className="text-muted-foreground">{lineup.formation ?? ""}</span>
            </div>
          ))}
        </div>
        {hasSubstitutes && (
          <div className="mt-4 grid gap-5 border-t pt-5 lg:grid-cols-2">
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