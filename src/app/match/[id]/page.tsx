import { notFound } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { getMatchById, getMatchEvents, getMatchLineups } from "@/lib/api"
import type { MatchWithLeague } from "@/lib/matches"
import Image from "next/image"
import { LocalMatchTime } from "@/components/matches/local-match-time"
import { MatchLineups } from "@/components/matches/match-lineups"

function MatchStatusBadge({ match }: { match: MatchWithLeague }) {
  if (match.status === "LIVE") {
    return (
      <Badge className="border-red-500/20 bg-red-500/10 text-red-500">
        LIVE {match.minute}
      </Badge>
    )
  }

  if (match.status === "FT") {
    return <Badge variant="secondary">Full Time</Badge>
  }

  return <Badge variant="outline">Upcoming</Badge>
}

function EventIcon({
  event,
}: {
  event: {
    eventtype: "Goal" | "Card" | "Foul" | "Substitution"
    cardtype: "Yellow" | "Red" | null
  }
}) {
  if (event.eventtype === "Goal") {
    return <span className="text-lg">⚽</span>
  }

  if (event.eventtype === "Card") {
    return (
      <span
        className={`inline-block h-5 w-3 rounded-sm ${event.cardtype === "Red"
            ? "bg-red-500"
            : "bg-yellow-400"
          }`}
      />
    )
  }

  if (event.eventtype === "Substitution") {
    return <span className="text-lg font-bold text-emerald-600">↕</span>
  }

  return <span className="text-lg">⚠</span>
}
export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const matchId = Number(id)

  if (Number.isNaN(matchId)) {
    notFound()
  }

  const match = await getMatchById(matchId)

  if (!match) {
    notFound()
  }
  const [events, lineups] = await Promise.all([
    getMatchEvents(matchId),
    getMatchLineups(matchId),
  ])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-5xl px-4 py-8">

        {/* League */}
        <div className="mb-4 text-sm text-muted-foreground flex items-center gap-1">
          {match.leagueId ? (
            <Link href={`/tournament/${match.leagueId}`} className="hover:underline hover:text-slate-900 font-medium">
              {match.league}
            </Link>
          ) : (
            <span className="font-medium">{match.league}</span>
          )}
          <span>•</span>
          <span>{match.country}</span>
        </div>

        {/* Match header */}
        <Card>
          <CardContent className="p-6">

            <div className="flex items-center justify-center">
              <MatchStatusBadge match={match} />
            </div>

            <div className="mt-6 flex items-center justify-between gap-4">

              {/* Home */}
              <div className="flex-1 text-center">
                {match.homeLogo && (
                  <Image
                    src={match.homeLogo}
                    alt={match.homeTeam}
                    width={64}
                    height={64}
                    className="mx-auto h-16 w-16 object-contain"
                  />
                )}

                <div className="mt-2 text-lg font-semibold">
                  {match.homeTeamId ? (
                    <Link href={`/team/${match.homeTeamId}`} className="hover:underline hover:text-blue-600 transition-colors">
                      {match.homeTeam}
                    </Link>
                  ) : match.homeTeam}
                </div>

                <div className="mt-1 text-xs text-muted-foreground">
                  Home
                </div>
              </div>

              {/* Score */}
              <div className="text-center">
                <div className="text-4xl font-bold tracking-tight">
                  {match.status === "UPCOMING"
                    ? "-"
                    : `${match.homeScore} - ${match.awayScore}`}
                </div>

                {match.minute && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    {match.minute}
                  </div>
                )}

                {match.startTime && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    Kickoff <LocalMatchTime startTime={match.startTime} />
                  </div>
                )}
              </div>

              {/* Away */}
              <div className="flex-1 text-center">
                {match.awayLogo && (
                  <Image
                    src={match.awayLogo}
                    alt={match.awayTeam}
                    width={64}
                    height={64}
                    className="mx-auto h-16 w-16 object-contain"
                  />
                )}

                <div className="mt-2 text-lg font-semibold">
                  {match.awayTeamId ? (
                    <Link href={`/team/${match.awayTeamId}`} className="hover:underline hover:text-blue-600 transition-colors">
                      {match.awayTeam}
                    </Link>
                  ) : match.awayTeam}
                </div>

                <div className="mt-1 text-xs text-muted-foreground">
                  Away
                </div>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* Match information */}
        <div className="mt-6 grid gap-4 md:grid-cols-2">

          <Card>
            <CardContent className="p-4">
              <h2 className="font-semibold">
                Match Information
              </h2>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    League
                  </span>

                  <span>{match.league}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Country
                  </span>

                  <span>{match.country}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Status
                  </span>

                  <span>{match.status}</span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Referees</span>
                  <span className="text-right">
                    {match.referees && match.referees.length > 0
                      ? match.referees.join(", ")
                      : "Not available"}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Venue</span>
                  <span className="text-right">
                    {match.venue?.name ?? "Not available"}
                    {match.venue?.city || match.venue?.country ? (
                      <span className="block text-xs text-muted-foreground">
                        {[match.venue.city, match.venue.country].filter(Boolean).join(", ")}
                      </span>
                    ) : null}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h2 className="font-semibold">
                Match Events
              </h2>

              {events.length === 0 ? (
                <div className="mt-4 text-sm text-muted-foreground">
                  No events recorded for this match.
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  {events.map((event, index) => (
                    <div
                      key={`${event.eventid || "event"}-${event.eventtime ?? "time"}-${index}`}
                      className="flex items-center gap-4"
                    >
                      <div className="w-10 text-right text-sm font-medium">
                        {event.eventtime}'
                      </div>

                      <div className="flex h-8 w-8 items-center justify-center">
                        <EventIcon event={event} />
                      </div>

                      <div className="min-w-0">
                        <div className="font-medium">
                          {event.eventtype === "Goal"
                            ? (event.playerid ? <Link href={`/player/${event.playerid}`} className="hover:underline text-blue-600">{event.playername}</Link> : event.playername ?? "Goal")
                            : event.eventtype === "Card"
                              ? (
                                  <>
                                    {event.cardtype ?? ""} Card for{" "}
                                    {event.playerid && event.playername ? <Link href={`/player/${event.playerid}`} className="hover:underline text-blue-600">{event.playername}</Link> : event.playername ?? "Unknown"}
                                  </>
                                )
                              : event.eventtype === "Substitution"
                                ? (
                                  <>
                                    {event.playerid && event.playername ? <Link href={`/player/${event.playerid}`} className="hover:underline text-blue-600">{event.playername}</Link> : event.playername ?? "Player"} substituted
                                  </>
                                )
                                : (
                                  <>
                                    Foul by {event.playerid && event.playername ? <Link href={`/player/${event.playerid}`} className="hover:underline text-blue-600">{event.playername}</Link> : event.playername ?? "Unknown"}
                                  </>
                                )}
                        </div>

                        <div className="text-sm text-muted-foreground">
                          {event.teamname}
                        </div>

                        {event.assistplayername && (
                          <div className="text-xs text-muted-foreground">
                            Assist: {event.assistplayername}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        <MatchLineups lineups={lineups} events={events} />

      </main>
    </div>
  )
}