import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { leagues, type Match } from "@/lib/matches"

function MatchStatus({ match }: { match: Match }) {
  if (match.status === "LIVE") {
    return (
      <Badge className="border-red-500/20 bg-red-500/10 text-red-500">
        LIVE
      </Badge>
    )
  }

  if (match.status === "FT") {
    return <Badge variant="secondary">FT</Badge>
  }

  return <Badge variant="outline">Today</Badge>
}

function MatchRow({ match }: { match: Match }) {
  return (
    <div className="flex items-center justify-between px-4 py-4">
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium">{match.homeTeam}</span>
          <span className="text-sm font-semibold">
            {match.status === "UPCOMING" ? "-" : match.homeScore}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium">{match.awayTeam}</span>
          <span className="text-sm font-semibold">
            {match.status === "UPCOMING" ? "-" : match.awayScore}
          </span>
        </div>
      </div>

      <div className="ml-4 flex w-20 flex-col items-end gap-2">
        <MatchStatus match={match} />

        {match.minute ? (
          <span className="text-xs text-muted-foreground">{match.minute}</span>
        ) : null}
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            nilnil
          </Link>

          <nav className="hidden items-center gap-4 text-sm text-muted-foreground md:flex">
            <span className="cursor-pointer transition hover:text-foreground">
              Matches
            </span>
            <span className="cursor-pointer transition hover:text-foreground">
              Leagues
            </span>
            <span className="cursor-pointer transition hover:text-foreground">
              Teams
            </span>
          </nav>

          <Button variant="outline" size="sm">
            Sign in
          </Button>
        </div>
      </header> */}

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Live scores, fixtures and match stats.
            </p>
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="secondary">
              All
            </Button>
            <Button size="sm" variant="ghost">
              Live
            </Button>
            <Button size="sm" variant="ghost">
              Finished
            </Button>
            <Button size="sm" variant="ghost">
              Favourites
            </Button>
          </div>
        </div>

        <Separator className="my-6" />

        <div className="space-y-8">
          {leagues.map((leagueGroup) => (
            <section key={leagueGroup.league}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">
                    {leagueGroup.league}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {leagueGroup.country}
                  </p>
                </div>

                <Button variant="ghost" size="sm">
                  View all
                </Button>
              </div>

              <Card>
                <CardContent className="p-0">
                  {leagueGroup.matches.map((match, index) => (
                    <div key={match.id}>
                      <Link
                        href={`/match/${match.id}`}
                        className="block transition hover:bg-muted/50"
                      >
                        <MatchRow match={match} />
                      </Link>

                      {index < leagueGroup.matches.length - 1 ? (
                        <Separator />
                      ) : null}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>
          ))}
        </div>
      </main>
    </div>
  )
}