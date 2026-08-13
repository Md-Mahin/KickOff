// import Link from "next/link"
import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Navbar from "@/components/ui/navbar"
import {
  getMatchById,
  type MatchEvent,
  type MatchStat,
  type MatchWithLeague,
} from "@/lib/matches"

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

function EventLabel({ event }: { event: MatchEvent }) {
  if (event.type === "goal") return <span>Goal</span>
  if (event.type === "yellow") return <span>Yellow card</span>
  if (event.type === "red") return <span>Red card</span>
  return <span>Substitution</span>
}

function EventItem({
  event,
  match,
}: {
  event: MatchEvent
  match: MatchWithLeague
}) {
  const team = event.team === "home" ? match.homeTeam : match.awayTeam

  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div>
        <div className="text-sm font-medium">{event.player}</div>
        <div className="text-xs text-muted-foreground">
          <EventLabel event={event} /> • {team}
        </div>
      </div>

      <div className="text-sm text-muted-foreground">{event.minute}</div>
    </div>
  )
}

function StatRow({ stat }: { stat: MatchStat }) {
  const total = stat.home + stat.away
  const homePercent = total === 0 ? 50 : Math.round((stat.home / total) * 100)
  const awayPercent = 100 - homePercent

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{stat.home}</span>
        <span className="text-muted-foreground">{stat.label}</span>
        <span className="font-medium">{stat.away}</span>
      </div>

      <div className="flex h-2 gap-1">
        <div
          className="rounded-full bg-primary"
          style={{ width: `${homePercent}%` }}
        />
        <div
          className="rounded-full bg-muted"
          style={{ width: `${awayPercent}%` }}
        />
      </div>
    </div>
  )
}

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const match = getMatchById(Number(id))

  if (!match) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            KickOff
          </Link>

          <Link
            href="/"
            className="text-sm text-muted-foreground transition hover:text-foreground"
          >
            Back to matches
          </Link>
        </div>
      </header> */}

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-4 text-sm text-muted-foreground">
          {match.league} • {match.country}
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <MatchStatusBadge match={match} />
            </div>

            <div className="mt-6 flex items-center justify-between gap-4">
              <div className="flex-1 text-center">
                <div className="text-lg font-semibold">{match.homeTeam}</div>
                <div className="mt-1 text-xs text-muted-foreground">Home</div>
              </div>

              <div className="text-center">
                <div className="text-4xl font-bold tracking-tight">
                  {match.status === "UPCOMING"
                    ? "-"
                    : `${match.homeScore} - ${match.awayScore}`}
                </div>

                {match.minute ? (
                  <div className="mt-2 text-sm text-muted-foreground">
                    {match.minute}
                  </div>
                ) : null}
              </div>

              <div className="flex-1 text-center">
                <div className="text-lg font-semibold">{match.awayTeam}</div>
                <div className="mt-1 text-xs text-muted-foreground">Away</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6">
          <Tabs defaultValue="summary">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="stats">Stats</TabsTrigger>
              <TabsTrigger value="lineups">Lineups</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="mt-4">
              <Card>
                <CardContent className="p-4">
                  {match.events && match.events.length > 0 ? (
                    <div className="space-y-3">
                      {match.events.map((event) => (
                        <EventItem key={event.id} event={event} match={match} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      No events yet.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="stats" className="mt-4">
              <Card>
                <CardContent className="p-4">
                  {match.stats && match.stats.length > 0 ? (
                    <div className="space-y-6">
                      {match.stats.map((stat) => (
                        <StatRow key={stat.label} stat={stat} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      No stats available yet.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="lineups" className="mt-4">
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground">
                    Lineups are not available yet.
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}