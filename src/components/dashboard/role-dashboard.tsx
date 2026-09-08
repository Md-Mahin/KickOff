"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const API_URL = "http://localhost:5000/api"

type AuthUser = { userId: number; role: "fan" | "admin" }
type Team = { teamId: number; teamName: string }
type AdminUser = { id: number; name: string; email: string; role: string }

async function api(path: string, init?: RequestInit) {
  const response = await fetch(`${API_URL}${path}`, { ...init, credentials: "include", headers: { "Content-Type": "application/json", ...init?.headers } })
  const data = (await response.json().catch(() => ({}))) as { message?: string; user?: AuthUser; teams?: Team[]; users?: AdminUser[]; team?: Team }
  if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`)
  return data
}

export function RoleDashboard() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [catalog, setCatalog] = useState<Team[]>([])
  const [followed, setFollowed] = useState<Team[]>([])
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [teamId, setTeamId] = useState("")
  const [message, setMessage] = useState("")

  useEffect(() => {
    api("/auth/me").then((data) => {
      setUser(data.user ?? null)
      if (data.user?.role === "fan") {
        Promise.all([api("/users/teams/catalog"), api("/users/teams")]).then(([all, own]) => {
          setCatalog(all.teams ?? [])
          setFollowed(own.teams ?? [])
        }).catch((error: Error) => setMessage(error.message))
      }
      if (data.user?.role === "admin") {
        api("/users/admin/users").then((users) => setAdminUsers(users.users ?? [])).catch((error: Error) => setMessage(error.message))
      }
    }).catch(() => setUser(null))
  }, [])

  async function addFollow(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage("")
    try {
      const result = await api(`/users/teams/${teamId}`, { method: "POST" })
      setFollowed((current) => [...current, result.team!].sort((a, b) => a.teamName.localeCompare(b.teamName)))
      setTeamId("")
    } catch (error) { setMessage((error as Error).message) }
  }

  async function removeFollow(id: number) {
    setMessage("")
    try {
      await api(`/users/teams/${id}`, { method: "DELETE" })
      setFollowed((current) => current.filter((team) => team.teamId !== id))
    } catch (error) { setMessage((error as Error).message) }
  }

  if (!user) return <Card><CardContent className="p-5 text-sm text-muted-foreground"><a className="font-medium text-foreground underline" href="/sign-in">Sign in</a> to access your role dashboard.</CardContent></Card>

  return (
    <Card className="mt-8">
      <CardHeader><CardTitle className="flex items-center justify-between"><span>{user.role === "admin" ? "Administrator console" : "Fan workspace"}</span><span className="rounded-full bg-muted px-3 py-1 text-xs font-medium uppercase">{user.role}</span></CardTitle></CardHeader>
      <CardContent className="space-y-5">
        {message ? <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{message}</p> : null}
        {user.role === "fan" ? (
          <div className="space-y-4">
            <form className="flex flex-col gap-2 sm:flex-row" onSubmit={addFollow}>
              <select aria-label="Team to follow" value={teamId} onChange={(event) => setTeamId(event.target.value)} className="h-10 flex-1 rounded-md border bg-background px-3 text-sm" required>
                <option value="">Choose a team</option>
                {catalog.filter((team) => !followed.some((own) => own.teamId === team.teamId)).map((team) => <option key={team.teamId} value={team.teamId}>{team.teamName}</option>)}
              </select>
              <Button type="submit">Follow team</Button>
            </form>
            <div><h3 className="mb-2 text-sm font-semibold">Your followed teams</h3>{followed.length ? <ul className="space-y-2">{followed.map((team) => <li className="flex items-center justify-between rounded-md border px-3 py-2 text-sm" key={team.teamId}><span>{team.teamName}</span><Button type="button" variant="ghost" size="sm" onClick={() => removeFollow(team.teamId)}>Remove</Button></li>)}</ul> : <p className="text-sm text-muted-foreground">You are not following any teams yet.</p>}</div>
          </div>
        ) : (
          <div><h3 className="mb-2 text-sm font-semibold">Registered users</h3><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-muted-foreground"><th className="py-2">Name</th><th>Email</th><th>Role</th></tr></thead><tbody>{adminUsers.map((item) => <tr className="border-b last:border-0" key={item.id}><td className="py-2">{item.name}</td><td>{item.email}</td><td className="uppercase">{item.role}</td></tr>)}</tbody></table></div></div>
        )}
      </CardContent>
    </Card>
  )
}