"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import type { TeamEntry, PlayerEntry } from "@/lib/api"

const BACKEND = "http://localhost:5000"
const inputCls =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/20"

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepDots({ step }: { step: number }) {
  return (
    <div className="flex justify-center gap-2 mb-6">
      {[1, 2, 3].map(n => (
        <div
          key={n}
          className={`h-2 rounded-full transition-all ${
            n === step ? "w-6 bg-primary" : n < step ? "w-2 bg-primary/40" : "w-2 bg-muted"
          }`}
        />
      ))}
    </div>
  )
}

// ─── Team chip ────────────────────────────────────────────────────────────────
function TeamChip({
  team,
  selected,
  disabled,
  onClick,
}: {
  team: TeamEntry
  selected: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled && !selected}
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition
        ${selected
          ? "border-primary bg-primary text-primary-foreground"
          : disabled
            ? "cursor-not-allowed border-border bg-muted/30 text-muted-foreground opacity-50"
            : "border-border hover:border-primary hover:bg-primary/5"
        }`}
    >
      {team.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.logo} alt="" className="h-4 w-4 object-contain" />
      ) : (
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-muted text-[8px] font-bold">
          {team.name.substring(0, 2).toUpperCase()}
        </span>
      )}
      {team.name}
    </button>
  )
}

// ─── Player chip ──────────────────────────────────────────────────────────────
function PlayerChip({
  player,
  rank,
  disabled,
  onClick,
}: {
  player: PlayerEntry
  rank: number | null
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled && rank === null}
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition
        ${rank !== null
          ? "border-primary bg-primary text-primary-foreground"
          : disabled
            ? "cursor-not-allowed border-border bg-muted/30 text-muted-foreground opacity-50"
            : "border-border hover:border-primary hover:bg-primary/5"
        }`}
    >
      {rank !== null && (
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary-foreground/20 text-[9px] font-bold">
          {rank}
        </span>
      )}
      {player.name}
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SignUpPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Step 1 fields
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [bootstrapKey, setBootstrapKey] = useState("")

  // Step 2 — teams
  const [teams, setTeams] = useState<{ national: TeamEntry[]; club: TeamEntry[] }>({ national: [], club: [] })
  const [teamsLoading, setTeamsLoading] = useState(false)
  const [teamSearch, setTeamSearch] = useState("")
  const [selectedNational, setSelectedNational] = useState<TeamEntry[]>([])
  const [selectedClub, setSelectedClub] = useState<TeamEntry[]>([])

  // Step 3 — players
  const [players, setPlayers] = useState<PlayerEntry[]>([])
  const [playersLoading, setPlayersLoading] = useState(false)
  const [playerSearch, setPlayerSearch] = useState("")
  const [selectedPlayers, setSelectedPlayers] = useState<PlayerEntry[]>([])

  // Fetch teams when entering step 2
  useEffect(() => {
    if (step !== 2 || teams.national.length + teams.club.length > 0) return
    setTeamsLoading(true)
    fetch(`${BACKEND}/api/users/teams/catalog`)
      .then(r => r.json())
      .then((d: { national: TeamEntry[]; club: TeamEntry[] }) => setTeams(d))
      .catch(() => {})
      .finally(() => setTeamsLoading(false))
  }, [step, teams.national.length, teams.club.length])

  // Fetch players when entering step 3
  useEffect(() => {
    if (step !== 3 || players.length > 0) return
    setPlayersLoading(true)
    fetch(`${BACKEND}/api/users/players/catalog`)
      .then(r => r.json())
      .then((d: { players: PlayerEntry[] }) => setPlayers(d.players ?? []))
      .catch(() => {})
      .finally(() => setPlayersLoading(false))
  }, [step, players.length])

  function toggleNational(team: TeamEntry) {
    setSelectedNational(prev =>
      prev.find(t => t.id === team.id)
        ? prev.filter(t => t.id !== team.id)
        : prev.length < 2 ? [...prev, team] : prev
    )
  }

  function toggleClub(team: TeamEntry) {
    setSelectedClub(prev =>
      prev.find(t => t.id === team.id)
        ? prev.filter(t => t.id !== team.id)
        : prev.length < 4 ? [...prev, team] : prev
    )
  }

  function togglePlayer(player: PlayerEntry) {
    setSelectedPlayers(prev =>
      prev.find(p => p.id === player.id)
        ? prev.filter(p => p.id !== player.id)
        : prev.length < 10 ? [...prev, player] : prev
    )
  }

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!name.trim() || !email.trim() || password.length < 8) {
      setError("Please fill in all fields. Password must be at least 8 characters.")
      return
    }
    setStep(2)
  }

  async function handleSubmit() {
    setError("")
    setIsSubmitting(true)
    try {
      const endpoint = bootstrapKey ? "bootstrap-admin" : "register"
      const teamIds = [...selectedNational, ...selectedClub].map(t => t.id)
      const playerIds = selectedPlayers.map(p => p.id)

      const response = await fetch(`${BACKEND}/api/auth/${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, bootstrapKey: bootstrapKey || undefined, teamIds, playerIds }),
      })
      const data = (await response.json()) as { message?: string }

      if (!response.ok) {
        setError(data.message ?? "Unable to create your account. Please try again.")
        return
      }

      window.location.href = "/"
    } catch {
      setError("The registration service is unavailable. Please try again shortly.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Filtered lists ────────────────────────────────────────────────────────
  const filteredNational = teams.national.filter(t => t.name.toLowerCase().includes(teamSearch.toLowerCase()))
  const filteredClub = teams.club.filter(t => t.name.toLowerCase().includes(teamSearch.toLowerCase()))
  const filteredPlayers = players.filter(p => p.name.toLowerCase().includes(playerSearch.toLowerCase()))

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AuthShell
      title={step === 1 ? "Create your account" : step === 2 ? "Pick your teams" : "Favourite players"}
      description={
        step === 1
          ? "Save your favourite teams and stay close to every match."
          : step === 2
            ? `National teams: ${selectedNational.length}/2 · Club teams: ${selectedClub.length}/4`
            : `Select up to 10 players in ranked order (${selectedPlayers.length}/10)`
      }
      footerText="Already have an account?"
      footerLinkLabel="Sign in"
      footerHref="/sign-in"
    >
      <StepDots step={step} />

      {/* ── Step 1: Account details ── */}
      {step === 1 && (
        <form className="space-y-4" onSubmit={handleStep1}>
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">Full name</label>
            <input id="name" type="text" autoComplete="name" placeholder="Your name" className={inputCls} required value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">Email address</label>
            <input id="email" type="email" autoComplete="email" placeholder="you@example.com" className={inputCls} required value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">Password</label>
            <input id="password" type="password" autoComplete="new-password" minLength={8} placeholder="At least 8 characters" className={inputCls} required value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label htmlFor="bootstrapKey" className="text-sm font-medium">Administrator invite <span className="text-muted-foreground font-normal">(optional)</span></label>
            <input id="bootstrapKey" type="password" autoComplete="off" placeholder="Leave blank for a fan account" className={inputCls} value={bootstrapKey} onChange={e => setBootstrapKey(e.target.value)} />
          </div>
          {error && <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}
          <Button type="submit" className="mt-2 h-10 w-full">Continue →</Button>
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            By continuing, you agree to our <Link href="#" className="underline underline-offset-2 hover:text-foreground">Terms</Link> and <Link href="#" className="underline underline-offset-2 hover:text-foreground">Privacy Policy</Link>.
          </p>
        </form>
      )}

      {/* ── Step 2: Teams ── */}
      {step === 2 && (
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Search teams…"
            className={inputCls}
            value={teamSearch}
            onChange={e => setTeamSearch(e.target.value)}
          />

          {teamsLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading teams…</p>
          ) : (
            <div className="max-h-72 overflow-y-auto space-y-4 pr-1">
              {filteredNational.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    National teams <span className="font-normal normal-case">({selectedNational.length}/2)</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {filteredNational.map(t => (
                      <TeamChip
                        key={t.id}
                        team={t}
                        selected={!!selectedNational.find(s => s.id === t.id)}
                        disabled={selectedNational.length >= 2}
                        onClick={() => toggleNational(t)}
                      />
                    ))}
                  </div>
                </div>
              )}
              {filteredClub.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Club teams <span className="font-normal normal-case">({selectedClub.length}/4)</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {filteredClub.map(t => (
                      <TeamChip
                        key={t.id}
                        team={t}
                        selected={!!selectedClub.find(s => s.id === t.id)}
                        disabled={selectedClub.length >= 4}
                        onClick={() => toggleClub(t)}
                      />
                    ))}
                  </div>
                </div>
              )}
              {filteredNational.length === 0 && filteredClub.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">No teams found.</p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>← Back</Button>
            <Button className="flex-1" onClick={() => setStep(3)}>Continue →</Button>
          </div>
          <p className="text-center text-xs text-muted-foreground">You can change your selections later from your profile.</p>
        </div>
      )}

      {/* ── Step 3: Players ── */}
      {step === 3 && (
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Search players…"
            className={inputCls}
            value={playerSearch}
            onChange={e => setPlayerSearch(e.target.value)}
          />

          {playersLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading players…</p>
          ) : players.length === 0 ? (
            <p className="rounded-lg border border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
              No players available yet. You can add favourite players later from your profile once the database is set up.
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto pr-1">
              <div className="flex flex-wrap gap-2">
                {filteredPlayers.map(p => {
                  const rank = selectedPlayers.findIndex(s => s.id === p.id)
                  return (
                    <PlayerChip
                      key={p.id}
                      player={p}
                      rank={rank >= 0 ? rank + 1 : null}
                      disabled={selectedPlayers.length >= 10}
                      onClick={() => togglePlayer(p)}
                    />
                  )
                })}
              </div>
            </div>
          )}

          {error && <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>← Back</Button>
            <Button className="flex-1" disabled={isSubmitting} onClick={handleSubmit}>
              {isSubmitting ? "Creating account…" : "Create account"}
            </Button>
          </div>
          <p className="text-center text-xs text-muted-foreground">Players are ranked in the order you select them.</p>
        </div>
      )}
    </AuthShell>
  )
}
