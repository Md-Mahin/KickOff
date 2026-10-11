"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import {
  ArrowLeft,
  ArrowRightLeft,
  CalendarDays,
  ChartColumn,
  Clock3,
  Flag,
  Goal,
  History,
  Info,
  MapPin,
  Shield,
  UsersRound,
} from "lucide-react"

import { LocalMatchTime } from "@/components/matches/local-match-time"
import { layoutFormation } from "@/components/matches/match-lineups"
import type { MatchEvent, MatchLineup, MatchLineupPlayer, MatchWithLeague } from "@/lib/matches"

type MatchTab = "overview" | "timeline" | "lineups" | "statistics" | "h2h"

const TABS: { id: MatchTab; label: string; icon: typeof Goal }[] = [
  { id: "overview", label: "Overview", icon: Info },
  { id: "timeline", label: "Commentary", icon: Goal },
  { id: "lineups", label: "Lineups", icon: UsersRound },
  { id: "statistics", label: "Statistics", icon: ChartColumn },
  { id: "h2h", label: "H2H & table", icon: History },
]

function statusLabel(match: MatchWithLeague) {
  if (match.status === "LIVE") return match.minute ? `LIVE ${match.minute}` : "LIVE"
  return match.status === "FT" ? "FULL TIME" : "UPCOMING"
}

function unavailable(text = "Not available from connected providers") {
  return <span className="text-sm text-slate-400">{text}</span>
}

function TeamCrest({ src, name, size = 72 }: { src?: string | null; name: string; size?: number }) {
  return (
    <div className="relative flex h-[72px] w-[72px] shrink-0 items-center justify-center sm:h-[88px] sm:w-[88px]">
      {src ? (
        <Image src={src} alt={`${name} crest`} width={size} height={size} style={{ width: "auto", height: "auto" }} className="max-h-full max-w-full object-contain" />
      ) : (
        <div aria-label={`${name} crest unavailable`} className="flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/10 text-lg font-bold text-white/80">
          {name.slice(0, 2).toUpperCase()}
        </div>
      )}
    </div>
  )
}

function EventGlyph({ event }: { event: MatchEvent }) {
  if (event.eventtype === "Goal") return <Goal className="h-4 w-4" aria-label="Goal" />
  if (event.eventtype === "Card") {
    return <span aria-label={`${event.cardtype ?? "Match"} card`} className={`h-4 w-3 rounded-[2px] ${event.cardtype === "Red" ? "bg-red-500" : "bg-amber-400"}`} />
  }
  if (event.eventtype === "Substitution") return <ArrowRightLeft className="h-4 w-4 text-emerald-700" aria-label="Substitution" />
  if (event.eventtype === "VAR") return <span className="text-[9px] font-black tracking-normal text-blue-700">VAR</span>
  return <Flag className="h-4 w-4 text-slate-500" aria-label="Match event" />
}

function EventTitle({ event }: { event: MatchEvent }) {
  if (event.eventtype === "Goal") return <>{event.playername || event.eventdetail || "Goal"}{event.goaltype ? <span className="ml-1.5 text-xs font-normal text-slate-500">· {event.goaltype}</span> : null}</>
  if (event.eventtype === "Card") return <>{event.cardtype ?? "Match"} card{event.playername ? ` · ${event.playername}` : ""}</>
  if (event.eventtype === "Substitution") return <>{event.playername || "Player off"}{event.assistplayername ? <span className="text-slate-500"> → {event.assistplayername}</span> : null}</>
  return <>{event.eventdetail || (event.eventtype === "VAR" ? "Video review" : event.eventtype)}</>
}

