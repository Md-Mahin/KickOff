import { notFound } from "next/navigation"
import Link from "next/link"

import { MatchCentre } from "@/components/matches/match-centre"
import { getMatchById } from "@/lib/api"

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const matchId = Number(id)
  if (!Number.isSafeInteger(matchId) || matchId <= 0) notFound()

  let match
  try {
    match = await getMatchById(matchId)
  } catch (error) {
    console.error(`Unable to load match ${matchId} from the backend`, error)
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-5 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Match details are temporarily unavailable</h1>
        <p className="mt-2 text-sm text-slate-500">The database-backed match service could not be reached.</p>
        <Link href="/" className="mt-5 rounded-md border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50">Back to matches</Link>
      </main>
    )
  }

  if (!match) notFound()
  return <MatchCentre match={match} />
}