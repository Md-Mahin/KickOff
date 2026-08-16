import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { getMatchById } from "@/lib/api"
import type { MatchWithLeague } from "@/lib/matches"
import Image from "next/image"

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-5xl px-4 py-8">

        {/* League */}
        <div className="mb-4 text-sm text-muted-foreground">
          {match.league} • {match.country}
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
      className="mx-auto object-contain"
    />
  )}

  <div className="mt-2 text-lg font-semibold">
    {match.homeTeam}
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
              </div>

              {/* Away */}
              <div className="flex-1 text-center">
  {match.awayLogo && (
    <Image
      src={match.awayLogo}
      alt={match.awayTeam}
      width={64}
      height={64}
      className="mx-auto object-contain"
    />
  )}

  <div className="mt-2 text-lg font-semibold">
    {match.awayTeam}
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
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h2 className="font-semibold">
                Match Details
              </h2>

              <div className="mt-4 text-sm text-muted-foreground">
                Match events, statistics and lineups will be added next.
              </div>
            </CardContent>
          </Card>

        </div>

      </main>
    </div>
  )
}