"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { SafeImage } from "@/components/ui/safe-image"
import { Badge } from "@/components/ui/badge"
import type { MatchWithLeague, Match } from "@/lib/matches"

function MatchStatus({ match }: { match: Match }) {
  if (match.status === "LIVE") {
    return (
      <Badge className="border-red-500/20 bg-red-500/10 text-red-500 text-[10px] px-1.5 py-0">
        {match.minute ? `LIVE ${match.minute}` : "LIVE"}
      </Badge>
    )
  }
  if (match.status === "FT") {
    return (
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
        FT
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
      Upcoming
    </Badge>
  )
}

function FeaturedMatchCard({ match }: { match: MatchWithLeague }) {
  return (
    <Link href={`/match/${match.id}`} prefetch={false} className="block shrink-0 select-none">
      <div className="rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:bg-[#2e0c46] hover:border-purple-500/50 hover:shadow-md min-w-[175px] max-w-[190px] h-full flex flex-col justify-between">
        <div>
          <p className="mb-2.5 truncate text-[11px] font-medium text-muted-foreground">{match.league}</p>
          <div className="space-y-2">
            {/* Home Team */}
            <div className="flex items-center gap-2">
              {match.homeLogo ? (
                <SafeImage src={match.homeLogo} alt={match.homeTeam} width={18} height={18} className="h-[18px] w-[18px] object-contain shrink-0" />
              ) : (
                <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-muted text-[8px] font-bold">
                  {match.homeTeam.substring(0, 2).toUpperCase()}
                </div>
              )}
              <span className="truncate text-xs font-medium">{match.homeTeam}</span>
              {match.status !== "UPCOMING" && (
                <span className="ml-auto text-xs font-semibold">{match.homeScore}</span>
              )}
            </div>

            {/* Away Team */}
            <div className="flex items-center gap-2">
              {match.awayLogo ? (
                <SafeImage src={match.awayLogo} alt={match.awayTeam} width={18} height={18} className="h-[18px] w-[18px] object-contain shrink-0" />
              ) : (
                <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-muted text-[8px] font-bold">
                  {match.awayTeam.substring(0, 2).toUpperCase()}
                </div>
              )}
              <span className="truncate text-xs font-medium">{match.awayTeam}</span>
              {match.status !== "UPCOMING" && (
                <span className="ml-auto text-xs font-semibold">{match.awayScore}</span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 pt-1">
          <MatchStatus match={match} />
        </div>
      </div>
    </Link>
  )
}

export function FeaturedMatchesCarousel({
  matches,
  isSignedIn,
}: {
  matches: MatchWithLeague[]
  isSignedIn: boolean
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = useState(false)

  // Ensure enough items so continuous wrap is completely seamless
  const repeatCount = matches.length > 0 ? Math.max(2, Math.ceil(12 / matches.length)) : 1
  const displayMatches = Array.from({ length: repeatCount }, () => matches).flat()

  useEffect(() => {
    const el = scrollRef.current
    if (!el || matches.length === 0) return

    let animationFrameId: number
    const speed = 0.75 // smooth pixels per frame (~45px per second)

    const scrollLoop = () => {
      if (!isHovered && el) {
        el.scrollLeft += speed

        const singleSetWidth = el.scrollWidth / repeatCount
        if (el.scrollLeft >= singleSetWidth) {
          el.scrollLeft -= singleSetWidth
        }
      }
      animationFrameId = requestAnimationFrame(scrollLoop)
    }

    animationFrameId = requestAnimationFrame(scrollLoop)

    return () => cancelAnimationFrame(animationFrameId)
  }, [isHovered, matches.length, repeatCount])

  if (matches.length === 0) return null

  return (
    <div className="mb-10">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold">
          {isSignedIn ? "Your Favourites" : "Most Popular Today"}
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isSignedIn ? "Matches featuring your teams" : "Biggest matches across all leagues"}
        </p>
      </div>

      {/* Auto-scrolling viewport with subtle edge fades */}
      <div
        className="relative group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onTouchStart={() => setIsHovered(true)}
        onTouchEnd={() => setIsHovered(false)}
      >
        {/* Left and Right subtle gradient masks */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-background to-transparent z-10 opacity-70" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent z-10 opacity-70" />

        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-2 scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] select-none"
        >
          {displayMatches.map((m, index) => (
            <FeaturedMatchCard key={`${m.id}-${index}`} match={m} />
          ))}
        </div>
      </div>
    </div>
  )
}

