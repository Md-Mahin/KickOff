"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AdminPerformanceDashboard } from "@/components/dashboard/admin-performance-dashboard"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type AuthUser = { userId: number; role: "fan" | "admin" }
type AdminUser = { id: number; name: string; email: string; role: string }

export default function AdminPage() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [loginError, setLoginError] = useState("")
  const [activeTab, setActiveTab] = useState<"performance" | "users">("performance")
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])

  const checkAuth = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/auth/me", { credentials: "include" })
      if (!res.ok) {
        setUser(null)
        return
      }
      const data = await res.json()
      setUser(data.user ?? null)
      if (data.user?.role === "admin") {
        fetch("http://localhost:5000/api/users/admin/users", { credentials: "include" })
          .then((r) => r.json())
          .then((uData) => setAdminUsers(uData.users ?? []))
          .catch(() => {})
      }
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkAuth()
  }, [])

  // 1-Click Demo Admin Login
  const handleQuickAdminLogin = async () => {
    setIsSigningIn(true)
    setLoginError("")
    try {
      const res = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "admin@kickoff.com",
          password: "AdminPassword123!",
        }),
      })

      if (res.ok) {
        window.location.reload()
      } else {
        const errData = await res.json().catch(() => ({}))
        setLoginError(errData.message || "Failed to sign in as admin. Check that backend is running.")
      }
    } catch {
      setLoginError("Could not connect to backend server. Make sure it is running on port 5000.")
    } finally {
      setIsSigningIn(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-slate-600 text-sm">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
          <span>Verifying administrator privileges...</span>
        </div>
      </div>
    )
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-slate-200 shadow-sm text-center">
          <CardHeader>
            <div className="mx-auto h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center text-xl mb-2 text-amber-700">
              ⚡
            </div>
            <CardTitle className="text-lg font-bold text-slate-900">Administrator Access Required</CardTitle>
            <CardDescription className="text-xs text-slate-500">
              This portal displays performance ratings and statistics. Sign in with an administrator account to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loginError && (
              <p className="rounded-lg border border-destructive/20 bg-destructive/10 p-2.5 text-xs text-destructive text-left">
                {loginError}
              </p>
            )}

            {/* 1-Click Quick Demo Login */}
            <Button
              type="button"
              onClick={handleQuickAdminLogin}
              disabled={isSigningIn}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 shadow-sm transition-all"
            >
              {isSigningIn ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Signing In as Admin...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span>⚡</span> 1-Click Sign In as Admin
                </span>
              )}
            </Button>

            <div className="rounded-lg bg-slate-100 p-3 text-left border border-slate-200 space-y-1">
              <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Default Admin Credentials:</p>
              <div className="text-xs font-mono text-slate-800 space-y-0.5">
                <p>Email: <span className="font-semibold text-blue-600">admin@kickoff.com</span></p>
                <p>Password: <span className="font-semibold text-slate-900">AdminPassword123!</span></p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Link href="/sign-in" className="flex-1">
                <Button variant="outline" size="sm" className="w-full text-xs">Custom Sign In</Button>
              </Link>
              <Link href="/" className="flex-1">
                <Button variant="ghost" size="sm" className="w-full text-xs">Return Home</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      {/* ── Top Header Bar ── */}
      <div className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Link href="/" className="text-xs font-semibold text-slate-500 hover:text-slate-900">
                  ← Back to Matches
                </Link>
                <span className="text-slate-300">/</span>
                <span className="text-xs font-semibold text-slate-800">Admin Control Center</span>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 mt-1">
                Administrator Dashboard
              </h1>
            </div>

            {/* Tab navigation */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setActiveTab("performance")}
                className={`px-3.5 py-1.5 rounded-lg transition-all ${
                  activeTab === "performance"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                📊 Player Performance & Ratings
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("users")}
                className={`px-3.5 py-1.5 rounded-lg transition-all ${
                  activeTab === "users"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                👥 User Management ({adminUsers.length})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content Area ── */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8">
        {activeTab === "performance" ? (
          <AdminPerformanceDashboard />
        ) : (
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle className="text-base font-bold">Registered Users ({adminUsers.length})</CardTitle>
              <CardDescription className="text-xs">
                Platform accounts across fan and administrator roles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b bg-slate-50 text-muted-foreground font-semibold">
                      <th className="py-2.5 px-3">ID</th>
                      <th className="py-2.5 px-3">Username</th>
                      <th className="py-2.5 px-3">Email</th>
                      <th className="py-2.5 px-3">Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {adminUsers.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-mono text-slate-500">#{item.id}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{item.name}</td>
                        <td className="py-2.5 px-3 text-slate-600">{item.email}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              item.role === "admin"
                                ? "bg-amber-100 text-amber-800 border border-amber-200"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {item.role}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
