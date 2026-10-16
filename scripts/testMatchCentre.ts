import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { MatchCentre } from "../src/components/matches/match-centre"
import type { MatchWithLeague } from "../src/lib/matches"

const match: MatchWithLeague = {
  id: 90001,
  homeTeam: "São Paulo FC",
  awayTeam: "EC Vitória",
  homeTeamId: 1,
  awayTeamId: 2,
  homeLogo: undefined,
  awayLogo: undefined,
  homeScore: 2,
  awayScore: 1,
  halftimeScore: null,
  status: "FT",
  startTime: "2026-10-11T00:00:00.000Z",
  league: "Campeonato Brasileiro Série A",
  leagueId: 56,
  country: "Brazil",
  competitionEdition: "2026",
  roundStatus: "league",
  referees: [],
  venue: undefined,
  events: [{
    eventid: 1,
    eventtime: 31,
    eventtype: "Goal",
    playername: "Sample scorer",
    teamname: "São Paulo FC",
    goaltype: "Normal Goal",
    assistplayername: null,
    cardtype: null,
  }],
  lineups: ["São Paulo FC", "EC Vitória"].map((name, index) => ({
    team: { id: index + 1, name, logo: null },
    formation: null,
    coach: { name: null, photo: null },
    starters: [],
    substitutes: [],
    unavailable: [],
  })),
  playerStatistics: [],
  standings: [],
  headToHead: [],
  detailAvailability: {
    source: "football-data.org",
    permission: null,
    venue: false,
    referee: false,
    events: false,
    lineups: false,
    coaches: false,
    substitutes: false,
    playerStats: false,
    playerRatings: false,
  },
}

const html = renderToStaticMarkup(createElement(MatchCentre, { match }))
assert.match(html, /São Paulo FC/)
assert.match(html, /EC Vitória/)
assert.ok(html.includes('>2<span class="mx-2 text-white/40">:</span>1</div>'))
assert.match(html, /aria-label="Match centre sections"/)
assert.match(html, /role="tab"/)
assert.doesNotMatch(html, /Commentary/)
assert.match(html, /Match timeline/)
assert.match(html, /aria-label="Match timeline"/)
assert.match(html, /Lineups/)
assert.match(html, /Not available from connected providers/)
assert.match(html, /Sample scorer/)
assert.match(html, /Match information is served from PostgreSQL/)

console.log("Match centre render tests passed: scoreboard, accessible tabs, and independent unavailable states.")