function EventList({ events, homeTeam, status }: { events: MatchEvent[]; homeTeam: string; status: string }) {
  const sorted = [...events].sort((left, right) => (left.eventtime ?? 0) - (right.eventtime ?? 0))
  if (!sorted.length) {
    return <div className="rounded-lg border border-dashed border-slate-200 px-4 py-7 text-center text-sm text-slate-500">
      {status === "FT" ? "No event timeline was returned for this match." : "Match events will appear here when available."}
    </div>
  }
  return (
    <ol className="relative ml-5 border-l border-slate-200" aria-label="Match timeline">
      {sorted.map((event, index) => {
        const isHome = event.teamname.toLowerCase() === homeTeam.toLowerCase()
        const minute = event.eventtime == null ? "–" : `${event.eventtime}${event.eventextratime ? `+${event.eventextratime}` : ""}′`
        return (
          <li key={`${event.eventid}-${index}`} className="relative grid grid-cols-[48px_28px_minmax(0,1fr)] items-start gap-3 pb-5 last:pb-0">
            <span className="-ml-[25px] w-9 bg-white py-0.5 text-center text-xs font-semibold tabular-nums text-slate-500">{minute}</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-800"><EventGlyph event={event} /></span>
            <div className={`min-w-0 ${isHome ? "" : "text-right"}`}>
              <p className="text-sm font-semibold leading-5 text-slate-900"><EventTitle event={event} /></p>
              <p className="mt-0.5 truncate text-xs text-slate-500">{event.teamname || (isHome ? "Home" : "Away")}</p>
              {event.assistplayername && event.eventtype === "Goal" ? <p className="mt-0.5 text-xs text-slate-500">Assist: {event.assistplayername}</p> : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Info; label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-3 border-b border-slate-100 py-3 last:border-0">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      <span className="w-24 shrink-0 text-sm text-slate-500">{label}</span>
      <span className="min-w-0 flex-1 text-right text-sm font-medium text-slate-800">{value}</span>
    </div>
  )
}

function PlayerRow({ player, index, rating = true }: { player: MatchLineupPlayer; index: number; rating?: boolean }) {
  return (
    <li className="grid grid-cols-[30px_minmax(0,1fr)_72px_56px] items-center gap-2 border-b border-slate-100 py-2.5 last:border-0">
      <span className="text-center text-xs tabular-nums text-slate-400">{player.number ?? index + 1}</span>
      <span className="min-w-0">
        {player.id ? <Link href={`/player/${player.id}`} className="block truncate text-sm font-medium text-slate-800 hover:text-blue-700">{player.name}</Link> : <span className="block truncate text-sm font-medium text-slate-800">{player.name}</span>}
        <span className="block truncate text-xs text-slate-500">{player.position || "Position unavailable"}</span>
      </span>
      <span className="text-right text-xs text-slate-500">{player.minutes != null ? `${player.minutes}′` : ""}</span>
      <span className="text-right text-xs font-semibold tabular-nums text-slate-700">{rating && player.rating != null ? Number(player.rating).toFixed(1) : ""}</span>
    </li>
  )
}

function FormationPitch({ lineups }: { lineups: MatchLineup[] }) {
  const sides = lineups.slice(0, 2).map((lineup, index) => ({
    lineup,
    players: layoutFormation(lineup.starters ?? [], lineup.formation, index === 0 ? "home" : "away"),
  }))
  const hasPositionedPlayers = sides.some((side) => side.players.length > 0)
  if (!hasPositionedPlayers) return null
  return (
    <div className="mb-5 overflow-hidden rounded-lg border border-emerald-900/20 bg-[#1b6849] p-2 sm:p-3" aria-label="Formation diagram">
      <div className="relative aspect-[1.7/1] min-h-[230px] overflow-hidden rounded border border-white/50 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,.035)_0,rgba(255,255,255,.035)_10%,transparent_10%,transparent_20%)]">
        <div className="absolute inset-[3%] border border-white/50" />
        <div className="absolute left-1/2 top-[3%] h-[94%] border-l border-white/50" />
        <div className="absolute left-1/2 top-1/2 aspect-square h-[31%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/50" />
        <div className="absolute left-[3%] top-[25%] h-[50%] w-[14%] border border-l-0 border-white/50" />
        <div className="absolute right-[3%] top-[25%] h-[50%] w-[14%] border border-r-0 border-white/50" />
        {sides.flatMap(({ lineup, players }) => players.map(({ player, position }, index) => (
          <div key={`${lineup.team.id}-${player.id}-${index}`} className="absolute z-10 -translate-x-1/2 -translate-y-1/2 text-center" style={position}>
            <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-full border border-white bg-white text-[10px] font-bold text-emerald-950 shadow sm:h-8 sm:w-8">
              {player.number ?? player.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="mt-0.5 max-w-[80px] truncate rounded bg-black/65 px-1 py-0.5 text-[9px] text-white sm:max-w-[108px]">{player.name}</div>
          </div>
        )))}
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-2 px-1 text-xs text-white/90">
        {sides.map(({ lineup }, index) => <span key={lineup.team.id}>{lineup.team.name}{lineup.formation ? ` · ${lineup.formation}` : " · formation unavailable"}{index === 0 ? " →" : " ←"}</span>)}
      </div>
    </div>
  )
}

function LineupPanel({ lineup }: { lineup: MatchLineup }) {
  const hasLineups = lineup.starters.length > 0 || lineup.substitutes.length > 0
  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        {lineup.team.logo ? <Image src={lineup.team.logo} alt="" width={28} height={28} className="h-7 w-7 object-contain" /> : <Shield className="h-6 w-6 text-slate-400" />}
        <h3 className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">{lineup.team.name}</h3>
        <span className="text-xs text-slate-500">{lineup.formation ?? ""}</span>
      </div>
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 py-3 text-xs">
        <span className="text-slate-500">Coach</span>
        <span className="truncate font-medium text-slate-800">{lineup.coach?.name || "Not available"}</span>
      </div>
      <h4 className="mt-4 text-[11px] font-bold uppercase tracking-normal text-slate-500">Starting XI <span className="font-normal">({lineup.starters.length})</span></h4>
      {hasLineups ? <ol className="mt-1">{lineup.starters.map((player, index) => <PlayerRow key={`${player.id}-${index}`} player={player} index={index} />)}</ol>
        : <p className="py-3 text-xs text-slate-400">Starting XI unavailable from connected providers.</p>}
      <h4 className="mt-4 border-t border-slate-100 pt-4 text-[11px] font-bold uppercase tracking-normal text-slate-500">Substitutes <span className="font-normal">({lineup.substitutes.length})</span></h4>
      {lineup.substitutes.length ? <ol className="mt-1">{lineup.substitutes.map((player, index) => <PlayerRow key={`${player.id}-${index}`} player={player} index={index} rating={false} />)}</ol>
        : <p className="py-3 text-xs text-slate-400">Substitute list unavailable.</p>}
      <h4 className="mt-4 border-t border-slate-100 pt-4 text-[11px] font-bold uppercase tracking-normal text-slate-500">Unavailable</h4>
      {lineup.unavailable?.length ? <ul className="mt-2 space-y-2">{lineup.unavailable.map((player) => <li key={player.id} className="flex justify-between gap-3 text-xs"><span>{player.name}</span><span className="text-slate-500">{player.reason || player.status}</span></li>)}</ul>
        : <p className="py-2 text-xs text-slate-400">Unavailable-player information not supplied.</p>}
    </section>
  )
}

function PlayerStatistics({ match }: { match: MatchWithLeague }) {
  const stats = match.playerStatistics ?? []
  if (!stats.length) return <p className="rounded-lg border border-dashed border-slate-200 px-4 py-7 text-center text-sm text-slate-500">Player match statistics and ratings are not stored for this fixture.</p>
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500"><tr>
          <th className="px-3 py-2.5">Player</th><th className="px-2 py-2.5">Min</th><th className="px-2 py-2.5">G</th><th className="px-2 py-2.5">A</th><th className="px-2 py-2.5">Shots</th><th className="px-2 py-2.5">Passes</th><th className="px-2 py-2.5">Tackles</th><th className="px-2 py-2.5">Rating</th>
        </tr></thead>
        <tbody>{stats.map((player) => <tr key={player.playerId} className="border-t border-slate-100">
          <td className="px-3 py-2.5"><span className="font-medium text-slate-800">{player.playerName}</span><span className="ml-2 text-xs text-slate-400">{player.teamName}</span></td>
          <td className="px-2 py-2.5 tabular-nums">{player.minutes || "–"}</td><td className="px-2 py-2.5 tabular-nums">{player.goals}</td><td className="px-2 py-2.5 tabular-nums">{player.assists}</td><td className="px-2 py-2.5 tabular-nums">{player.shotsOnTarget}/{player.shots}</td><td className="px-2 py-2.5 tabular-nums">{player.passes || "–"}</td><td className="px-2 py-2.5 tabular-nums">{player.tackles || "–"}</td><td className="px-2 py-2.5 tabular-nums">{player.rating == null ? "–" : player.rating.toFixed(1)}</td>
        </tr>)}</tbody>
      </table>
    </div>
  )
}

export function MatchCentre({ match }: { match: MatchWithLeague }) {
  const [activeTab, setActiveTab] = useState<MatchTab>("overview")
  const lineups = match.lineups ?? []
  const homeLineup = lineups[0]
  const awayLineup = lineups[1]
  const kickoff = match.startTime ? <LocalMatchTime startTime={match.startTime} /> : unavailable("Kickoff time unavailable")
  const round = match.matchStage || (match.matchday ? `Matchday ${match.matchday}` : match.roundPosition || (match.roundStatus === "knockout" ? "Knockout" : match.roundStatus === "league" ? "League phase" : null))

  return (
    <main className="relative z-10 mx-auto w-full max-w-6xl bg-background px-3 pb-12 pt-5 sm:px-6 sm:pt-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950"><ArrowLeft className="h-4 w-4" />Matches</Link>
        <span className="truncate text-xs font-medium text-slate-400">Database match centre</span>
      </div>

      <header className="overflow-hidden rounded-xl bg-[#132a23] text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">
              {match.leagueId ? <Link href={`/tournament/${match.leagueId}`} className="hover:underline">{match.league}</Link> : <span>{match.league}</span>}
              {match.competitionEdition ? <span className="text-white/50">{match.competitionEdition}</span> : null}
            </div>
            <p className="mt-1 text-xs text-white/55">{[match.country, round, match.roundPosition].filter(Boolean).join(" · ") || "Match details"}</p>
          </div>
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-normal ${match.status === "LIVE" ? "bg-red-500/15 text-red-200" : "bg-white/10 text-white/80"}`}>
            {match.status === "LIVE" ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" /> : null}{statusLabel(match)}
          </span>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 px-3 py-6 sm:gap-5 sm:px-8 sm:py-8">
          <div className="flex min-w-0 flex-col items-center text-center">
            <TeamCrest src={match.homeLogo} name={match.homeTeam} />
            {match.homeTeamId ? <Link href={`/team/${match.homeTeamId}`} className="mt-2 max-w-full truncate text-sm font-bold hover:underline sm:text-base">{match.homeTeam}</Link> : <span className="mt-2 max-w-full truncate text-sm font-bold sm:text-base">{match.homeTeam}</span>}
            <span className="mt-1 text-[10px] uppercase text-white/45">Home</span>
          </div>
          <div className="min-w-[118px] px-1 text-center sm:min-w-[190px]">
            <div className="font-mono text-4xl font-bold tabular-nums tracking-normal sm:text-5xl">
              {match.status === "UPCOMING" ? <span className="text-white/50">vs</span> : <>{match.homeScore ?? "–"}<span className="mx-2 text-white/40">:</span>{match.awayScore ?? "–"}</>}
            </div>
            <div className="mt-3 flex flex-col items-center gap-1 text-xs text-white/65">
              {match.status === "UPCOMING" ? <span><CalendarDays className="mr-1 inline h-3.5 w-3.5" />{kickoff}</span> : <span>{match.status === "LIVE" ? match.minute ?? "In play" : "Finished"}</span>}
              {match.halftimeScore && match.halftimeScore.home != null && match.halftimeScore.away != null ? <span>Half-time {match.halftimeScore.home} : {match.halftimeScore.away}</span> : null}
            </div>
          </div>
          <div className="flex min-w-0 flex-col items-center text-center">
            <TeamCrest src={match.awayLogo} name={match.awayTeam} />
            {match.awayTeamId ? <Link href={`/team/${match.awayTeamId}`} className="mt-2 max-w-full truncate text-sm font-bold hover:underline sm:text-base">{match.awayTeam}</Link> : <span className="mt-2 max-w-full truncate text-sm font-bold sm:text-base">{match.awayTeam}</span>}
            <span className="mt-1 text-[10px] uppercase text-white/45">Away</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-white/10 px-4 py-3 text-xs text-white/65">
          <span><Clock3 className="mr-1.5 inline h-3.5 w-3.5" />{match.status === "UPCOMING" ? kickoff : match.startTime ? <LocalMatchTime startTime={match.startTime} /> : "Kickoff unavailable"}</span>
          {match.venue?.name ? <span><MapPin className="mr-1.5 inline h-3.5 w-3.5" />{match.venue.name}</span> : null}
          <span>Source: {match.detailAvailability?.source ?? "PostgreSQL"}</span>
        </div>
      </header>

      <nav className="mt-5 overflow-x-auto border-b border-slate-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Match centre sections">
        <div className="flex min-w-max gap-1" role="tablist" aria-label="Match details">
          {TABS.map(({ id, label, icon: Icon }) => <button key={id} id={`match-tab-${id}`} type="button" role="tab" aria-selected={activeTab === id} aria-controls={`match-panel-${id}`} onClick={() => setActiveTab(id)} className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors ${activeTab === id ? "border-emerald-700 text-emerald-800" : "border-transparent text-slate-500 hover:text-slate-900"}`}><Icon className="h-4 w-4" />{label}</button>)}
        </div>
      </nav>

      <section id={`match-panel-${activeTab}`} role="tabpanel" aria-labelledby={`match-tab-${activeTab}`} className="pt-5">
        {activeTab === "overview" ? <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,.75fr)]">
          <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
            <div className="mb-5 flex items-center justify-between gap-4"><div><h2 className="text-base font-bold text-slate-900">Match timeline</h2><p className="mt-1 text-xs text-slate-500">Goals, cards, substitutions and reported incidents</p></div><span className="text-xs text-slate-400">{match.events?.length ?? 0} events</span></div>
            <EventList events={match.events ?? []} homeTeam={match.homeTeam} status={match.status} />
          </section>
          <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
            <h2 className="text-base font-bold text-slate-900">Match information</h2>
            <div className="mt-2">
              <InfoRow icon={CalendarDays} label="Kickoff" value={kickoff} />
              <InfoRow icon={Flag} label="Competition" value={<>{match.league}{match.competitionEdition ? ` · ${match.competitionEdition}` : ""}</>} />
              <InfoRow icon={Info} label="Round" value={round ?? unavailable("Not supplied")} />
              <InfoRow icon={MapPin} label="Venue" value={match.venue?.name ? <>{match.venue.name}{match.venue.city ? <span className="block text-xs font-normal text-slate-500">{match.venue.city}{match.venue.country ? `, ${match.venue.country}` : ""}</span> : null}</> : unavailable()} />
              <InfoRow icon={Flag} label="Referee" value={match.referees?.length ? match.referees.join(", ") : unavailable()} />
              <InfoRow icon={UsersRound} label="Coaches" value={homeLineup?.coach?.name || awayLineup?.coach?.name ? `${homeLineup?.coach?.name || "Home unavailable"} · ${awayLineup?.coach?.name || "Away unavailable"}` : unavailable()} />
            </div>
            {match.headToHead?.length ? <div className="mt-4 border-t border-slate-100 pt-4"><p className="mb-2 text-xs font-bold uppercase text-slate-500">Recent meetings</p><ul className="space-y-2">{match.headToHead.slice(0, 3).map((item) => <li key={item.id} className="flex justify-between gap-3 text-xs"><span className="truncate text-slate-600">{item.homeTeam} – {item.awayTeam}</span><span className="shrink-0 font-semibold tabular-nums">{item.homeScore ?? "–"} : {item.awayScore ?? "–"}</span></li>)}</ul></div> : null}
          </section>
        </div> : null}

        {activeTab === "timeline" ? <section className="max-w-3xl rounded-lg border border-slate-200 bg-white p-4 sm:p-6"><div className="mb-6"><h2 className="text-base font-bold text-slate-900">Commentary</h2><p className="mt-1 text-xs text-slate-500">Only events persisted from a configured provider are shown.</p></div><EventList events={match.events ?? []} homeTeam={match.homeTeam} status={match.status} /></section> : null}

        {activeTab === "lineups" ? <div>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-base font-bold text-slate-900">Lineups</h2><p className="mt-1 text-xs text-slate-500">Formation visualization appears only when source formation or player positions are present.</p></div><span className="text-xs text-slate-500">{lineups.reduce((sum, team) => sum + team.starters.length, 0)} starters · {lineups.reduce((sum, team) => sum + team.substitutes.length, 0)} substitutes</span></div>
          <FormationPitch lineups={lineups} />
          {lineups.length ? <div className="grid items-start gap-4 lg:grid-cols-2"><LineupPanel lineup={lineups[0]} />{lineups[1] ? <LineupPanel lineup={lineups[1]} /> : null}</div> : <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">Lineup records are not available for this match.</div>}
        </div> : null}

        {activeTab === "statistics" ? <div className="space-y-5">
          <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-base font-bold text-slate-900">Player statistics</h2><p className="mt-1 text-xs text-slate-500">Values read from persisted player-match records</p></div><span className="text-xs text-slate-400">Ratings are provider-supplied only</span></div><PlayerStatistics match={match} /></section>
          <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5"><h2 className="text-base font-bold text-slate-900">Team statistics</h2><p className="mt-2 text-sm text-slate-500">Team totals are not stored in the current match schema and are unavailable for this fixture.</p></section>
        </div> : null}

        {activeTab === "h2h" ? <div className="grid items-start gap-5 lg:grid-cols-2">
          <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5"><h2 className="text-base font-bold text-slate-900">Head-to-head</h2><p className="mt-1 text-xs text-slate-500">Previous meetings found in PostgreSQL</p>{match.headToHead?.length ? <ul className="mt-4 divide-y divide-slate-100">{match.headToHead.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><span className="min-w-0 flex-1 truncate">{item.homeTeam} <span className="text-slate-400">vs</span> {item.awayTeam}</span><span className="font-mono font-semibold tabular-nums">{item.homeScore ?? "–"} : {item.awayScore ?? "–"}</span><time className="w-full text-xs text-slate-400">{new Date(item.date).toLocaleDateString()}</time></li>)}</ul> : <p className="mt-4 text-sm text-slate-400">No earlier meetings are stored.</p>}</section>
          <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5"><h2 className="text-base font-bold text-slate-900">Competition table</h2><p className="mt-1 text-xs text-slate-500">Stored standings for these teams</p>{match.standings?.length ? <div className="mt-4 divide-y divide-slate-100">{match.standings.map((row) => <div key={row.teamId} className="grid grid-cols-[36px_minmax(0,1fr)_38px_48px] items-center gap-2 py-3 text-sm"><span className="text-center text-xs tabular-nums text-slate-400">{row.rank ?? "–"}</span><span className="truncate font-medium">{row.teamName}</span><span className="text-right tabular-nums">{row.points ?? "–"}</span><span className="text-right text-xs text-slate-500">{row.wins}-{row.draws}-{row.losses}</span></div>)}</div> : <p className="mt-4 text-sm text-slate-400">Standings are not stored for this competition.</p>}</section>
        </div> : null}
      </section>

      <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 text-[11px] text-slate-400">
        <span>Match information is served from PostgreSQL.</span>
        <span>Unavailable values are left blank until a provider supplies them.</span>
      </footer>
    </main>
  )
}